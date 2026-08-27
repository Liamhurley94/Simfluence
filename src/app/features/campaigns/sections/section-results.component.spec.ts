import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { SectionResultsComponent } from './section-results.component';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import { CampaignDeliverablesService } from '../../../core/campaigns/campaign-deliverables.service';
import { CampaignsService } from '../../../core/campaigns/campaigns.service';
import { CreatorsService } from '../../../core/creators/creators.service';
import { Campaign } from '../../../core/campaigns/campaign.types';
import { CampaignDeliverable } from '../../../core/campaigns/campaign-deliverables.types';
import { W2Response } from '../../../core/simulation/simulation-w2.types';

function dlv(over: Partial<CampaignDeliverable> = {}): CampaignDeliverable {
  return {
    id: 'd1', campaignCreatorId: 'cc1', platform: 'YouTube', format: 'Integrated',
    quantity: 1, durationHours: null, agreedFee: null,
    actualImpressions: null, actualClicks: null, actualConversions: null,
    actualSpend: null, actualRevenue: null, deliveredAt: null,
    createdAt: '', updatedAt: '', ...over,
  };
}

const band = (n: number) => ({
  conservative: Math.round(n * 0.68),
  expected: n,
  optimistic: Math.round(n * 1.42),
});

/** A W2-era saved forecast — version-stamped, so the debrief takes the new path. */
function w2Forecast(over: Partial<W2Response> = {}): W2Response {
  return {
    mode: 'campaign', budget: 50_000, genre: 'Gaming & Esports', subMode: '', objectives: [],
    model: {
      version: 'w2-2026-08',
      params: { T: 0.35, k_youtube: 1.6, k_twitch: 2.5 },
      generatedAt: '2026-08-26T00:00:00.000Z',
    },
    bench: { ctrBase: 2, cvrBase: 0.5, engBase: 4 },
    creators: [{
      id: '7', name: 'C7', primaryPlatform: 'YouTube', gfi: 75, reachable: true, engagementRate: 3,
      cost: 40_000, forecastableCost: 40_000,
      impressions: 90, uniqueReach: 72, engagedClicks: 3, conversions: 1,
      costPerConversion: 40_000, reachUpperBound: false,
      deliverables: [],
    }],
    platforms: [],
    totals: {
      impressions: 100, engagedClicks: 4,
      uniqueReach: { value: 80, upperBound: true },
      conversions: { value: 2, upperBound: true },
      cost: 40_000, forecastableCost: 40_000, costPerConversion: 20_000,
      band: {
        impressions: band(100),
        uniqueReach: { ...band(80), upperBound: true },
        engagedClicks: band(4),
        conversions: { ...band(2), upperBound: true },
      },
    },
    unallocated: 0, unallocatedMessage: null, zeroBudget: false, warnings: [],
    ...over,
  };
}

function mkCampaign(status: Campaign['status'], withForecast = true): Campaign {
  return {
    id: 'c1', createdBy: 'u', enterpriseId: null, status, name: 'Acme', client: null,
    genre: 'Gaming & Esports', budget: 50_000, notes: null, objectives: [], debriefNotes: null,
    forecast: withForecast ? {
      impressions: 100, ctr: 3.2, roas: 2.4, cvr: 1.8,
      p10: { impressions: 68, ctr: 2.2, roas: 1.6 },
      p50: { impressions: 100, ctr: 3.2, roas: 2.4 },
      p90: { impressions: 142, ctr: 4.5, roas: 3.4 },
      creatorBreakdowns: [{ id: 7, impressions: 90, clicks: 3, conversions: 1, spend: 40000, revenue: 96000 }],
    } : null,
    startedAt: null, completedAt: null, createdAt: '', updatedAt: '',
  };
}

function ccRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cc1', campaignId: 'c1', creatorId: 7, status: 'confirmed', source: 'manual', format: 'Integrated',
    contactEmail: null, contactHandle: null, notes: null, lastContactAt: null, rateEstimate: null, cpiAtAdd: null,
    actualImpressions: null, actualClicks: null, actualConversions: null, actualSpend: null, actualRevenue: null,
    debriefNotes: null, addedAt: '', updatedAt: '', ...overrides,
  };
}

function setup(
  campaign: Campaign,
  records = signal<any[]>([ccRecord()]),
  deliverables: CampaignDeliverable[] = [],
) {
  const updateActuals = vi.fn().mockResolvedValue(null);
  const updateDebriefNotes = vi.fn().mockResolvedValue(null);
  const update = vi.fn().mockResolvedValue(campaign);
  const dRecords = signal<CampaignDeliverable[]>(deliverables);
  const byCampaignCreator = computed(() => {
    const m = new Map<string, CampaignDeliverable[]>();
    for (const d of dRecords()) m.set(d.campaignCreatorId, [...(m.get(d.campaignCreatorId) ?? []), d]);
    return m;
  });
  const updateDeliverableActuals = vi.fn().mockResolvedValue(null);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [SectionResultsComponent],
    providers: [
      { provide: CampaignCreatorsService, useValue: { records, updateActuals, updateDebriefNotes } },
      { provide: CampaignDeliverablesService, useValue: { records: dRecords, byCampaignCreator, updateActuals: updateDeliverableActuals } },
      { provide: CampaignsService, useValue: { update } },
      { provide: CreatorsService, useValue: { byIds: vi.fn(async (ids: number[]) => ids.map((id) => ({ id, name: `C${id}` }))) } },
    ],
  });
  const f = TestBed.createComponent(SectionResultsComponent);
  f.componentRef.setInput('campaign', campaign);
  return { f, updateActuals, updateDebriefNotes, update, updateDeliverableActuals };
}

describe('SectionResultsComponent', () => {
  it('completed: debrief shows delta and in-band hit for a summed actual', async () => {
    const { f } = setup(mkCampaign('completed'), signal<any[]>([ccRecord({ actualImpressions: 90 })]));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const row = f.nativeElement.querySelector('[data-testid="debrief-row-impressions"]');
    expect(row.textContent).toContain('-10%');            // (90/100 - 1)*100
    expect(f.nativeElement.querySelector('[data-testid="debrief-band-impressions"]').textContent).toContain('✓');
  });

  it('partial revenue: headline ROAS is hidden with a hint', async () => {
    const { f } = setup(mkCampaign('completed'), signal<any[]>([ccRecord({ actualSpend: 40000, actualRevenue: null })]));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="results-roas-hint"]')).toBeTruthy();
    const roasRow = f.nativeElement.querySelector('[data-testid="debrief-row-roas"]');
    expect(roasRow.querySelector('[data-testid="debrief-actual-roas"]').textContent).toContain('—');
  });

  it('no forecast: shows the no-forecast note, still renders entry inputs', async () => {
    const { f } = setup(mkCampaign('completed', false));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="results-no-forecast"]')).toBeTruthy();
    expect(f.nativeElement.querySelector('[data-testid="actual-actualConversions-cc1"]')).toBeTruthy();
  });

  it('active: entering an actual calls updateActuals; archived is read-only', async () => {
    const { f, updateActuals } = setup(mkCampaign('active'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const input: HTMLInputElement = f.nativeElement.querySelector('[data-testid="actual-actualConversions-cc1"]');
    expect(input.readOnly).toBe(false);
    input.value = '35';
    input.dispatchEvent(new Event('blur'));
    await f.whenStable();
    expect(updateActuals).toHaveBeenCalledWith('cc1', { actualConversions: 35 });

    const archived = setup(mkCampaign('archived'));
    archived.f.detectChanges(); await archived.f.whenStable(); archived.f.detectChanges();
    expect((archived.f.nativeElement.querySelector('[data-testid="actual-actualConversions-cc1"]') as HTMLInputElement).readOnly).toBe(true);
  });

  it('editing the campaign debrief note calls CampaignsService.update', async () => {
    const { f, update } = setup(mkCampaign('completed'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const note: HTMLTextAreaElement = f.nativeElement.querySelector('[data-testid="campaign-debrief-note"]');
    note.value = 'EMEA underperformed';
    note.dispatchEvent(new Event('blur'));
    await f.whenStable();
    expect(update).toHaveBeenCalledWith('c1', { debriefNotes: 'EMEA underperformed' });
  });

  it('populates the per-creator forecast column from a saved breakdown', () => {
    const { f } = setup(mkCampaign('completed'));
    f.detectChanges();
    const el: HTMLElement = f.nativeElement.querySelector('[data-testid="creator-forecast"]');
    expect(el).toBeTruthy();
    expect(el.textContent).toContain('90');       // forecast impressions for creator 7
    expect(el.textContent).toContain('40,000');   // forecast spend
    expect(el.textContent).toContain('96,000');   // forecast revenue
  });

  it('omits the per-creator forecast line when the saved breakdown id does not match the roster', () => {
    const campaign = mkCampaign('completed');
    // Same shape as a real saved forecast, but the breakdown's id (999) has no
    // matching creatorId in the roster (ccRecord() defaults to creatorId 7) –
    // this is the id-mismatch regression the string/number fix guards against.
    const forecast = { ...campaign.forecast!,
      creatorBreakdowns: [{ id: 999, impressions: 90, clicks: 3, conversions: 1, spend: 40000, revenue: 96000 }] };
    const { f } = setup({ ...campaign, forecast });
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="creator-forecast"]')).toBeNull();
  });

  it('populates the per-creator forecast column from a legacy forecast with a string breakdown id', () => {
    const campaign = mkCampaign('completed');
    // Forecasts saved before 2026-08-09 persisted the edge fn's echoed string
    // id verbatim (e.g. "7") rather than the numeric creatorId. The read path
    // must coerce it, or every pre-existing campaign's debrief column is blank.
    const forecast = { ...campaign.forecast!,
      creatorBreakdowns: [{ id: '7' as unknown as number, impressions: 90, clicks: 3, conversions: 1, spend: 40000, revenue: 96000 }] };
    const { f } = setup({ ...campaign, forecast });
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="creator-forecast"]')).toBeTruthy();
  });
});

// ── W2 forecasts (spec §8) ────────────────────────────────────────────
// Saved forecasts are records: legacy payloads keep the path above, W2
// payloads (a `model.version` stamp) get the new one. Nothing is migrated.

describe('SectionResultsComponent — W2 forecasts', () => {
  it('renders the W2 debrief table, not the legacy one', async () => {
    const { f } = setup({ ...mkCampaign('completed'), forecast: w2Forecast() },
      signal<any[]>([ccRecord({ actualImpressions: 90 })]));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="debrief-w2-row-impressions"]')).toBeTruthy();
    expect(f.nativeElement.querySelector('[data-testid="debrief-row-impressions"]')).toBeNull();
    expect(f.nativeElement.querySelector('[data-testid="results-no-forecast"]')).toBeNull();
  });

  it('compares actuals to the expected value and flags the Conservative–Optimistic band', async () => {
    const { f } = setup({ ...mkCampaign('completed'), forecast: w2Forecast() },
      signal<any[]>([ccRecord({ actualImpressions: 90 })]));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const row = f.nativeElement.querySelector('[data-testid="debrief-w2-row-impressions"]');
    expect(row.textContent).toContain('-10%');   // (90/100 - 1) × 100
    expect(f.nativeElement.querySelector('[data-testid="debrief-w2-band-impressions"]').textContent).toContain('✓');
  });

  it('grades conversions and engagement clicks, never ROAS', async () => {
    const { f } = setup({ ...mkCampaign('completed'), forecast: w2Forecast() },
      signal<any[]>([ccRecord({ actualClicks: 4, actualConversions: 2, actualSpend: 40_000 })]));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('[data-testid="debrief-w2-row-engagedClicks"]')!.textContent!.toLowerCase())
      .toContain('engagement clicks');
    expect(el.querySelector('[data-testid="debrief-w2-row-conversions"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="debrief-w2-row-spend"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="debrief-w2-row-roas"]')).toBeNull();
    expect(el.querySelector('[data-testid="results-roas-hint"]')).toBeNull();
  });

  it('reports cost per conversion for both forecast and actual', async () => {
    const { f } = setup({ ...mkCampaign('completed'), forecast: w2Forecast() },
      signal<any[]>([ccRecord({ actualConversions: 2, actualSpend: 30_000 })]));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const row = f.nativeElement.querySelector('[data-testid="debrief-w2-row-costPerConversion"]');
    expect(row.textContent).toContain('20,000');   // forecast: $40,000 / 2
    expect(f.nativeElement.querySelector('[data-testid="debrief-w2-actual-costPerConversion"]').textContent)
      .toContain('15,000');                        // actual:   $30,000 / 2
  });

  it('populates the per-creator forecast column from creators[]', async () => {
    const { f } = setup({ ...mkCampaign('completed'), forecast: w2Forecast() });
    f.detectChanges();
    const el: HTMLElement = f.nativeElement.querySelector('[data-testid="creator-forecast-w2"]');
    expect(el).toBeTruthy();
    expect(el.textContent).toContain('90');       // impressions
    expect(el.textContent).toContain('3');        // engagement clicks
    expect(el.textContent).toContain('40,000');   // cost
    // Revenue was a ROAS-era field — it is not forecast any more.
    expect(f.nativeElement.querySelector('[data-testid="creator-forecast"]')).toBeNull();
  });

  it('omits the per-creator line when the W2 creator id has no roster match', async () => {
    const forecast = w2Forecast();
    forecast.creators[0].id = '999';
    const { f } = setup({ ...mkCampaign('completed'), forecast });
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="creator-forecast-w2"]')).toBeNull();
  });

  it('still records actuals normally under a W2 forecast', async () => {
    const { f, updateActuals } = setup({ ...mkCampaign('active'), forecast: w2Forecast() });
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const input: HTMLInputElement = f.nativeElement.querySelector('[data-testid="actual-actualConversions-cc1"]');
    input.value = '35';
    input.dispatchEvent(new Event('blur'));
    await f.whenStable();
    expect(updateActuals).toHaveBeenCalledWith('cc1', { actualConversions: 35 });
  });
});

describe('SectionResultsComponent — W2 delta polarity and excluded creators', () => {
  it('colors a worse cost per conversion as a miss and a better one as a win', async () => {
    // Forecast CPC is $20,000 ($40,000 / 2 conversions). Overspending per
    // conversion is bad news, so a positive delta must NOT read green.
    const worse = setup({ ...mkCampaign('completed'), forecast: w2Forecast() },
      signal<any[]>([ccRecord({ actualConversions: 2, actualSpend: 60_000 })]));  // $30,000 CPC, +50%
    worse.f.detectChanges(); await worse.f.whenStable(); worse.f.detectChanges();
    const worseCell = worse.f.nativeElement
      .querySelector('[data-testid="debrief-w2-delta-costPerConversion"]') as HTMLElement;
    expect(worseCell.textContent).toContain('+50%');
    expect(worseCell.style.color).toContain('color-sf-orange');

    const better = setup({ ...mkCampaign('completed'), forecast: w2Forecast() },
      signal<any[]>([ccRecord({ actualConversions: 2, actualSpend: 20_000 })]));  // $10,000 CPC, -50%
    better.f.detectChanges(); await better.f.whenStable(); better.f.detectChanges();
    const betterCell = better.f.nativeElement
      .querySelector('[data-testid="debrief-w2-delta-costPerConversion"]') as HTMLElement;
    expect(betterCell.textContent).toContain('-50%');
    expect(betterCell.style.color).toContain('color-sf-green');
  });

  it('colors overspend as a miss, while more impressions than forecast stays a win', async () => {
    const { f } = setup({ ...mkCampaign('completed'), forecast: w2Forecast() },
      signal<any[]>([ccRecord({ actualImpressions: 120, actualSpend: 60_000 })]));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const spend = f.nativeElement.querySelector('[data-testid="debrief-w2-delta-spend"]') as HTMLElement;
    expect(spend.textContent).toContain('+50%');
    expect(spend.style.color).toContain('color-sf-orange');
    const impressions = f.nativeElement.querySelector('[data-testid="debrief-w2-delta-impressions"]') as HTMLElement;
    expect(impressions.textContent).toContain('+20%');
    expect(impressions.style.color).toContain('color-sf-green');
  });

  it('badges a creator the budget never covered instead of showing it as forecast', async () => {
    const forecast = w2Forecast();
    forecast.creators[0].reachable = false;
    const { f } = setup({ ...mkCampaign('completed'), forecast });
    f.detectChanges();
    const badge = f.nativeElement.querySelector('[data-testid="creator-forecast-w2-excluded"]');
    expect(badge).toBeTruthy();
    expect(badge.textContent.toLowerCase()).toContain('excluded from the totals');
  });

  it('shows no excluded badge for a funded creator', async () => {
    const { f } = setup({ ...mkCampaign('completed'), forecast: w2Forecast() });
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="creator-forecast-w2"]')).toBeTruthy();
    expect(f.nativeElement.querySelector('[data-testid="creator-forecast-w2-excluded"]')).toBeNull();
  });
});

describe('SectionResultsComponent — per-deliverable actuals', () => {
  it('renders deliverable rows with impr/clicks/date inputs and a creator row with only conv/spend/revenue inputs', async () => {
    const { f } = setup(mkCampaign('completed'), signal<any[]>([ccRecord()]), [dlv({ id: 'd1' })]);
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="actual-d-impressions-d1"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="actual-d-clicks-d1"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="actual-d-delivered-d1"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="actual-actualConversions-cc1"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="actual-actualSpend-cc1"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="actual-actualRevenue-cc1"]')).toBeTruthy();
    // impressions/clicks are no longer creator-level inputs
    expect(el.querySelector('[data-testid="actual-actualImpressions-cc1"]')).toBeNull();
    expect(el.querySelector('[data-testid="actual-actualClicks-cc1"]')).toBeNull();
  });

  it('deliverable input blur calls deliverables.updateActuals with the parsed value', async () => {
    const { f, updateDeliverableActuals } = setup(mkCampaign('completed'), signal<any[]>([ccRecord()]), [dlv({ id: 'd1' })]);
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const input = f.nativeElement.querySelector('[data-testid="actual-d-impressions-d1"]') as HTMLInputElement;
    input.value = '12000';
    input.dispatchEvent(new Event('blur'));
    await f.whenStable();
    expect(updateDeliverableActuals).toHaveBeenCalledWith('d1', { actualImpressions: 12000 });
  });

  it('headline uses deliverable-grain impressions over legacy creator-level (per-measure rule)', async () => {
    const { f } = setup(
      mkCampaign('completed'),
      signal<any[]>([ccRecord({ actualImpressions: 999 })]),
      [dlv({ id: 'd1', actualImpressions: 90 })],
    );
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const row = f.nativeElement.querySelector('[data-testid="debrief-row-impressions"]');
    expect(row.textContent).toContain('-10%'); // 90 vs forecast 100, not 999
  });

  it('platform table renders per-platform cost per conversion for a single-platform creator', async () => {
    const { f } = setup(
      mkCampaign('completed'),
      signal<any[]>([ccRecord({ actualConversions: 30, actualSpend: 8000 })]),
      [dlv({ id: 'd1', platform: 'Twitch', format: 'Dedicated', actualImpressions: 20000, actualClicks: 400 })],
    );
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const table = f.nativeElement.querySelector('[data-testid="results-platform-table"]') as HTMLElement;
    expect(table).toBeTruthy();
    expect(table.textContent).toContain('Twitch');
    expect(table.textContent).toContain('266.67'); // 8000 / 30
    expect(f.nativeElement.querySelector('[data-testid="results-unattributed-note"]')).toBeNull();
  });

  it('multi-platform creator with creator-level conversions shows the unattributed note', async () => {
    const { f } = setup(
      mkCampaign('completed'),
      signal<any[]>([ccRecord({ actualConversions: 50 })]),
      [
        dlv({ id: 'd1', platform: 'YouTube', actualImpressions: 1000 }),
        dlv({ id: 'd2', platform: 'Twitch', format: 'Dedicated', actualImpressions: 600 }),
      ],
    );
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="results-unattributed-note"]')).toBeTruthy();
  });

  it('legacy campaign (creator-level only, no deliverable actuals) renders the old numbers via fallback', async () => {
    const { f } = setup(mkCampaign('completed'), signal<any[]>([ccRecord({ actualImpressions: 90 })]), [dlv({ id: 'd1' })]);
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const row = f.nativeElement.querySelector('[data-testid="debrief-row-impressions"]');
    expect(row.textContent).toContain('-10%'); // legacy 90 still read through fallback
  });
});
