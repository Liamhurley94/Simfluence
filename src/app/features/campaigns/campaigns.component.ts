import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { CampaignsService } from '../../core/campaigns/campaigns.service';
import { BriefPdfService } from '../../core/campaigns/brief-pdf.service';
import {
  Campaign,
  CAMPAIGN_STATUS_LABELS,
  LegacyCampaignForecast,
  isW2Forecast,
} from '../../core/campaigns/campaign.types';
import { W2Response } from '../../core/simulation/simulation-w2.types';
import { tierRank } from '../../core/types';
import { SpinnerComponent } from '../../shared/spinner/spinner.component';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [DecimalPipe, RouterLink, SpinnerComponent],
  template: `
    <div class="sf-appear">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-bold" style="color: var(--color-text);">Campaigns</h1>
        <button
          type="button"
          (click)="createAndOpen()"
          class="sf-btn sf-btn-primary text-xs uppercase tracking-wider"
          data-testid="campaigns-new"
        >
          + New campaign
        </button>
      </div>

      @if (svc.error()) {
        <div
          class="p-3 mb-4 rounded-lg text-xs"
          style="background: rgba(230,0,35,0.08); border: 1px solid var(--color-sf-red); color: var(--color-sf-red);"
          data-testid="campaigns-error"
        >
          {{ svc.error() }}
        </div>
      }

      @if (svc.loading()) {
        <div class="flex justify-center py-12">
          <app-spinner label="Loading campaigns…" />
        </div>
      } @else if (svc.campaigns().length === 0) {
        <div
          class="sf-card p-12 text-center"
          data-testid="campaigns-empty"
        >
          <div class="text-sm font-semibold mb-2" style="color: var(--color-text);">
            No campaigns yet
          </div>
          <p class="text-xs mb-4" style="color: var(--color-text-muted);">
            Create a new campaign or save one from the simulator to get started.
          </p>
        </div>
      } @else {
        <div
          class="grid gap-3"
          style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));"
          data-testid="campaigns-grid"
        >
          @for (c of svc.campaigns(); track c.id; let i = $index) {
            <article
              class="sf-card p-4 cursor-pointer hover:opacity-90 sf-appear"
              [style.animation-delay.ms]="(i < 12 ? i : 12) * 30"
              [routerLink]="['/app/campaigns', c.id]"
              [attr.data-testid]="'campaign-' + c.id"
            >
            <div class="flex items-start justify-between gap-2 mb-1">
              <div class="min-w-0">
                <div class="font-bold truncate" style="color: var(--color-text);">{{ c.name }}</div>
                <div class="text-xs truncate" style="color: var(--color-text-muted);">
                  {{ c.client || 'Unassigned' }} · {{ c.genre || '—' }}
                </div>
              </div>
              @if (c.budget != null) {
                <div class="text-xs shrink-0" style="color: var(--color-sf-gold);">
                  \${{ c.budget | number: '1.0-0' }}
                </div>
              }
            </div>

            <div class="flex items-center gap-2 mb-3">
              <span
                class="sf-chip"
                [style]="statusStyle(c)"
                [attr.data-testid]="'campaign-status-' + c.id"
              >
                {{ statusLabel(c) }}
              </span>
              <span
                class="sf-chip"
                [attr.data-testid]="'campaign-owner-' + c.id"
              >
                {{ ownershipLabel(c) }}
              </span>
            </div>

            <!-- Saved forecasts are records, not migrations (spec §8): the card
                 renders whichever shape the campaign actually stored. -->
            @if (w2ForecastOf(c); as f) {
              <div class="grid grid-cols-3 gap-1 text-center mb-3" [attr.data-testid]="'campaign-forecast-w2-' + c.id">
                <div>
                  <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">Impressions</div>
                  <div class="text-xs font-bold" style="color: var(--color-text);">
                    {{ f.totals.impressions | number: '1.0-0' }}
                  </div>
                </div>
                <div>
                  <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">Conv. (max)</div>
                  <div class="text-xs font-bold" style="color: var(--color-text);">
                    {{ f.totals.conversions.value | number: '1.0-0' }}
                  </div>
                </div>
                <div>
                  <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">Cost / conv.</div>
                  <div class="text-xs font-bold" style="color: var(--color-sf-gold);">
                    {{ f.totals.costPerConversion === null ? '–' : '$' + (f.totals.costPerConversion | number: '1.0-2') }}
                  </div>
                </div>
              </div>
            } @else if (legacyForecastOf(c); as f) {
              <div class="grid grid-cols-3 gap-1 text-center mb-3" [attr.data-testid]="'campaign-forecast-legacy-' + c.id">
                <div>
                  <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">P50 Imp.</div>
                  <div class="text-xs font-bold" style="color: var(--color-text);">
                    {{ f.p50.impressions | number: '1.0-0' }}
                  </div>
                </div>
                <div>
                  <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">CTR</div>
                  <div class="text-xs font-bold" style="color: var(--color-text);">{{ f.p50.ctr }}%</div>
                </div>
                <div>
                  <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">ROAS</div>
                  <div class="text-xs font-bold" style="color: var(--color-sf-gold);">
                    {{ f.p50.roas }}×
                  </div>
                </div>
              </div>
            }

            @if (c.notes) {
              <p class="text-xs mb-3 line-clamp-2" style="color: var(--color-text);">{{ c.notes }}</p>
            }

            <div class="flex gap-1" (click)="$event.stopPropagation()">
              <button
                type="button"
                (click)="exportPdf(c, $event)"
                [disabled]="!canExportBrief()"
                class="sf-btn flex-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                style="background: var(--color-accent); color: var(--color-accent-fg);"
                [attr.data-testid]="'campaign-pdf-' + c.id"
              >
                Brief PDF
              </button>
              <button
                type="button"
                (click)="remove(c, $event)"
                class="sf-btn text-xs"
                style="background: transparent; border-color: var(--color-sf-red); color: var(--color-sf-red);"
                [attr.data-testid]="'campaign-delete-' + c.id"
              >
                Delete
              </button>
            </div>
            </article>
          }
        </div>
      }
    </div>
  `,
})
export class CampaignsComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private pdf = inject(BriefPdfService);

  protected readonly svc = inject(CampaignsService);

  protected readonly canExportBrief = computed(
    () => tierRank(this.auth.tier()) >= tierRank('platinum'),
  );

  constructor() {
    void this.svc.load();
  }

  /**
   * Creates an empty planning campaign and routes to its detail page.
   * Campaigns are persisted from the moment of creation; "wizard state" is
   * just which fields are filled.
   */
  async createAndOpen(): Promise<void> {
    const created = await this.svc.create({ name: 'Untitled campaign' });
    if (created) {
      void this.router.navigate(['/app/campaigns', created.id]);
    }
  }

  async remove(c: Campaign, ev: MouseEvent): Promise<void> {
    ev.stopPropagation();
    await this.svc.remove(c.id);
  }

  exportPdf(c: Campaign, ev: MouseEvent): void {
    ev.stopPropagation();
    this.pdf.export(c);
  }

  protected statusLabel(c: Campaign): string {
    return CAMPAIGN_STATUS_LABELS[c.status];
  }

  protected statusStyle(c: Campaign): string {
    const colors: Record<string, string> = {
      planning: 'background: rgba(155,155,170,0.18); color: var(--color-text-muted);',
      active: 'background: rgba(0,200,120,0.15); color: var(--color-sf-green);',
      completed: 'background: rgba(0,180,220,0.15); color: var(--color-sf-cyan);',
      archived: 'background: rgba(155,155,170,0.10); color: var(--color-text-muted);',
    };
    return colors[c.status] ?? colors['planning'];
  }

  protected ownershipLabel(c: Campaign): string {
    if (c.enterpriseId === null) return 'Personal';
    return this.auth.enterprise()?.name ?? 'Enterprise';
  }

  protected w2ForecastOf(c: Campaign): W2Response | null {
    return isW2Forecast(c.forecast) ? c.forecast : null;
  }

  protected legacyForecastOf(c: Campaign): LegacyCampaignForecast | null {
    return c.forecast && !isW2Forecast(c.forecast) ? c.forecast : null;
  }
}
