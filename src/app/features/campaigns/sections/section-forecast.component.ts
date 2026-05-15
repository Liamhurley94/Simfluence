import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Campaign } from '../../../core/campaigns/campaign.types';

@Component({
  selector: 'app-section-forecast',
  standalone: true,
  imports: [DecimalPipe, RouterLink],
  template: `
    <section
      class="p-4 rounded-lg"
      style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
      data-testid="section-forecast"
    >
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xs uppercase tracking-wider font-bold" style="color: var(--color-text-muted);">
          Forecast
        </h2>
        @if (!readonly) {
          <a
            [routerLink]="['/app/simulator']"
            [queryParams]="{ campaign: campaign.id }"
            class="text-xs px-3 py-1.5 rounded"
            style="background: var(--color-sf-cyan); color: #000;"
            data-testid="forecast-run"
          >
            {{ campaign.forecast ? 'Rerun simulation' : 'Run simulation' }}
          </a>
        }
      </div>

      @if (campaign.forecast; as f) {
        <div class="grid grid-cols-3 gap-4 text-center">
          <div>
            <div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">P50 Impressions</div>
            <div class="text-lg font-bold" style="color: var(--color-text);">{{ f.p50.impressions | number: '1.0-0' }}</div>
            <div class="text-[10px]" style="color: var(--color-text-muted);">
              P10 {{ f.p10.impressions | number: '1.0-0' }} · P90 {{ f.p90.impressions | number: '1.0-0' }}
            </div>
          </div>
          <div>
            <div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">CTR</div>
            <div class="text-lg font-bold" style="color: var(--color-text);">{{ f.p50.ctr }}%</div>
            <div class="text-[10px]" style="color: var(--color-text-muted);">
              P10 {{ f.p10.ctr }}% · P90 {{ f.p90.ctr }}%
            </div>
          </div>
          <div>
            <div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">ROAS</div>
            <div class="text-lg font-bold" style="color: var(--color-sf-gold);">{{ f.p50.roas }}×</div>
            <div class="text-[10px]" style="color: var(--color-text-muted);">
              P10 {{ f.p10.roas }}× · P90 {{ f.p90.roas }}×
            </div>
          </div>
        </div>
      } @else {
        <p class="text-xs" style="color: var(--color-text-muted);">
          No forecast yet. Run a simulation against the current creator list to see projected impressions, CTR, and ROAS.
        </p>
      }
    </section>
  `,
})
export class SectionForecastComponent {
  @Input({ required: true }) campaign!: Campaign;
  @Input() readonly = false;
}
