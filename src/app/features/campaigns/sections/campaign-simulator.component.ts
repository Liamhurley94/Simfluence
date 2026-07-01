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
          <div><div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">P50 Impressions</div>
            <div class="text-lg font-bold" style="color: var(--color-text);">{{ fc.p50.impressions | number: '1.0-0' }}</div></div>
          <div><div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">CTR</div>
            <div class="text-lg font-bold" style="color: var(--color-text);">{{ fc.p50.ctr }}%</div></div>
          <div><div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">ROAS</div>
            <div class="text-lg font-bold" style="color: var(--color-sf-gold);">{{ fc.p50.roas }}×</div></div>
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
          [creators]="creators()"
          [initialBudget]="campaign().budget ?? 85000"
          [initialGenre]="campaign().genre ?? ''"
          [genres]="genres()"
          (simulated)="result.set($event)"
        />
        <div class="mt-4">
          <button type="button" (click)="saveForecast()" [disabled]="!result() || saving()"
            class="sf-btn text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            style="background: var(--color-sf-green); color: var(--color-bg);" data-testid="campaign-forecast-save">
            {{ saving() ? 'Saving…' : 'Save forecast' }}
          </button>
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

  protected readonly forecastLocked = computed(() => this.campaign().status !== 'planning');

  private readonly creatorsRes = resource<Creator[], number[]>({
    params: () => this.campaignCreators.records().map((cc) => cc.creatorId),
    loader: ({ params }) => (params.length ? this.creatorsSvc.byIds(params) : Promise.resolve([])),
    defaultValue: [],
  });
  protected readonly creators = computed(() => this.creatorsRes.value());

  async saveForecast(): Promise<void> {
    const r = this.result();
    if (!r || this.forecastLocked()) return;
    this.saving.set(true);
    try {
      const forecast: CampaignForecast = { impressions: r.impressions, ctr: r.ctr, roas: r.roas, cvr: r.cvr, p10: r.p10, p50: r.p50, p90: r.p90 };
      await this.campaignsSvc.update(this.campaign().id, { forecast });
    } finally {
      this.saving.set(false);
    }
  }
}
