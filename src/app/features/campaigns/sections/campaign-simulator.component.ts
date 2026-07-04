import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SimulationPanelComponent } from '../../../shared/simulation/simulation-panel.component';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import { CreatorsService } from '../../../core/creators/creators.service';
import { CampaignsService } from '../../../core/campaigns/campaigns.service';
import { Campaign, CampaignForecast } from '../../../core/campaigns/campaign.types';
import { Creator } from '../../../core/data/creator.types';
import { SimResult } from '../../../core/simulation/simulation.types';

@Component({
  selector: 'app-campaign-simulator',
  standalone: true,
  imports: [DecimalPipe, SimulationPanelComponent],
  template: `
    <section class="sf-panel p-5" data-testid="section-forecast">
      <h2 class="text-xs uppercase tracking-wider font-bold mb-4" style="color: var(--color-text-muted);">Forecast</h2>

      @if (campaign().forecast; as fc) {
        <div class="grid grid-cols-3 gap-4 text-center mb-4" data-testid="campaign-forecast-summary">
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
        @if (defaultedFormatCount() > 0) {
          <p class="text-xs mb-4" style="color: var(--color-text-muted);"
            data-testid="forecast-format-default-note">
            {{ defaultedFormatCount() }} creator{{ defaultedFormatCount() === 1 ? '' : 's' }} default to
            Integrated — set per-creator formats in Outreach.
          </p>
        }
        <app-simulation-panel
          [creators]="creators()"
          [initialBudget]="campaign().budget ?? 85000"
          [initialGenre]="campaign().genre ?? ''"
          [initialObjectives]="campaign().objectives"
          [genres]="genres()"
          [perCreatorFormat]="true"
          [creatorFormats]="creatorFormats()"
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
  protected readonly result = signal<SimResult | null>(null);
  protected readonly saving = signal(false);
  // Guards the one-forecast-per-campaign overwrite: true while the confirm
  // dialog is open (only when a forecast already exists).
  protected readonly confirmingOverwrite = signal(false);

  protected readonly forecastLocked = computed(() => this.campaign().status !== 'planning');

  private readonly creatorsRes = resource<Creator[], number[]>({
    params: () => this.campaignCreators.records().map((cc) => cc.creatorId),
    loader: ({ params }) => (params.length ? this.creatorsSvc.byIds(params) : Promise.resolve([])),
    defaultValue: [],
  });
  protected readonly creators = computed(() => this.creatorsRes.value());

  // creatorId → sponsorship format, only for records that have one set. Fed to the
  // panel's per-creator mode; creators absent here fall back to Integrated server-side.
  protected readonly creatorFormats = computed<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    for (const cc of this.campaignCreators.records()) {
      if (cc.format) map[cc.creatorId] = cc.format;
    }
    return map;
  });

  // Count of hydrated roster creators with no format set (they'll default to
  // Integrated). Drives the forecast note.
  protected readonly defaultedFormatCount = computed(() => {
    const formats = this.creatorFormats();
    return this.creators().filter((c) => !formats[c.id]).length;
  });

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
      const forecast: CampaignForecast = {
        impressions: r.impressions, ctr: r.ctr, roas: r.roas, cvr: r.cvr,
        p10: r.p10, p50: r.p50, p90: r.p90,
        creatorBreakdowns: (r.creatorBreakdowns ?? []).map((b) => ({
          id: b.id,
          impressions: b.impressions,
          clicks: b.clicks,
          conversions: b.conversions,
          spend: b.budgetShare,
          revenue: Math.round(b.roas * b.budgetShare),
        })),
      };
      await this.campaignsSvc.update(this.campaign().id, { forecast });
    } finally {
      this.saving.set(false);
    }
  }
}
