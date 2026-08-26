import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import { CampaignsService } from '../../../core/campaigns/campaigns.service';
import { CreatorsService } from '../../../core/creators/creators.service';
import {
  Campaign,
  CampaignForecastCreator,
  LegacyCampaignForecast,
  isW2Forecast,
} from '../../../core/campaigns/campaign.types';
import { CampaignCreator, UpdateCampaignCreator } from '../../../core/campaigns/campaign-creators.types';
import { Creator } from '../../../core/data/creator.types';
import { CreatorActuals, ctr, cvr, roas, rollup, deltaPct, inBand } from '../../../core/campaigns/actuals-math';

type ActualField = 'actualImpressions' | 'actualClicks' | 'actualConversions' | 'actualSpend' | 'actualRevenue';

interface DebriefRow {
  key: string;
  label: string;
  unit: 'int' | 'pct' | 'x' | 'usd';
  forecast: number | null;
  actual: number | null;
  delta: number | null;
  banded: boolean;
  inBand: boolean;
  /** Cost rows invert the usual reading: over forecast is a miss, not a win. */
  lowerIsBetter?: boolean;
}

/** The per-creator forecast line a W2 payload contributes to the debrief. */
interface W2CreatorForecast {
  impressions: number;
  engagedClicks: number;
  conversions: number;
  cost: number;
  /** False when the budget never covered this creator — it was in no total. */
  reachable: boolean;
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

      @if (w2Forecast()) {
        <!-- W2 forecast (version-stamped): expected value + the Conservative–
             Optimistic band. No percentiles, no ROAS — both were cut (D23). -->
        <div class="mb-5">
          <div class="text-[10px] uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">
            Expected forecast vs actual
          </div>
          <table class="w-full text-xs">
            <tbody>
              @for (r of w2Debrief(); track r.key) {
                <tr [attr.data-testid]="'debrief-w2-row-' + r.key" style="border-top: 1px solid var(--color-border);">
                  <td class="py-1.5" style="color: var(--color-text-muted);">{{ r.label }}</td>
                  <td class="py-1.5 text-right" style="color: var(--color-text);">{{ fmt(r.forecast, r.unit) }}</td>
                  <td class="py-1.5 text-right font-semibold" style="color: var(--color-text);"
                      [attr.data-testid]="'debrief-w2-actual-' + r.key">{{ fmt(r.actual, r.unit) }}</td>
                  <td class="py-1.5 text-right" [style.color]="deltaColor(r.delta, r.lowerIsBetter)"
                      [attr.data-testid]="'debrief-w2-delta-' + r.key">{{ deltaLabel(r.delta) }}</td>
                  <td class="py-1.5 text-right" [attr.data-testid]="'debrief-w2-band-' + r.key">
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
        </div>
      } @else if (legacyForecast()) {
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
                  @if (w2ForecastFor(row.cc.creatorId); as fc) {
                    <div class="text-[9px]" style="color: var(--color-text-muted);" data-testid="creator-forecast-w2">
                      fc {{ fc.impressions | number: '1.0-0' }} impr · {{ fc.engagedClicks | number: '1.0-0' }} eng. clicks · {{ fc.conversions | number: '1.0-0' }} conv · {{ '$' + (fc.cost | number: '1.0-0') }}
                    </div>
                    @if (!fc.reachable) {
                      <div class="text-[9px]" style="color: var(--color-sf-red);" data-testid="creator-forecast-w2-excluded">
                        Budget didn't cover this creator — excluded from the totals
                      </div>
                    }
                  } @else if (forecastFor(row.cc.creatorId); as fc) {
                    <div class="text-[9px]" style="color: var(--color-text-muted);" data-testid="creator-forecast">
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

  // D18 rule 4 / spec §8: the saved payload's own version stamp decides which
  // debrief renders. Nothing is migrated or recomputed — old forecasts are
  // records of what was promised under the old model, and stay readable as such.
  protected readonly w2Forecast = computed(() => {
    const f = this.campaign().forecast;
    return isW2Forecast(f) ? f : null;
  });
  protected readonly legacyForecast = computed<LegacyCampaignForecast | null>(() => {
    const f = this.campaign().forecast;
    return f && !isW2Forecast(f) ? f : null;
  });

  protected readonly w2Debrief = computed<DebriefRow[]>(() => {
    const f = this.w2Forecast();
    if (!f) return [];
    const h = this.headline();
    const t = f.totals;
    // Cost per conversion is W2's efficiency headline (spec §5) — the actual
    // side is only computable once both spend and conversions are entered.
    const actualCpc =
      h.spend != null && h.conversions != null && h.conversions > 0
        ? Math.round((h.spend / h.conversions) * 100) / 100
        : null;
    return [
      { key: 'impressions', label: 'Impressions', unit: 'int', forecast: t.impressions, actual: h.impressions, delta: deltaPct(h.impressions, t.impressions), banded: true, inBand: inBand(h.impressions, t.band.impressions.conservative, t.band.impressions.optimistic) },
      { key: 'engagedClicks', label: 'Engagement clicks (video-level)', unit: 'int', forecast: t.engagedClicks, actual: h.clicks, delta: deltaPct(h.clicks, t.engagedClicks), banded: true, inBand: inBand(h.clicks, t.band.engagedClicks.conservative, t.band.engagedClicks.optimistic) },
      { key: 'conversions', label: 'Conversions (upper bound)', unit: 'int', forecast: t.conversions.value, actual: h.conversions, delta: deltaPct(h.conversions, t.conversions.value), banded: true, inBand: inBand(h.conversions, t.band.conversions.conservative, t.band.conversions.optimistic) },
      { key: 'spend', label: 'Spend', unit: 'usd', forecast: t.cost, actual: h.spend, delta: deltaPct(h.spend, t.cost), banded: false, inBand: false, lowerIsBetter: true },
      { key: 'costPerConversion', label: 'Cost per conversion', unit: 'usd', forecast: t.costPerConversion, actual: actualCpc, delta: t.costPerConversion == null ? null : deltaPct(actualCpc, t.costPerConversion), banded: false, inBand: false, lowerIsBetter: true },
    ];
  });

  protected readonly debrief = computed<DebriefRow[]>(() => {
    const f = this.legacyForecast();
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
    // Forecasts saved before 2026-08-09 persisted the edge fn's echoed string
    // id verbatim (CampaignForecastCreator.id is typed `number`, but legacy
    // rows hold e.g. "7"). No migration touches old jsonb, so coerce on read.
    for (const b of this.legacyForecast()?.creatorBreakdowns ?? []) m.set(Number(b.id), b);
    return m;
  });

  // W2 echoes creator ids as strings; the roster keys on numbers.
  private readonly w2ForecastById = computed(() => {
    const m = new Map<number, W2CreatorForecast>();
    for (const c of this.w2Forecast()?.creators ?? []) {
      m.set(Number(c.id), {
        impressions: c.impressions,
        engagedClicks: c.engagedClicks,
        conversions: c.conversions,
        cost: c.cost,
        reachable: c.reachable,
      });
    }
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

  protected w2ForecastFor(creatorId: number): W2CreatorForecast | undefined {
    return this.w2ForecastById().get(creatorId);
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

  protected fmt(v: number | null, unit: DebriefRow['unit']): string {
    if (v == null) return '—';
    if (unit === 'pct') return `${v}%`;
    if (unit === 'x') return `${v}×`;
    if (unit === 'usd') return `$${Math.round(v).toLocaleString('en-US')}`;
    return Math.round(v).toLocaleString('en-US');
  }

  protected deltaLabel(d: number | null): string {
    if (d == null) return '';
    return `${d > 0 ? '+' : ''}${d}%`;
  }

  /**
   * Green = the campaign did better than forecast. For volume rows that means
   * over; for cost rows (`lowerIsBetter`) it means under — beating a $20,000
   * cost per conversion by half is a win, not a 50% shortfall.
   */
  protected deltaColor(d: number | null, lowerIsBetter = false): string {
    if (d == null || d === 0) return 'var(--color-text-muted)';
    const better = lowerIsBetter ? d < 0 : d > 0;
    return better ? 'var(--color-sf-green)' : 'var(--color-sf-orange)';
  }
}
