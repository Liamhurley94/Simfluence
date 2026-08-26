import { Component, computed, effect, inject, input, linkedSignal, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';
import { SourceZoneHeaderComponent } from '../compliance/source-zone-header.component';
import { ProprietaryNoteComponent } from '../compliance/proprietary-note.component';
import { AuthService } from '../../core/auth/auth.service';
import { RunSimulationService } from '../../core/simulation/run-simulation.service';
import { RateLimitService } from '../../core/simulation/rate-limit.service';
import { OBJECTIVES, Objective } from '../../core/simulation/simulation.types';
import {
  Band,
  CreatorResult,
  DeliverableResult,
  SimW2Mode,
  VolumeWindow,
  W2Response,
} from '../../core/simulation/simulation-w2.types';

/** One labelled point of the Conservative / Expected / Optimistic band (D18 rule 3). */
interface BandPoint {
  key: 'conservative' | 'expected' | 'optimistic';
  label: string;
  color: string;
}

const BAND_POINTS: BandPoint[] = [
  { key: 'conservative', label: 'Conservative', color: 'var(--color-sf-red)' },
  { key: 'expected', label: 'Expected', color: 'var(--color-sf-gold)' },
  { key: 'optimistic', label: 'Optimistic', color: 'var(--color-sf-green)' },
];

/** The 30/60/90-day windows a deliverable's volume accrues over (spec §3). */
interface WindowRow {
  days: 30 | 60 | 90;
  v: VolumeWindow;
}

/**
 * Simulation panel — renders a W2 `run-simulation` response and nothing else.
 * Every number on screen is computed server-side (the simulator math is IP);
 * the panel groups per-deliverable rows by creator, sums per platform, and
 * labels the two figures that cannot honestly be summed across platforms.
 *
 * Two modes (spec §1/§9): `free` sends a creator roster + budget, `campaign`
 * sends a campaign id and lets the server load its saved deliverable rows and
 * budget. Neither sends creator stats — the server owns those (spec §2).
 *
 * Displays Creator Performance Index (CPI) and Genre Fit Index (GFI), both
 * Simfluence-derived, so the per-creator zone carries the YouTube III.E.4h
 * source header and proprietary-metric note (see docs/compliance/README.md).
 *
 * See docs/superpowers/specs/2026-08-26-simulator-rebuild-design.md.
 */
@Component({
  selector: 'app-simulation-panel',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    IconComponent,
    SourceZoneHeaderComponent,
    ProprietaryNoteComponent,
  ],
  template: `
    @if (!readonly()) {
      <!-- Controls -->
      <div
        class="sf-panel p-4 mb-6 grid gap-4"
        style="grid-template-columns: repeat(2, minmax(0,1fr));"
        data-testid="simw2-controls"
      >
        @if (mode() === 'free') {
          <div>
            <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">
              Budget (USD)
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              [ngModel]="budget()"
              (ngModelChange)="budget.set($event || 0)"
              class="sf-input"
              data-testid="simw2-budget"
            />
          </div>
        }
        <div>
          <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">
            Genre
          </label>
          <select
            [ngModel]="genre()"
            (ngModelChange)="genre.set($event)"
            class="sf-select"
            data-testid="simw2-genre"
          >
            @for (g of genres(); track g) {
              <option [ngValue]="g">{{ g }}</option>
            }
          </select>
        </div>
      </div>

      <!-- Objectives -->
      <div class="mb-6" data-testid="simw2-objectives">
        <div class="text-[10px] uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">
          Campaign objectives
        </div>
        <div class="flex flex-wrap gap-1">
          @for (o of objectives; track o) {
            <button
              type="button"
              (click)="toggleObjective(o)"
              class="sf-chip cursor-pointer"
              [style.background]="selectedObjectives().includes(o) ? 'var(--color-sf-blue)' : ''"
              [style.color]="selectedObjectives().includes(o) ? 'white' : ''"
              [style.border-color]="selectedObjectives().includes(o) ? 'var(--color-sf-blue)' : ''"
              [attr.data-testid]="'simw2-obj-' + slug(o)"
            >
              {{ o }}
            </button>
          }
        </div>
      </div>

      <!-- Rate limit banner -->
      @if (limit().blocked) {
        <div
          class="p-3 mb-4 rounded-lg text-xs"
          style="background: color-mix(in srgb, var(--color-sf-red) 8%, transparent); border: 1px solid var(--color-sf-red); color: var(--color-sf-red);"
          data-testid="simw2-rate-limit"
        >
          You've used all {{ limit().limit }} simulations for this month. Upgrade your tier for more
          runs.
        </div>
      } @else if (!isUnlimited()) {
        <div class="text-xs mb-4" style="color: var(--color-text-muted);" data-testid="simw2-rate-usage">
          {{ limit().remaining }} of {{ limit().limit }} simulations remaining this month.
        </div>
      }

      <!-- Actions -->
      <div class="flex items-center justify-end gap-2 mb-6" data-testid="simw2-actions">
        <button
          type="button"
          (click)="run()"
          [disabled]="runDisabled()"
          class="sf-btn text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
          style="background: var(--color-sf-orange); color: var(--color-bg);"
          data-testid="simw2-run"
        >
          @if (!pending()) {
            <app-icon name="play" [size]="12" style="display:inline-block;vertical-align:middle;" />
          }
          {{ pending() ? 'Running…' : result() ? 'Re-run' : 'Run simulation' }}
        </button>
        <ng-content></ng-content>
      </div>
    }

    @if (error(); as e) {
      <div
        class="p-3 mb-4 rounded-lg text-xs"
        style="background: color-mix(in srgb, var(--color-sf-red) 8%, transparent); border: 1px solid var(--color-sf-red); color: var(--color-sf-red);"
        data-testid="simw2-error"
      >
        The forecast could not be produced — {{ e }}
      </div>
    }

    @if (result(); as r) {
      <div data-testid="simw2-results">
        @if (r.zeroBudget) {
          <div
            class="p-3 mb-4 rounded-lg text-xs"
            style="background: color-mix(in srgb, var(--color-sf-red) 8%, transparent); border: 1px solid var(--color-sf-red); color: var(--color-sf-red);"
            data-testid="simw2-zero-budget"
          >
            There is no budget to allocate, so nothing below was forecast. Set a budget and run
            again.
          </div>
        }

        @if (r.warnings.length > 0) {
          <ul class="p-3 mb-4 rounded-lg text-xs list-disc pl-6"
            style="background: color-mix(in srgb, var(--color-sf-orange) 8%, transparent); border: 1px solid var(--color-sf-orange); color: var(--color-sf-orange);"
            data-testid="simw2-warnings">
            @for (w of r.warnings; track $index) {
              <li data-testid="simw2-warning">{{ w }}</li>
            }
          </ul>
        }

        <!-- Campaign totals -->
        <div class="sf-card overflow-hidden mb-6" data-testid="simw2-totals">
          <div class="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold"
            style="background: var(--color-sf-blue); color: var(--color-bg);">
            Campaign forecast
          </div>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-0">
            <div class="p-4 border-r border-b" style="border-color: var(--color-border);" data-testid="simw2-total-impressions">
              <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">Impressions</div>
              <div class="text-lg font-bold" style="color: var(--color-text);">{{ r.totals.impressions | number: '1.0-0' }}</div>
            </div>
            <div class="p-4 border-r border-b" style="border-color: var(--color-border);" data-testid="simw2-total-unique-reach">
              <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">Unique reach</div>
              <div class="text-lg font-bold" style="color: var(--color-text);">{{ r.totals.uniqueReach.value | number: '1.0-0' }}</div>
              <div class="text-[9px] mt-0.5" style="color: var(--color-sf-orange);" data-testid="simw2-total-unique-reach-upper-bound">
                Upper bound — platforms overlap
              </div>
            </div>
            <div class="p-4 border-b" style="border-color: var(--color-border);" data-testid="simw2-total-engaged-clicks">
              <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">Eng. clicks</div>
              <div class="text-lg font-bold" style="color: var(--color-text);">{{ r.totals.engagedClicks | number: '1.0-0' }}</div>
            </div>
            <div class="p-4 border-r" style="border-color: var(--color-border);" data-testid="simw2-total-conversions">
              <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">Conversions</div>
              <div class="text-lg font-bold" style="color: var(--color-text);">{{ r.totals.conversions.value | number: '1.0-0' }}</div>
              <div class="text-[9px] mt-0.5" style="color: var(--color-sf-orange);" data-testid="simw2-total-conversions-upper-bound">
                Upper bound — platforms overlap
              </div>
            </div>
            <div class="p-4 border-r" style="border-color: var(--color-border);" data-testid="simw2-total-cost">
              <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">Cost</div>
              <div class="text-lg font-bold" style="color: var(--color-sf-gold);">\${{ r.totals.cost | number: '1.0-0' }}</div>
              <div class="text-[9px] mt-0.5" style="color: var(--color-text-muted);">
                \${{ r.totals.forecastableCost | number: '1.0-0' }} of it bought forecastable rows
              </div>
            </div>
            <div class="p-4" data-testid="simw2-total-cost-per-conversion">
              <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">Cost per conversion</div>
              <div class="text-lg font-bold" style="color: var(--color-sf-gold);">{{ money(r.totals.costPerConversion) }}</div>
            </div>
          </div>

          <!-- Conservative / Expected / Optimistic (D18 rule 3) -->
          <div class="grid grid-cols-3" style="border-top: 1px solid var(--color-border);">
            @for (p of bandPoints; track p.key) {
              <div class="p-4" style="border-right: 1px solid var(--color-border);"
                [attr.data-testid]="'simw2-band-' + p.key">
                <div class="text-[10px] uppercase tracking-wider mb-1" [style.color]="p.color">{{ p.label }}</div>
                <div class="text-base font-bold" style="color: var(--color-text);">
                  {{ pick(r.totals.band.impressions, p.key) | number: '1.0-0' }}
                </div>
                <div class="text-[10px]" style="color: var(--color-text-muted);">impressions</div>
                <div class="text-[10px] mt-1" style="color: var(--color-text-muted);">
                  {{ pick(r.totals.band.conversions, p.key) | number: '1.0-0' }} conversions (upper bound)
                </div>
              </div>
            }
          </div>
        </div>

        @if (r.unallocated > 0 || r.unallocatedMessage) {
          <div class="p-3 mb-6 rounded-lg text-xs"
            style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text);"
            data-testid="simw2-unallocated">
            <span style="color: var(--color-text-muted);">Unallocated budget</span>
            <strong>\${{ r.unallocated | number: '1.0-0' }}</strong>
            @if (r.unallocatedMessage; as msg) {
              <span class="block mt-1" style="color: var(--color-text-muted);" data-testid="simw2-unallocated-message">
                {{ msg }}
              </span>
            }
          </div>
        }

        <!-- Per platform (spec §5) -->
        <div class="grid gap-3 mb-6" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));"
          data-testid="simw2-platforms">
          @for (p of r.platforms; track p.platform) {
            <div class="sf-card p-4" [attr.data-testid]="'simw2-platform-' + slug(p.platform)">
              <div class="text-[10px] uppercase tracking-wider mb-2 font-semibold" style="color: var(--color-text);">
                {{ p.platform }}
              </div>
              <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs" style="color: var(--color-text-muted);">
                <dt>Impressions</dt>
                <dd class="text-right" style="color: var(--color-text);">{{ p.impressions | number: '1.0-0' }}</dd>
                <dt>Unique reach</dt>
                <dd class="text-right" style="color: var(--color-text);">{{ p.uniqueReach | number: '1.0-0' }}</dd>
                <dt>Eng. clicks</dt>
                <dd class="text-right" style="color: var(--color-text);">{{ p.engagedClicks | number: '1.0-0' }}</dd>
                <dt>Conversions</dt>
                <dd class="text-right" style="color: var(--color-text);">{{ p.conversions | number: '1.0-0' }}</dd>
                <dt>Cost</dt>
                <dd class="text-right" style="color: var(--color-sf-gold);">\${{ p.cost | number: '1.0-0' }}</dd>
                <dt>Cost per conversion</dt>
                <dd class="text-right" style="color: var(--color-sf-gold);"
                  [attr.data-testid]="'simw2-platform-cost-per-conversion-' + slug(p.platform)">
                  {{ money(p.costPerConversion) }}
                </dd>
              </dl>
            </div>
          }
        </div>

        <!-- Per creator, per deliverable -->
        <div class="sf-card overflow-hidden" data-testid="simw2-creators">
          <div class="px-4 py-3 flex items-center justify-between"
            style="background: var(--color-bg-3); border-bottom: 1px solid var(--color-border);">
            <div class="text-[10px] uppercase tracking-wider font-semibold" style="color: var(--color-text);">
              Per-creator deliverables
            </div>
            <app-source-zone-header source="simfluence" />
          </div>
          <div class="px-4 pt-2">
            <app-proprietary-note />
            <p class="text-[10px] mt-1" style="color: var(--color-text-muted);" data-testid="simw2-engaged-clicks-label">
              Engagement clicks (video-level) — engagement on the post itself, not site visits.
            </p>
          </div>

          @for (c of r.creators; track c.id) {
            <div class="px-4 py-3" style="border-top: 1px solid var(--color-border);"
              [attr.data-testid]="'simw2-creator-' + c.id">
              <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                <span class="text-sm font-semibold" style="color: var(--color-text);">
                  {{ c.name ?? '#' + c.id }}
                </span>
                <span class="text-[10px]" style="color: var(--color-text-muted);">GFI {{ c.gfi }}%</span>
                @if (c.engagementRate !== null) {
                  <span class="text-[10px]" style="color: var(--color-text-muted);"
                    [attr.data-testid]="'simw2-creator-engagement-' + c.id">
                    Engagement {{ c.engagementRate }}%
                  </span>
                }
                @if (!c.reachable) {
                  <span class="sf-chip text-[10px]" style="color: var(--color-sf-red); border-color: var(--color-sf-red);"
                    [attr.data-testid]="'simw2-creator-unreachable-' + c.id">
                    Budget doesn't cover this creator — excluded from the totals
                  </span>
                }
                @if (c.reachUpperBound) {
                  <span class="text-[10px]" style="color: var(--color-sf-orange);"
                    [attr.data-testid]="'simw2-creator-upper-bound-' + c.id">
                    Multi-platform — reach and conversions are an upper bound
                  </span>
                }
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-xs" style="border-collapse: collapse;">
                  <thead>
                    <tr style="border-bottom: 1px solid var(--color-border); color: var(--color-text-muted);">
                      <th class="text-left px-2 py-1 text-[9px] uppercase tracking-wider font-semibold">Platform</th>
                      <th class="text-left px-2 py-1 text-[9px] uppercase tracking-wider font-semibold">Format</th>
                      <th class="text-right px-2 py-1 text-[9px] uppercase tracking-wider font-semibold">Qty</th>
                      <th class="text-right px-2 py-1 text-[9px] uppercase tracking-wider font-semibold">Hours</th>
                      <th class="text-right px-2 py-1 text-[9px] uppercase tracking-wider font-semibold">CPI</th>
                      <th class="text-right px-2 py-1 text-[9px] uppercase tracking-wider font-semibold">Impressions</th>
                      <th class="text-right px-2 py-1 text-[9px] uppercase tracking-wider font-semibold">Unique reach</th>
                      <th class="text-right px-2 py-1 text-[9px] uppercase tracking-wider font-semibold">Eng. clicks</th>
                      <th class="text-right px-2 py-1 text-[9px] uppercase tracking-wider font-semibold">Conversions</th>
                      <th class="text-right px-2 py-1 text-[9px] uppercase tracking-wider font-semibold">Cost</th>
                      <th class="text-right px-2 py-1 text-[9px] uppercase tracking-wider font-semibold">Cost / conv.</th>
                      <th class="px-2 py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <!-- di aliases the deliverable index: the nested window and
                         band loops shadow $index, and the row testids key off it. -->
                    @for (d of c.deliverables; track $index; let di = $index) {
                      <tr style="border-bottom: 1px solid var(--color-border);"
                        [attr.data-testid]="'simw2-deliverable-' + c.id + '-' + di">
                        <td class="px-2 py-2">
                          <span class="sf-chip text-[10px]"
                            [style.color]="platformColor(d.platform)"
                            [style.border-color]="platformColor(d.platform)"
                            [attr.data-testid]="'simw2-deliverable-platform-' + c.id + '-' + di">
                            {{ d.platform }}
                          </span>
                        </td>
                        <td class="px-2 py-2" style="color: var(--color-text);"
                          [attr.data-testid]="'simw2-deliverable-format-' + c.id + '-' + di">{{ d.format }}</td>
                        <td class="text-right px-2 py-2" style="color: var(--color-text);"
                          [attr.data-testid]="'simw2-deliverable-qty-' + c.id + '-' + di">{{ d.quantity }}</td>
                        <td class="text-right px-2 py-2" style="color: var(--color-text);">
                          @if (d.durationHours !== null) {
                            <span [attr.data-testid]="'simw2-deliverable-hours-' + c.id + '-' + di">{{ d.durationHours }}h</span>
                          } @else {
                            <span style="color: var(--color-text-muted);">–</span>
                          }
                        </td>
                        <td class="text-right px-2 py-2" style="color: var(--color-text);">
                          {{ d.cpi }}
                          @if (d.cpiSubstituted) {
                            <span class="text-[9px]" style="color: var(--color-sf-orange);"
                              [attr.data-testid]="'simw2-deliverable-cpi-substituted-' + c.id + '-' + di"
                              title="No platform CPI — a neutral 50 stood in">est.</span>
                          }
                        </td>
                        <td class="text-right px-2 py-2" style="color: var(--color-text);"
                          [attr.data-testid]="'simw2-deliverable-impressions-' + c.id + '-' + di">{{ d.impressions | number: '1.0-0' }}</td>
                        <td class="text-right px-2 py-2" style="color: var(--color-text);"
                          [attr.data-testid]="'simw2-deliverable-unique-reach-' + c.id + '-' + di">{{ d.uniqueReach | number: '1.0-0' }}</td>
                        <td class="text-right px-2 py-2" style="color: var(--color-text);"
                          [attr.data-testid]="'simw2-deliverable-engaged-clicks-' + c.id + '-' + di">{{ d.engagedClicks | number: '1.0-0' }}</td>
                        <td class="text-right px-2 py-2" style="color: var(--color-text);"
                          [attr.data-testid]="'simw2-deliverable-conversions-' + c.id + '-' + di">{{ d.conversions | number: '1.0-0' }}</td>
                        <td class="text-right px-2 py-2" style="color: var(--color-sf-gold);"
                          [attr.data-testid]="'simw2-deliverable-cost-' + c.id + '-' + di">
                          \${{ d.cost | number: '1.0-0' }}
                          <span class="block text-[9px]" style="color: var(--color-text-muted);"
                            [attr.data-testid]="'simw2-deliverable-cost-source-' + c.id + '-' + di">{{ d.costSource }}</span>
                          @if (d.bandBreach) {
                            <span class="block text-[9px]" style="color: var(--color-sf-orange);"
                              [attr.data-testid]="'simw2-deliverable-band-breach-' + c.id + '-' + di">
                              {{ d.bandBreach }} the estimated range{{ rateRangeLabel(d) }}
                            </span>
                          }
                        </td>
                        <td class="text-right px-2 py-2" style="color: var(--color-sf-gold);"
                          [attr.data-testid]="'simw2-deliverable-cost-per-conversion-' + c.id + '-' + di">
                          {{ money(d.costPerConversion) }}
                        </td>
                        <td class="text-right px-2 py-2">
                          @if (d.noData) {
                            <span class="sf-chip text-[9px]" style="color: var(--color-sf-red); border-color: var(--color-sf-red);"
                              [attr.data-testid]="'simw2-deliverable-no-data-' + c.id + '-' + di">
                              No stats — excluded from every total
                            </span>
                          } @else {
                            <button type="button" class="sf-btn sf-btn-ghost text-[10px] px-2 py-0.5"
                              (click)="toggleWindow(c.id, di)"
                              [attr.aria-expanded]="isExpanded(c.id, di)"
                              [attr.data-testid]="'simw2-window-toggle-' + c.id + '-' + di">
                              {{ isExpanded(c.id, di) ? '▾' : '▸' }} 30/60/90
                            </button>
                          }
                        </td>
                      </tr>

                      @if (isExpanded(c.id, di)) {
                        <tr style="border-bottom: 1px solid var(--color-border);"
                          [attr.data-testid]="'simw2-window-' + c.id + '-' + di">
                          <td colspan="12" class="px-4 py-3" style="background: var(--color-bg-3);">
                            <table class="w-full text-[11px] mb-3">
                              <thead>
                                <tr style="color: var(--color-text-muted);">
                                  <th class="text-left font-semibold py-0.5">Window</th>
                                  <th class="text-right font-semibold py-0.5">Impressions</th>
                                  <th class="text-right font-semibold py-0.5">Unique reach</th>
                                  <th class="text-right font-semibold py-0.5">Eng. clicks</th>
                                  <th class="text-right font-semibold py-0.5">Conversions</th>
                                </tr>
                              </thead>
                              <tbody>
                                @for (w of windowsOf(d); track w.days) {
                                  <tr>
                                    <td class="py-0.5" style="color: var(--color-text-muted);">{{ w.days }} days</td>
                                    <td class="text-right py-0.5" style="color: var(--color-text);"
                                      [attr.data-testid]="'simw2-window-' + w.days + '-impressions-' + c.id + '-' + di">{{ w.v.impressions | number: '1.0-0' }}</td>
                                    <td class="text-right py-0.5" style="color: var(--color-text);"
                                      [attr.data-testid]="'simw2-window-' + w.days + '-unique-reach-' + c.id + '-' + di">{{ w.v.uniqueReach | number: '1.0-0' }}</td>
                                    <td class="text-right py-0.5" style="color: var(--color-text);"
                                      [attr.data-testid]="'simw2-window-' + w.days + '-engaged-clicks-' + c.id + '-' + di">{{ w.v.engagedClicks | number: '1.0-0' }}</td>
                                    <td class="text-right py-0.5" style="color: var(--color-text);"
                                      [attr.data-testid]="'simw2-window-' + w.days + '-conversions-' + c.id + '-' + di">{{ w.v.conversions | number: '1.0-0' }}</td>
                                  </tr>
                                }
                              </tbody>
                            </table>

                            @if (isFlatWindow(d)) {
                              <p class="text-[10px] mb-3" style="color: var(--color-text-muted);"
                                [attr.data-testid]="'simw2-window-flat-note-' + c.id + '-' + di">
                                A stream is watched live — the later windows add nothing to it, so all
                                three read the same on purpose.
                              </p>
                            }

                            <table class="w-full text-[11px]" [attr.data-testid]="'simw2-range-' + c.id + '-' + di">
                              <thead>
                                <tr style="color: var(--color-text-muted);">
                                  <th class="text-left font-semibold py-0.5">Range (30 days)</th>
                                  <th class="text-right font-semibold py-0.5">Impressions</th>
                                  <th class="text-right font-semibold py-0.5">Unique reach</th>
                                  <th class="text-right font-semibold py-0.5">Eng. clicks</th>
                                  <th class="text-right font-semibold py-0.5">Conversions</th>
                                </tr>
                              </thead>
                              <tbody>
                                @for (p of bandPoints; track p.key) {
                                  <tr>
                                    <td class="py-0.5 font-semibold" [style.color]="p.color">{{ p.label }}</td>
                                    <td class="text-right py-0.5" style="color: var(--color-text);">{{ pick(d.band.impressions, p.key) | number: '1.0-0' }}</td>
                                    <td class="text-right py-0.5" style="color: var(--color-text);">{{ pick(d.band.uniqueReach, p.key) | number: '1.0-0' }}</td>
                                    <td class="text-right py-0.5" style="color: var(--color-text);">{{ pick(d.band.engagedClicks, p.key) | number: '1.0-0' }}</td>
                                    <td class="text-right py-0.5" style="color: var(--color-text);">{{ pick(d.band.conversions, p.key) | number: '1.0-0' }}</td>
                                  </tr>
                                }
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>

              <div class="mt-2 text-[10px]" style="color: var(--color-text-muted);"
                [attr.data-testid]="'simw2-creator-totals-' + c.id">
                Creator total — {{ c.impressions | number: '1.0-0' }} impressions ·
                {{ c.uniqueReach | number: '1.0-0' }} unique reach ·
                {{ c.engagedClicks | number: '1.0-0' }} eng. clicks ·
                {{ c.conversions | number: '1.0-0' }} conversions ·
                \${{ c.cost | number: '1.0-0' }} cost · {{ money(c.costPerConversion) }} per conversion
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class SimulationPanelComponent {
  private runSim = inject(RunSimulationService);
  private rateLimitSvc = inject(RateLimitService);
  private auth = inject(AuthService);

  /** `free` sends a roster + budget; `campaign` sends a campaign id (spec §1). */
  readonly mode = input<SimW2Mode>('free');
  /** Free mode only — the ids to forecast. The server loads every stat itself. */
  readonly creatorIds = input<number[]>([]);
  /** Campaign mode only — the campaign whose saved deliverable rows are priced. */
  readonly campaignId = input<string | null>(null);
  readonly initialBudget = input<number>(85_000);
  readonly initialGenre = input<string>('');
  readonly initialObjectives = input<string[]>([]);
  readonly genres = input<string[]>([]);
  readonly subMode = input<string | undefined>(undefined);
  readonly readonly = input<boolean>(false);
  readonly autoRun = input<boolean>(false);
  readonly simulated = output<W2Response>();

  protected readonly objectives = OBJECTIVES;
  protected readonly bandPoints = BAND_POINTS;

  protected readonly budget = linkedSignal(() => this.initialBudget());
  protected readonly genre = linkedSignal(() => this.initialGenre());
  // Seeded from the campaign's persisted objectives. Filter to the canonical
  // buckets so stale/legacy values are ignored.
  protected readonly selectedObjectives = linkedSignal<Objective[]>(() =>
    OBJECTIVES.filter((o) => this.initialObjectives().includes(o)),
  );

  protected readonly result = signal<W2Response | null>(null);
  // runFree/runCampaign reject rather than returning null, so a failed request
  // is distinguishable from "no forecast yet" — it renders as an error banner
  // instead of silently looking like an empty roster.
  protected readonly error = signal<string | null>(null);
  protected readonly pending = signal(false);
  /** Expanded 30/60/90 rows, keyed `creatorId:index`. */
  private readonly expandedRows = signal<Set<string>>(new Set());

  protected readonly limit = computed(() => this.rateLimitSvc.check(this.auth.tier()));
  protected readonly isUnlimited = computed(() => !Number.isFinite(this.limit().limit));
  protected readonly runDisabled = computed(() => {
    if (this.readonly() || this.limit().blocked || this.pending()) return true;
    return this.mode() === 'free' ? this.creatorIds().length === 0 : !this.campaignId();
  });

  // Fire one automatic run when the host opts in (autoRun) and the inputs have
  // loaded — e.g. arriving from Discovery's "Simulate selected". Deferred to a
  // microtask so `pending` isn't written synchronously inside the effect, and
  // guarded so it never fires twice or while the rate limit blocks it.
  private autoRan = false;
  constructor() {
    effect(() => {
      if (this.autoRun() && !this.autoRan && !this.runDisabled()) {
        this.autoRan = true;
        queueMicrotask(() => void this.run());
      }
    });
  }

  async run(): Promise<void> {
    if (this.runDisabled()) return;
    this.rateLimitSvc.increment();
    this.pending.set(true);
    this.expandedRows.set(new Set());
    try {
      const objectives = this.selectedObjectives();
      const r =
        this.mode() === 'campaign'
          ? await this.runSim.runCampaign(this.campaignId()!, {
              genre: this.genre(),
              subMode: this.subMode(),
              objectives,
            })
          : await this.runSim.runFree({
              creators: this.creatorIds().map((id) => ({ id })),
              budget: this.budget(),
              genre: this.genre(),
              subMode: this.subMode(),
              objectives,
            });
      this.error.set(null);
      this.result.set(r);
      this.simulated.emit(r);
    } catch (e: unknown) {
      this.result.set(null);
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.pending.set(false);
    }
  }

  toggleObjective(o: Objective): void {
    this.selectedObjectives.update((l) => (l.includes(o) ? l.filter((x) => x !== o) : [...l, o]));
  }

  protected toggleWindow(creatorId: string, index: number): void {
    const key = `${creatorId}:${index}`;
    this.expandedRows.update((s) => {
      const next = new Set(s);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  protected isExpanded(creatorId: string, index: number): boolean {
    return this.expandedRows().has(`${creatorId}:${index}`);
  }

  protected windowsOf(d: DeliverableResult): WindowRow[] {
    return [
      { days: 30, v: { impressions: d.impressions, uniqueReach: d.uniqueReach, engagedClicks: d.engagedClicks, conversions: d.conversions } },
      { days: 60, v: d.d60 },
      { days: 90, v: d.d90 },
    ];
  }

  /** True when the later windows add nothing — Twitch's honest flat case (spec §11). */
  protected isFlatWindow(d: DeliverableResult): boolean {
    return d.d60.impressions === d.impressions && d.d90.impressions === d.impressions;
  }

  protected pick(b: Band, key: BandPoint['key']): number {
    return b[key];
  }

  protected rateRangeLabel(d: DeliverableResult): string {
    if (!d.rateRange) return '';
    const [lo, hi] = d.rateRange;
    return ` ($${lo.toLocaleString('en-US')}–$${hi.toLocaleString('en-US')})`;
  }

  protected money(v: number | null): string {
    if (v == null) return '–';
    return `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }

  protected platformColor(platform: string): string {
    return platform === 'Twitch' ? 'var(--color-twitch)' : 'var(--color-sf-red)';
  }

  slug(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
}

/** Re-exported for hosts that type their own `simulated` handler. */
export type { CreatorResult, W2Response };
