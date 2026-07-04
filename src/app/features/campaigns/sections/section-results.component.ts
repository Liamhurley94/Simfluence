import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import { CampaignsService } from '../../../core/campaigns/campaigns.service';
import { CreatorsService } from '../../../core/creators/creators.service';
import { Campaign, CampaignForecastCreator } from '../../../core/campaigns/campaign.types';
import { CampaignCreator, UpdateCampaignCreator } from '../../../core/campaigns/campaign-creators.types';
import { Creator } from '../../../core/data/creator.types';
import { CreatorActuals, ctr, cvr, roas, rollup, deltaPct, inBand } from '../../../core/campaigns/actuals-math';

type ActualField = 'actualImpressions' | 'actualClicks' | 'actualConversions' | 'actualSpend' | 'actualRevenue';

interface DebriefRow {
  key: string;
  label: string;
  unit: 'int' | 'pct' | 'x';
  forecast: number;
  actual: number | null;
  delta: number | null;
  banded: boolean;
  inBand: boolean;
}

/**
 * Results section — post-campaign per-creator actuals entry + a forecast-vs-actual
 * debrief. Mounted by campaign-detail once the campaign is past planning. Entry is
 * enabled while active/completed (exempt from the global read-only lock); archived
 * is read-only. See docs/superpowers/specs/2026-07-04-campaign-actuals-design.md.
 */
@Component({
  selector: 'app-section-results',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <section class="sf-panel p-5" data-testid="section-results">
      <h2 class="text-xs uppercase tracking-wider font-bold mb-4" style="color: var(--color-text-muted);">Results</h2>

      @if (campaign().forecast) {
        <div class="mb-5">
          <div class="text-[10px] uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">
            Forecast P50 vs actual
          </div>
          <table class="w-full text-xs">
            <tbody>
              @for (r of debrief(); track r.key) {
                <tr [attr.data-testid]="'debrief-row-' + r.key" style="border-top: 1px solid var(--color-border);">
                  <td class="py-1.5" style="color: var(--color-text-muted);">{{ r.label }}</td>
                  <td class="py-1.5 text-right" style="color: var(--color-text);">{{ fmt(r.forecast, r.unit) }}</td>
                  <td class="py-1.5 text-right font-semibold" style="color: var(--color-text);"
                      [attr.data-testid]="'debrief-actual-' + r.key">{{ fmt(r.actual, r.unit) }}</td>
                  <td class="py-1.5 text-right" [style.color]="deltaColor(r.delta)">{{ deltaLabel(r.delta) }}</td>
                  <td class="py-1.5 text-right" [attr.data-testid]="'debrief-band-' + r.key">
                    @if (r.banded && r.actual !== null) {
                      <span [style.color]="r.inBand ? 'var(--color-sf-green)' : 'var(--color-sf-orange)'">
                        {{ r.inBand ? '✓ in band' : '✗ out' }}
                      </span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (headline().revenueIncomplete) {
            <p class="text-[11px] mt-2" style="color: var(--color-text-muted);" data-testid="results-roas-hint">
              Enter revenue for every creator with spend to see return on ad spend (ROAS).
            </p>
          }
        </div>
      } @else {
        <p class="text-xs mb-5" style="color: var(--color-text-muted);" data-testid="results-no-forecast">
          No forecast was saved to compare against. You can still record actuals below.
        </p>
      }

      <div class="text-[10px] uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">
        Per-creator actuals @if (!editable()) { <span>(read-only)</span> }
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr style="color: var(--color-text-muted);">
              <th class="text-left font-normal px-1 py-1">Creator</th>
              <th class="text-right font-normal px-1 py-1">Impr</th>
              <th class="text-right font-normal px-1 py-1">Clicks</th>
              <th class="text-right font-normal px-1 py-1">Conv</th>
              <th class="text-right font-normal px-1 py-1">Spend</th>
              <th class="text-right font-normal px-1 py-1">Revenue</th>
            </tr>
          </thead>
          <tbody>
            @for (row of creatorRows(); track row.cc.id) {
              <tr style="border-top: 1px solid var(--color-border);">
                <td class="px-1 py-2" style="color: var(--color-text);">
                  {{ row.name }}
                  @if (forecastFor(row.cc.creatorId); as fc) {
                    <div class="text-[9px]" style="color: var(--color-text-muted);">
                      fc {{ fc.impressions | number: '1.0-0' }} · {{ fc.clicks | number: '1.0-0' }} · {{ fc.conversions | number: '1.0-0' }} · {{ '$' + (fc.spend | number: '1.0-0') }} · {{ '$' + (fc.revenue | number: '1.0-0') }}
                    </div>
                  }
                </td>
                @for (field of FIELDS; track field) {
                  <td class="px-1 py-2">
                    <input type="number" min="0" inputmode="numeric"
                      [value]="valueOf(row.cc, field) ?? ''"
                      (blur)="setActual(row.cc, field, $event)"
                      [readOnly]="!editable()"
                      class="sf-input px-1 py-0.5 text-xs w-20 text-right"
                      [attr.data-testid]="'actual-' + field + '-' + row.cc.id" />
                  </td>
                }
              </tr>
              <tr>
                <td colspan="6" class="px-1 pb-2">
                  <input type="text"
                    [value]="row.cc.debriefNotes ?? ''"
                    (blur)="setCreatorNote(row.cc, $event)"
                    [readOnly]="!editable()"
                    placeholder="note — what went well / wrong for this creator"
                    class="sf-input px-1 py-0.5 text-xs w-full"
                    [attr.data-testid]="'creator-note-' + row.cc.id" />
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="mt-4">
        <div class="text-[10px] uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">Campaign debrief note</div>
        <textarea rows="2"
          [value]="campaign().debriefNotes ?? ''"
          (blur)="setCampaignNote($event)"
          [readOnly]="!editable()"
          placeholder="Overall retrospective — what to repeat, what to change"
          class="sf-input px-2 py-1.5 text-xs w-full"
          data-testid="campaign-debrief-note"></textarea>
      </div>
    </section>
  `,
})
export class SectionResultsComponent {
  readonly campaign = input.required<Campaign>();

  private campaignCreators = inject(CampaignCreatorsService);
  private campaignsSvc = inject(CampaignsService);
  private creatorsSvc = inject(CreatorsService);

  protected readonly FIELDS: ActualField[] = [
    'actualImpressions', 'actualClicks', 'actualConversions', 'actualSpend', 'actualRevenue',
  ];

  protected readonly creatorById = signal<Map<number, Creator>>(new Map());

  protected readonly editable = computed(() => {
    const s = this.campaign().status;
    return s === 'active' || s === 'completed';
  });

  private readonly records = computed(() => this.campaignCreators.records() as CampaignCreator[]);

  private readonly actuals = computed<CreatorActuals[]>(() =>
    this.records().map((cc) => ({
      impressions: cc.actualImpressions,
      clicks: cc.actualClicks,
      conversions: cc.actualConversions,
      spend: cc.actualSpend,
      revenue: cc.actualRevenue,
    })),
  );

  protected readonly headline = computed(() => {
    const a = this.actuals();
    const r = rollup(a);
    const some = (pick: (x: CreatorActuals) => number | null) => a.some((x) => pick(x) != null);
    const impressions = some((x) => x.impressions) ? r.impressions : null;
    const clicks = some((x) => x.clicks) ? r.clicks : null;
    const conversions = some((x) => x.conversions) ? r.conversions : null;
    const spend = some((x) => x.spend) ? r.spend : null;
    const revenue = some((x) => x.revenue) ? r.revenue : null;
    return {
      impressions, clicks, conversions, spend, revenue,
      ctr: ctr(impressions, clicks),
      cvr: cvr(clicks, conversions),
      roas: r.revenueComplete && spend != null ? roas(spend, revenue) : null,
      revenueIncomplete: spend != null && !r.revenueComplete,
    };
  });

  protected readonly debrief = computed<DebriefRow[]>(() => {
    const f = this.campaign().forecast;
    if (!f) return [];
    const h = this.headline();
    return [
      { key: 'impressions', label: 'Impressions', unit: 'int', forecast: f.p50.impressions, actual: h.impressions, delta: deltaPct(h.impressions, f.p50.impressions), banded: true, inBand: inBand(h.impressions, f.p10.impressions, f.p90.impressions) },
      { key: 'ctr', label: 'CTR', unit: 'pct', forecast: f.p50.ctr, actual: h.ctr, delta: deltaPct(h.ctr, f.p50.ctr), banded: true, inBand: inBand(h.ctr, f.p10.ctr, f.p90.ctr) },
      { key: 'roas', label: 'ROAS', unit: 'x', forecast: f.p50.roas, actual: h.roas, delta: deltaPct(h.roas, f.p50.roas), banded: true, inBand: inBand(h.roas, f.p10.roas, f.p90.roas) },
      { key: 'cvr', label: 'CVR', unit: 'pct', forecast: f.cvr, actual: h.cvr, delta: deltaPct(h.cvr, f.cvr), banded: false, inBand: false },
    ];
  });

  protected readonly creatorRows = computed(() =>
    this.records().map((cc) => ({ cc, name: this.creatorById().get(cc.creatorId)?.name ?? `#${cc.creatorId}` })),
  );

  private readonly forecastById = computed(() => {
    const m = new Map<number, CampaignForecastCreator>();
    for (const b of this.campaign().forecast?.creatorBreakdowns ?? []) m.set(b.id, b);
    return m;
  });

  constructor() {
    effect(async () => {
      const ids = this.records().map((r) => r.creatorId);
      if (ids.length === 0) return;
      const known = this.creatorById();
      const missing = ids.filter((id) => !known.has(id));
      if (missing.length === 0) return;
      const fetched = await this.creatorsSvc.byIds(missing);
      const next = new Map(known);
      for (const cr of fetched) next.set(cr.id, cr);
      this.creatorById.set(next);
    });
  }

  protected forecastFor(creatorId: number): CampaignForecastCreator | undefined {
    return this.forecastById().get(creatorId);
  }

  protected valueOf(cc: CampaignCreator, field: ActualField): number | null {
    return cc[field];
  }

  async setActual(cc: CampaignCreator, field: ActualField, ev: Event): Promise<void> {
    if (!this.editable()) return;
    const raw = (ev.target as HTMLInputElement).value.trim();
    const value = raw === '' ? null : Number(raw);
    if (value != null && (Number.isNaN(value) || value < 0)) return;
    if (value === cc[field]) return;
    await this.campaignCreators.updateActuals(
      cc.id,
      { [field]: value } as Partial<Pick<UpdateCampaignCreator, ActualField>>,
    );
  }

  async setCreatorNote(cc: CampaignCreator, ev: Event): Promise<void> {
    if (!this.editable()) return;
    const value = (ev.target as HTMLInputElement).value.trim() || null;
    if (value === cc.debriefNotes) return;
    await this.campaignCreators.updateDebriefNotes(cc.id, value);
  }

  async setCampaignNote(ev: Event): Promise<void> {
    if (!this.editable()) return;
    const value = (ev.target as HTMLTextAreaElement).value.trim() || null;
    if (value === this.campaign().debriefNotes) return;
    await this.campaignsSvc.update(this.campaign().id, { debriefNotes: value });
  }

  protected fmt(v: number | null, unit: 'int' | 'pct' | 'x'): string {
    if (v == null) return '—';
    if (unit === 'pct') return `${v}%`;
    if (unit === 'x') return `${v}×`;
    return Math.round(v).toLocaleString('en-US');
  }

  protected deltaLabel(d: number | null): string {
    if (d == null) return '';
    return `${d > 0 ? '+' : ''}${d}%`;
  }

  protected deltaColor(d: number | null): string {
    if (d == null) return 'var(--color-text-muted)';
    if (d > 0) return 'var(--color-sf-green)';
    if (d < 0) return 'var(--color-sf-orange)';
    return 'var(--color-text-muted)';
  }
}
