import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SimulationPanelComponent } from '../../../shared/simulation/simulation-panel.component';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import { CreatorsService } from '../../../core/creators/creators.service';
import { CampaignsService } from '../../../core/campaigns/campaigns.service';
import { Campaign, LegacyCampaignForecast, isW2Forecast } from '../../../core/campaigns/campaign.types';
import { Creator } from '../../../core/data/creator.types';
import { W2Response } from '../../../core/simulation/simulation-w2.types';

@Component({
  selector: 'app-campaign-simulator',
  standalone: true,
  imports: [DecimalPipe, SimulationPanelComponent],
  template: `
    <section class="sf-panel p-5" data-testid="section-forecast">
      <h2 class="text-xs uppercase tracking-wider font-bold mb-4" style="color: var(--color-text-muted);">Forecast</h2>

      <!-- Saved-forecast summary. Forecasts are records, never migrated (spec §8),
           so which summary renders is decided by the payload's own version stamp. -->
      @if (savedW2(); as fc) {
        <div class="grid grid-cols-3 gap-4 text-center mb-4" data-testid="campaign-forecast-summary-w2">
          <div>
            <div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">Impressions</div>
            <div class="text-lg font-bold" style="color: var(--color-text);">{{ fc.totals.impressions | number: '1.0-0' }}</div>
            <div class="text-[10px]" style="color: var(--color-text-muted);">
              {{ fc.totals.band.impressions.conservative | number: '1.0-0' }}–{{ fc.totals.band.impressions.optimistic | number: '1.0-0' }}
            </div>
          </div>
          <div>
            <div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">Conversions</div>
            <div class="text-lg font-bold" style="color: var(--color-text);">{{ fc.totals.conversions.value | number: '1.0-0' }}</div>
            <div class="text-[10px]" style="color: var(--color-sf-orange);">Upper bound — platforms overlap</div>
          </div>
          <div>
            <div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">Cost per conversion</div>
            <div class="text-lg font-bold" style="color: var(--color-sf-gold);">
              {{ fc.totals.costPerConversion === null ? '–' : '$' + (fc.totals.costPerConversion | number: '1.0-2') }}
            </div>
            <div class="text-[10px]" style="color: var(--color-text-muted);">on \${{ fc.totals.cost | number: '1.0-0' }} spend</div>
          </div>
        </div>
      } @else if (savedLegacy(); as fc) {
        <div class="grid grid-cols-3 gap-4 text-center mb-4" data-testid="campaign-forecast-summary-legacy">
          <div>
            <div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">P50 Impressions</div>
            <div class="text-lg font-bold" style="color: var(--color-text);">{{ fc.p50.impressions | number: '1.0-0' }}</div>
            <div class="text-[10px]" style="color: var(--color-text-muted);">
              P10 {{ fc.p10.impressions | number: '1.0-0' }} · P90 {{ fc.p90.impressions | number: '1.0-0' }}
            </div>
          </div>
          <div>
            <div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">CTR</div>
            <div class="text-lg font-bold" style="color: var(--color-text);">{{ fc.p50.ctr }}%</div>
            <div class="text-[10px]" style="color: var(--color-text-muted);">
              P10 {{ fc.p10.ctr }}% · P90 {{ fc.p90.ctr }}%
            </div>
          </div>
          <div>
            <div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">ROAS</div>
            <div class="text-lg font-bold" style="color: var(--color-sf-gold);">{{ fc.p50.roas }}×</div>
            <div class="text-[10px]" style="color: var(--color-text-muted);">
              P10 {{ fc.p10.roas }}× · P90 {{ fc.p90.roas }}×
            </div>
          </div>
        </div>
      }

      @if (forecastLocked()) {
        @if (!campaign().forecast) {
          <p class="text-xs" style="color: var(--color-text-muted);">No forecast was saved before this campaign started.</p>
        }
      } @else if (creators().length === 0) {
        <p class="text-xs" style="color: var(--color-text-muted);">Add creators to this campaign to run a forecast.</p>
      } @else {
        <app-simulation-panel
          mode="campaign"
          [campaignId]="campaign().id"
          [initialGenre]="campaign().genre ?? ''"
          [initialObjectives]="campaign().objectives"
          [genres]="genres()"
          (simulated)="result.set($event)"
        >
          <button type="button" (click)="onSaveClick()" [disabled]="!result() || saving()"
            class="sf-btn text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            style="background: var(--color-sf-green); color: var(--color-bg);" data-testid="campaign-forecast-save">
            {{ saving() ? 'Saving…' : 'Save forecast' }}
          </button>
        </app-simulation-panel>
      }

      @if (confirmingOverwrite()) {
        <div
          class="fixed inset-0 z-40 flex items-center justify-center p-4 sf-fade-in"
          style="background: var(--color-overlay);"
          (click)="cancelOverwrite()"
          data-testid="forecast-overwrite-confirm"
        >
          <div
            class="sf-card w-full max-w-sm p-5 sf-modal-in"
            (click)="$event.stopPropagation()"
          >
            <div class="text-sm font-bold mb-2" style="color: var(--color-text);">Overwrite saved forecast?</div>
            <p class="text-xs mb-4" style="color: var(--color-text-muted);">
              This campaign already has a saved forecast. Saving overwrites it — only one forecast is
              kept per campaign. Continue?
            </p>
            <div class="flex items-center justify-end gap-2">
              <button type="button" (click)="cancelOverwrite()"
                class="sf-btn sf-btn-ghost text-xs uppercase tracking-wider"
                data-testid="forecast-overwrite-confirm-cancel">
                Cancel
              </button>
              <button type="button" (click)="confirmOverwrite()" [disabled]="saving()"
                class="sf-btn text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                style="background: var(--color-sf-green); color: var(--color-bg);"
                data-testid="forecast-overwrite-confirm-yes">
                {{ saving() ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class CampaignSimulatorComponent {
  private campaignCreators = inject(CampaignCreatorsService);
  private creatorsSvc = inject(CreatorsService);
  private campaignsSvc = inject(CampaignsService);

  readonly campaign = input.required<Campaign>();
  protected readonly genres = this.creatorsSvc.genres;
  protected readonly result = signal<W2Response | null>(null);
  protected readonly saving = signal(false);
  // Guards the one-forecast-per-campaign overwrite: true while the confirm
  // dialog is open (only when a forecast already exists).
  protected readonly confirmingOverwrite = signal(false);

  protected readonly forecastLocked = computed(() => this.campaign().status !== 'planning');

  protected readonly savedW2 = computed(() => {
    const f = this.campaign().forecast;
    return isW2Forecast(f) ? f : null;
  });
  protected readonly savedLegacy = computed<LegacyCampaignForecast | null>(() => {
    const f = this.campaign().forecast;
    return f && !isW2Forecast(f) ? f : null;
  });

  // Only used to decide whether there is a roster worth forecasting at all —
  // the panel sends the campaign id and the server loads the deliverable rows,
  // their formats and the budget itself (spec §2).
  private readonly creatorsRes = resource<Creator[], number[]>({
    params: () => this.campaignCreators.records().map((cc) => cc.creatorId),
    loader: ({ params }) => (params.length ? this.creatorsSvc.byIds(params) : Promise.resolve([])),
    defaultValue: [],
  });
  protected readonly creators = computed(() => this.creatorsRes.value());

  // Save entry point. Overwriting an existing forecast is destructive (only one
  // is kept per campaign), so gate that behind a confirm dialog. First save goes
  // straight through.
  onSaveClick(): void {
    if (!this.result() || this.forecastLocked()) return;
    if (this.campaign().forecast) {
      this.confirmingOverwrite.set(true);
    } else {
      void this.saveForecast();
    }
  }

  async confirmOverwrite(): Promise<void> {
    await this.saveForecast();
    this.confirmingOverwrite.set(false);
  }

  cancelOverwrite(): void {
    this.confirmingOverwrite.set(false);
  }

  async saveForecast(): Promise<void> {
    const r = this.result();
    if (!r || this.forecastLocked()) return;
    this.saving.set(true);
    try {
      // The whole version-stamped response is the record (spec §8): no slimming,
      // no client-derived fields. The debrief discriminates on `model.version`.
      await this.campaignsSvc.update(this.campaign().id, { forecast: r });
    } finally {
      this.saving.set(false);
    }
  }
}
