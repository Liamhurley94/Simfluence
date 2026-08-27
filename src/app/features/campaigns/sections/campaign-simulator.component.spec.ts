// campaign-simulator.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { CampaignSimulatorComponent } from './campaign-simulator.component';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import { CreatorsService } from '../../../core/creators/creators.service';
import { CampaignsService } from '../../../core/campaigns/campaigns.service';
import { AuthService } from '../../../core/auth/auth.service';
import { EdgeClient } from '../../../core/api/edge.client';
import { Campaign, LegacyCampaignForecast } from '../../../core/campaigns/campaign.types';
import { Creator } from '../../../core/data/creator.types';
import { W2Response } from '../../../core/simulation/simulation-w2.types';

function mkCreator(id: number): Creator {
  return { id, name: `C${id}`, handle: `@c${id}`, platform: 'YouTube', allPlatforms: ['YouTube'],
    subs: '100K', subsParsed: 100_000, avgViews: '20K', eng: '3.0%', genre: 'Gaming & Esports',
    cpi: 80, gfi: 75, color: '#fff', verifiedDeals: 0, sponsorHistory: [], bio: '',
    ytStats: { subscriberCount: 100_000, avgViews: 20_000, engagementRate: 3, sponsorFreqPct: 5, statsRefreshedAt: null } };
}
function mkCampaign(status: Campaign['status'] = 'planning', objectives: string[] = []): Campaign {
  return { id: 'c1', createdBy: 'u', enterpriseId: null, status, name: 'Acme', client: null,
    genre: 'Gaming & Esports', budget: 50_000, notes: null, objectives, forecast: null, debriefNotes: null,
    startedAt: null, completedAt: null, createdAt: '', updatedAt: '' };
}

const band = (n: number) => ({
  conservative: Math.round(n * 0.68),
  expected: n,
  optimistic: Math.round(n * 1.42),
});

function w2(over: Partial<W2Response> = {}): W2Response {
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
      impressions: 90_000, uniqueReach: 72_000, engagedClicks: 2_160, conversions: 648,
      costPerConversion: 61.73, reachUpperBound: false,
      deliverables: [{
        creatorId: '7', platform: 'YouTube', format: 'Integrated', quantity: 3, durationHours: null,
        reach: 30_000, cpi: 80, cpiSubstituted: false, gfi: 75, noData: false, ctr: 2.4, cvr: 0.9,
        impressions: 90_000, uniqueReach: 72_000, engagedClicks: 2_160, conversions: 648,
        d60: { impressions: 117_000, uniqueReach: 93_600, engagedClicks: 2_808, conversions: 842 },
        d90: { impressions: 130_500, uniqueReach: 104_400, engagedClicks: 3_132, conversions: 940 },
        band: { impressions: band(90_000), uniqueReach: band(72_000), engagedClicks: band(2_160), conversions: band(648) },
        cost: 40_000, costSource: 'agreed', bandBreach: null, rateRange: [30_000, 45_000],
        costPerConversion: 61.73,
      }],
    }],
    platforms: [{
      platform: 'YouTube', impressions: 90_000, uniqueReach: 72_000, engagedClicks: 2_160,
      conversions: 648, cost: 40_000, costPerConversion: 61.73,
      band: { impressions: band(90_000), uniqueReach: band(72_000), engagedClicks: band(2_160), conversions: band(648) },
    }],
    totals: {
      impressions: 90_000, engagedClicks: 2_160,
      uniqueReach: { value: 72_000, upperBound: true },
      conversions: { value: 648, upperBound: true },
      cost: 40_000, forecastableCost: 40_000, costPerConversion: 61.73,
      band: {
        impressions: band(90_000),
        uniqueReach: { ...band(72_000), upperBound: true },
        engagedClicks: band(2_160),
        conversions: { ...band(648), upperBound: true },
      },
    },
    unallocated: 10_000, unallocatedMessage: 'This roster tops out at $40,000.',
    zeroBudget: false, warnings: [],
    ...over,
  };
}

/** A forecast saved before the rebuild — no `model.version`. */
const LEGACY_FORECAST: LegacyCampaignForecast = {
  impressions: 50, ctr: 1, roas: 0.2, cvr: 0.3,
  p10: { impressions: 40, ctr: 0.8, roas: 0.15 },
  p50: { impressions: 50, ctr: 1, roas: 0.2 },
  p90: { impressions: 60, ctr: 1.2, roas: 0.25 },
};

function setup(
  status: Campaign['status'] = 'planning',
  records = signal<any[]>([{ id: 'cc1', campaignId: 'c1', creatorId: 7, status: 'shortlisted', format: null }]),
) {
  localStorage.clear();
  const update = vi.fn().mockResolvedValue(mkCampaign(status));
  const post = vi.fn().mockResolvedValue(w2());
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CampaignSimulatorComponent],
    providers: [
      { provide: CampaignCreatorsService, useValue: { records } },
      { provide: CreatorsService, useValue: { byIds: vi.fn(async (ids: number[]) => ids.map(mkCreator)), genres: signal(['Gaming & Esports']) } },
      { provide: CampaignsService, useValue: { update } },
      { provide: AuthService, useValue: { tier: signal('silver') } },
      { provide: EdgeClient, useValue: { post, get: vi.fn() } },
    ],
  });
  return { update, post };
}

async function mounted(campaign: Campaign, status: Campaign['status'] = 'planning', records?: any) {
  const ctx = records ? setup(status, records) : setup(status);
  const f = TestBed.createComponent(CampaignSimulatorComponent);
  f.componentRef.setInput('campaign', campaign);
  f.detectChanges(); await f.whenStable(); f.detectChanges();
  return { ...ctx, f, el: f.nativeElement as HTMLElement };
}

describe('CampaignSimulatorComponent — campaign mode', () => {
  it('runs by campaign id, never by roster or budget', async () => {
    const { f, el, post } = await mounted(mkCampaign('planning'));
    (el.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    const body = post.mock.calls[0][1] as Record<string, unknown>;
    expect(body['mode']).toBe('campaign');
    expect(body['campaignId']).toBe('c1');
    expect(body).not.toHaveProperty('creators');
    expect(body).not.toHaveProperty('budget');
    expect(body).not.toHaveProperty('format');
  });

  it('renders no budget control and no per-creator format note — deliverables live in the roster editor', async () => {
    const { el } = await mounted(mkCampaign('planning'));
    expect(el.querySelector('[data-testid="simw2-budget"]')).toBeNull();
    expect(el.querySelector('[data-testid="forecast-format-default-note"]')).toBeNull();
  });

  it('renders the W2 forecast, including the unallocated advisory', async () => {
    const { f, el } = await mounted(mkCampaign('planning'));
    (el.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    expect(el.querySelector('[data-testid="simw2-total-impressions"]')!.textContent).toContain('90,000');
    expect(el.querySelector('[data-testid="simw2-unallocated-message"]')!.textContent)
      .toContain('This roster tops out at $40,000.');
  });

  it('forwards campaign.objectives to the panel as initialObjectives (chips selected)', async () => {
    const { el } = await mounted(mkCampaign('planning', ['Awareness', 'Sales']));
    const bg = (id: string) => (el.querySelector(`[data-testid="simw2-obj-${id}"]`) as HTMLElement).style.background;
    expect(bg('awareness')).toContain('color-sf-blue');
    expect(bg('sales')).toContain('color-sf-blue');
    expect(bg('engagement')).not.toContain('color-sf-blue');
  });

  it('active with no saved forecast: run and save are both available', async () => {
    const { f, el, update } = await mounted(mkCampaign('active'), 'active');
    (el.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    (el.querySelector('[data-testid="campaign-forecast-save"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    expect(el.querySelector('[data-testid="forecast-overwrite-confirm"]')).toBeNull();
    expect(update).toHaveBeenCalledWith('c1', expect.objectContaining({
      forecast: expect.objectContaining({ totals: expect.objectContaining({ impressions: 90_000 }) }),
    }));
  });

  it('completed with a saved forecast: run is available, Save is replaced by the locked note', async () => {
    const withForecast: Campaign = { ...mkCampaign('completed'), forecast: w2() };
    const { f, el, update } = await mounted(withForecast, 'completed');
    expect(el.querySelector('[data-testid="campaign-forecast-save"]')).toBeNull();
    expect(el.querySelector('[data-testid="forecast-save-locked-note"]')).toBeTruthy();
    (el.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    expect(el.querySelector('[data-testid="simw2-total-impressions"]')!.textContent).toContain('90,000');
    expect(update).not.toHaveBeenCalled();
  });

  it('planning: no locked note — overwrite stays possible via the confirm dialog', async () => {
    const withForecast: Campaign = { ...mkCampaign('planning'), forecast: LEGACY_FORECAST };
    const { el } = await mounted(withForecast);
    expect(el.querySelector('[data-testid="forecast-save-locked-note"]')).toBeNull();
    expect(el.querySelector('[data-testid="campaign-forecast-save"]')).toBeTruthy();
  });

  it('Save is projected into the panel actions row next to Run', async () => {
    const { el } = await mounted(mkCampaign('planning'));
    const actions = el.querySelector('[data-testid="simw2-actions"]') as HTMLElement;
    expect(actions).toBeTruthy();
    expect(actions.querySelector('[data-testid="campaign-forecast-save"]')).toBeTruthy();
  });
});

describe('CampaignSimulatorComponent — saving', () => {
  it('planning with no existing forecast: Save writes the whole W2 response directly', async () => {
    const { f, el, update } = await mounted(mkCampaign('planning'));
    (el.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    (el.querySelector('[data-testid="campaign-forecast-save"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();

    expect(el.querySelector('[data-testid="forecast-overwrite-confirm"]')).toBeNull();
    const saved = update.mock.calls.at(-1)![1].forecast;
    expect(saved.model.version).toBe('w2-2026-08');
    expect(saved.totals.impressions).toBe(90_000);
    expect(saved.creators[0].deliverables[0].costSource).toBe('agreed');
    // Everything D23 cut is gone from the record too.
    for (const cut of ['roas', 'aov', 'durationWeeks', 'p10', 'p50', 'p90']) {
      expect(saved).not.toHaveProperty(cut);
    }
  });

  it('drops the held forecast when a re-run fails, disabling Save', async () => {
    const { f, el, post } = await mounted(mkCampaign('planning'));
    (el.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    expect((el.querySelector('[data-testid="campaign-forecast-save"]') as HTMLButtonElement).disabled).toBe(false);

    post.mockRejectedValue({ name: 'HttpErrorResponse', status: 500, error: { error: 'boom' }, message: 'Http failure response: 500' });
    (el.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();

    expect(el.querySelector('[data-testid="simw2-results"]')).toBeNull();
    expect((el.querySelector('[data-testid="campaign-forecast-save"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('existing forecast: Save opens the confirm dialog and only updates on confirm', async () => {
    const withForecast: Campaign = { ...mkCampaign('planning'), forecast: LEGACY_FORECAST };
    const { f, el, update } = await mounted(withForecast);
    (el.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();

    (el.querySelector('[data-testid="campaign-forecast-save"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el.querySelector('[data-testid="forecast-overwrite-confirm"]')).toBeTruthy();
    expect(update).not.toHaveBeenCalled();

    (el.querySelector('[data-testid="forecast-overwrite-confirm-yes"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    expect(update).toHaveBeenCalledWith('c1', expect.objectContaining({
      forecast: expect.objectContaining({ totals: expect.objectContaining({ impressions: 90_000 }) }),
    }));
    expect(el.querySelector('[data-testid="forecast-overwrite-confirm"]')).toBeNull();
  });

  it('existing forecast: canceling the confirm dialog does not update', async () => {
    const withForecast: Campaign = { ...mkCampaign('planning'), forecast: LEGACY_FORECAST };
    const { f, el, update } = await mounted(withForecast);
    (el.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    (el.querySelector('[data-testid="campaign-forecast-save"]') as HTMLButtonElement).click();
    f.detectChanges();
    (el.querySelector('[data-testid="forecast-overwrite-confirm-cancel"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    expect(update).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="forecast-overwrite-confirm"]')).toBeNull();
  });
});

describe('CampaignSimulatorComponent — saved-forecast summary', () => {
  it('renders a saved W2 forecast without percentiles or ROAS', async () => {
    const saved: Campaign = { ...mkCampaign('planning'), forecast: w2() };
    const { el } = await mounted(saved);
    const summary = el.querySelector('[data-testid="campaign-forecast-summary-w2"]') as HTMLElement;
    expect(summary).toBeTruthy();
    expect(summary.textContent).toContain('90,000');
    expect(summary.textContent).toContain('648');
    expect(summary.textContent!.toLowerCase()).not.toContain('roas');
    expect(summary.textContent).not.toContain('P50');
    expect(el.querySelector('[data-testid="campaign-forecast-summary-legacy"]')).toBeNull();
  });

  it('still renders a legacy saved forecast through the old summary', async () => {
    const saved: Campaign = { ...mkCampaign('planning'), forecast: LEGACY_FORECAST };
    const { el } = await mounted(saved);
    const summary = el.querySelector('[data-testid="campaign-forecast-summary-legacy"]') as HTMLElement;
    expect(summary).toBeTruthy();
    expect(summary.textContent).toContain('P50');
    expect(summary.textContent).toContain('0.2×');
    expect(el.querySelector('[data-testid="campaign-forecast-summary-w2"]')).toBeNull();
  });
});
