import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { CampaignContextService } from '../../core/context/campaign-context.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { SelectionService } from '../../core/selection/selection.service';
import { SimulationService } from '../../core/simulation/simulation.service';
import { RunSimulationService } from '../../core/simulation/run-simulation.service';
import { RateLimitService } from '../../core/simulation/rate-limit.service';
import {
  Format,
  OBJECTIVES,
  Objective,
  SimResult,
} from '../../core/simulation/simulation.types';

const FORMATS: Format[] = ['Integrated', 'Mixed', 'Dedicated'];

@Component({
  selector: 'app-simulator',
  standalone: true,
  imports: [DecimalPipe, FormsModule, RouterLink],
  template: `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold" style="color: var(--color-text);">Simulator</h1>
      <div class="text-xs" style="color: var(--color-text-muted);" data-testid="sim-selection-count">
        {{ creators().length }} creator{{ creators().length === 1 ? '' : 's' }} in shortlist
      </div>
    </div>

    @if (creators().length === 0) {
      <div
        class="p-12 rounded-lg text-center"
        style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
        data-testid="sim-empty"
      >
        <div class="text-sm font-semibold mb-2" style="color: var(--color-text);">
          No creators selected
        </div>
        <p class="text-xs mb-4" style="color: var(--color-text-muted);">
          Pick a shortlist on Discovery or use a persona auto-select.
        </p>
        <a
          routerLink="/app/discovery"
          class="inline-block px-4 py-2 rounded text-xs font-semibold"
          style="background: var(--color-sf-blue); color: white;"
        >
          Go to Discovery
        </a>
      </div>
    } @else {
      <!-- Controls -->
      <div
        class="p-4 mb-6 rounded-lg grid gap-4"
        style="background: var(--color-bg-2); border: 1px solid var(--color-border); grid-template-columns: repeat(3, minmax(0,1fr));"
        data-testid="sim-controls"
      >
        <div>
          <label
            class="text-[10px] uppercase tracking-wider mb-1 block"
            style="color: var(--color-text-muted);"
          >
            Budget (USD)
          </label>
          <input
            type="number"
            min="0"
            step="1000"
            [ngModel]="budget()"
            (ngModelChange)="budget.set($event || 0)"
            class="w-full px-3 py-2 rounded text-sm"
            style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
            data-testid="sim-budget"
          />
        </div>
        <div>
          <label
            class="text-[10px] uppercase tracking-wider mb-1 block"
            style="color: var(--color-text-muted);"
          >
            Format
          </label>
          <select
            [ngModel]="format()"
            (ngModelChange)="format.set($event)"
            class="w-full px-3 py-2 rounded text-sm"
            style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
            data-testid="sim-format"
          >
            @for (f of formats; track f) {
              <option [ngValue]="f">{{ f }}</option>
            }
          </select>
        </div>
        <div>
          <label
            class="text-[10px] uppercase tracking-wider mb-1 block"
            style="color: var(--color-text-muted);"
          >
            Genre
          </label>
          <select
            [ngModel]="context.genre()"
            (ngModelChange)="context.genre.set($event)"
            class="w-full px-3 py-2 rounded text-sm"
            style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
            data-testid="sim-genre"
          >
            @for (g of genres; track g) {
              <option [ngValue]="g">{{ g }}</option>
            }
          </select>
        </div>
      </div>

      <!-- Objectives -->
      <div class="mb-6" data-testid="sim-objectives">
        <div
          class="text-[10px] uppercase tracking-wider mb-2"
          style="color: var(--color-text-muted);"
        >
          Campaign objectives
        </div>
        <div class="flex flex-wrap gap-1">
          @for (o of objectives; track o) {
            <button
              type="button"
              (click)="toggleObjective(o)"
              class="text-[10px] px-2 py-1 rounded"
              [style.background]="selectedObjectives().includes(o) ? 'var(--color-sf-blue)' : 'var(--color-bg-3)'"
              [style.color]="'#fff'"
              [attr.data-testid]="'sim-obj-' + slug(o)"
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
          style="background: rgba(230,0,35,0.08); border: 1px solid var(--color-sf-red); color: var(--color-sf-red);"
          data-testid="sim-rate-limit"
        >
          You've used all {{ limit().limit }} simulations for this month. Upgrade your tier for more
          runs.
        </div>
      } @else if (!isUnlimited()) {
        <div
          class="text-xs mb-4"
          style="color: var(--color-text-muted);"
          data-testid="sim-rate-usage"
        >
          {{ limit().remaining }} of {{ limit().limit }} simulations remaining this month.
        </div>
      }

      <!-- Actions -->
      <div class="flex items-center gap-2 mb-6" data-testid="sim-actions">
        <button
          type="button"
          (click)="run()"
          [disabled]="runDisabled()"
          class="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
          style="background: var(--color-sf-orange); color: white;"
          data-testid="sim-run"
        >
          {{ pending() ? 'Running…' : result() ? '▶ Re-run' : '▶ Run simulation' }}
        </button>
        @if (result()) {
          <span class="text-xs" style="color: var(--color-text-muted);">
            Last run: genre {{ context.genre() }} · {{ result()!.budget | number }} budget ·
            {{ creators().length }} creators
          </span>
        }
      </div>

      @if (result(); as r) {
        <!-- Bands -->
        <div class="grid grid-cols-3 gap-3 mb-6" data-testid="sim-bands">
          <div
            class="rounded-lg p-4"
            style="background: var(--color-bg-2); border: 2px solid var(--color-sf-red);"
            data-testid="sim-p10"
          >
            <div class="text-[10px] uppercase tracking-wider mb-2" style="color: var(--color-sf-red);">
              P10 · Worst case
            </div>
            <div class="text-3xl font-bold" style="color: var(--color-text);">
              {{ r.p10.impressions | number: '1.0-0' }}
            </div>
            <div class="text-xs mb-3" style="color: var(--color-text-muted);">impressions</div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">CTR</div>
                <div class="font-bold" style="color: var(--color-text);">{{ r.p10.ctr }}%</div>
              </div>
              <div>
                <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">ROAS</div>
                <div class="font-bold" style="color: var(--color-text);">{{ r.p10.roas }}×</div>
              </div>
            </div>
          </div>
          <div
            class="rounded-lg p-4"
            style="background: var(--color-bg-2); border: 2px solid var(--color-sf-gold);"
            data-testid="sim-p50"
          >
            <div
              class="text-[10px] uppercase tracking-wider mb-2"
              style="color: var(--color-sf-gold);"
            >
              P50 · Base case
            </div>
            <div class="text-3xl font-bold" style="color: var(--color-text);">
              {{ r.p50.impressions | number: '1.0-0' }}
            </div>
            <div class="text-xs mb-3" style="color: var(--color-text-muted);">impressions</div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">CTR</div>
                <div class="font-bold" style="color: var(--color-text);">{{ r.p50.ctr }}%</div>
              </div>
              <div>
                <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">ROAS</div>
                <div class="font-bold" style="color: var(--color-text);">{{ r.p50.roas }}×</div>
              </div>
            </div>
          </div>
          <div
            class="rounded-lg p-4"
            style="background: var(--color-bg-2); border: 2px solid var(--color-sf-green);"
            data-testid="sim-p90"
          >
            <div
              class="text-[10px] uppercase tracking-wider mb-2"
              style="color: var(--color-sf-green);"
            >
              P90 · Best case
            </div>
            <div class="text-3xl font-bold" style="color: var(--color-text);">
              {{ r.p90.impressions | number: '1.0-0' }}
            </div>
            <div class="text-xs mb-3" style="color: var(--color-text-muted);">impressions</div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">CTR</div>
                <div class="font-bold" style="color: var(--color-text);">{{ r.p90.ctr }}%</div>
              </div>
              <div>
                <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">ROAS</div>
                <div class="font-bold" style="color: var(--color-text);">{{ r.p90.roas }}×</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Core metrics grid -->
        <div
          class="rounded-lg overflow-hidden"
          style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
          data-testid="sim-metrics"
        >
          <div
            class="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold"
            style="background: var(--color-sf-blue); color: white;"
          >
            Base case metrics
          </div>
          <div class="grid grid-cols-6 gap-0">
            <div class="p-4 border-r" style="border-color: var(--color-border);">
              <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">
                Impressions
              </div>
              <div class="text-lg font-bold" style="color: var(--color-text);">
                {{ r.impressions | number: '1.0-0' }}
              </div>
            </div>
            <div class="p-4 border-r" style="border-color: var(--color-border);">
              <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">Clicks</div>
              <div class="text-lg font-bold" style="color: var(--color-text);">
                {{ r.clicks | number: '1.0-0' }}
              </div>
            </div>
            <div class="p-4 border-r" style="border-color: var(--color-border);">
              <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">CTR</div>
              <div class="text-lg font-bold" style="color: var(--color-text);">{{ r.ctr }}%</div>
            </div>
            <div class="p-4 border-r" style="border-color: var(--color-border);">
              <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">CVR</div>
              <div class="text-lg font-bold" style="color: var(--color-text);">{{ r.cvr }}%</div>
            </div>
            <div class="p-4 border-r" style="border-color: var(--color-border);">
              <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">
                Conversions
              </div>
              <div class="text-lg font-bold" style="color: var(--color-text);">
                {{ r.conversions | number: '1.0-0' }}
              </div>
            </div>
            <div class="p-4">
              <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">ROAS</div>
              <div class="text-lg font-bold" style="color: var(--color-sf-gold);">
                {{ r.roas }}×
              </div>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class SimulatorComponent {
  private selection = inject(SelectionService);
  private creatorsSvc = inject(CreatorsService);
  private auth = inject(AuthService);
  private sim = inject(SimulationService);
  private rateLimitSvc = inject(RateLimitService);
  protected readonly runSim = inject(RunSimulationService);
  protected readonly context = inject(CampaignContextService);

  protected readonly objectives = OBJECTIVES;
  protected readonly formats = FORMATS;
  protected readonly genres = this.creatorsSvc.genres();

  protected readonly budget = signal(85_000);
  protected readonly format = signal<Format>('Integrated');
  protected readonly selectedObjectives = signal<Objective[]>([]);
  protected readonly result = signal<SimResult | null>(null);

  protected readonly creators = computed(() =>
    this.creatorsSvc.byIds(this.selection.ids()),
  );

  protected readonly pending = this.runSim.pending;

  protected readonly limit = computed(() =>
    this.rateLimitSvc.check(this.auth.tier()),
  );

  protected readonly isUnlimited = computed(() => !Number.isFinite(this.limit().limit));

  protected readonly runDisabled = computed(
    () => this.limit().blocked || this.creators().length === 0 || this.pending(),
  );

  run(): void {
    if (this.runDisabled()) return;

    const inputs = {
      creators: this.creators(),
      budget: this.budget(),
      format: this.format(),
      genre: this.context.genre(),
      objectives: this.selectedObjectives(),
      subMode: this.context.subMode() || undefined,
    };

    // Local compute is instant — show something immediately.
    const local = this.sim.compute(inputs);
    if (local) this.result.set(local);

    this.rateLimitSvc.increment();

    // Kick off the server run; replace when it returns.
    void this.runSim.run(inputs).then((server) => {
      if (server) this.result.set(server);
    });
  }

  toggleObjective(o: Objective): void {
    this.selectedObjectives.update((list) =>
      list.includes(o) ? list.filter((x) => x !== o) : [...list, o],
    );
  }

  slug(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
}
