import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import { SimulatorComponent } from './simulator.component';
import { AuthService } from '../../core/auth/auth.service';
import { SelectionService } from '../../core/selection/selection.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { EdgeClient } from '../../core/api/edge.client';
import { RateLimitService } from '../../core/simulation/rate-limit.service';
import { CampaignsRepository } from '../../core/campaigns/campaigns.repository';
import { CampaignCreatorsRepository } from '../../core/campaigns/campaign-creators.repository';
import { CreatorProfileService } from '../../core/creator-profile/creator-profile.service';
import { Creator } from '../../core/data/creator.types';
import { Campaign } from '../../core/campaigns/campaign.types';
import { W2Response } from '../../core/simulation/simulation-w2.types';

function mkCreator(id: number): Creator {
  return {
    id,
    name: `Creator ${id}`,
    handle: `@c${id}`,
    platform: 'YouTube',
    allPlatforms: ['YouTube'],
    subs: '100K',
    subsParsed: 100_000,
    avgViews: '20K',
    eng: '3.0%',
    genre: 'Gaming & Esports',
    cpi: 80,
    gfi: 75,
    color: '#fff',
    verifiedDeals: 2,
    sponsorHistory: [],
    bio: 'bio',
    ytStats: { subscriberCount: 100_000, avgViews: 20_000, engagementRate: 3, sponsorFreqPct: 5, statsRefreshedAt: null },
  };
}

const band = (n: number) => ({
  conservative: Math.round(n * 0.68),
  expected: n,
  optimistic: Math.round(n * 1.42),
});

/** A minimal but complete W2 response — the only shape the panel accepts now. */
function w2(over: Partial<W2Response> = {}): W2Response {
  return {
    mode: 'free', budget: 85_000, genre: 'Gaming & Esports', subMode: '', objectives: [],
    model: {
      version: 'w2-2026-08',
      params: { T: 0.35, k_youtube: 1.6, k_twitch: 2.5 },
      generatedAt: '2026-08-26T00:00:00.000Z',
    },
    bench: { ctrBase: 2, cvrBase: 0.5, engBase: 4 },
    creators: [
      {
        id: '2', name: 'Creator 2', primaryPlatform: 'YouTube', gfi: 75, reachable: true,
        engagementRate: 3, cost: 6_000, forecastableCost: 6_000,
        impressions: 40_000, uniqueReach: 32_000, engagedClicks: 960, conversions: 288,
        costPerConversion: 20.8, reachUpperBound: false,
        deliverables: [{
          creatorId: '2', platform: 'YouTube', format: 'Integrated', quantity: 2, durationHours: null,
          reach: 20_000, cpi: 80, cpiSubstituted: false, gfi: 75, noData: false, ctr: 2.4, cvr: 0.9,
          impressions: 40_000, uniqueReach: 32_000, engagedClicks: 960, conversions: 288,
          d60: { impressions: 52_000, uniqueReach: 41_600, engagedClicks: 1_248, conversions: 374 },
          d90: { impressions: 58_000, uniqueReach: 46_400, engagedClicks: 1_392, conversions: 417 },
          band: { impressions: band(40_000), uniqueReach: band(32_000), engagedClicks: band(960), conversions: band(288) },
          cost: 6_000, costSource: 'estimated', bandBreach: null, rateRange: [4_000, 8_000],
          costPerConversion: 20.8,
        }],
      },
    ],
    platforms: [{
      platform: 'YouTube', impressions: 40_000, uniqueReach: 32_000, engagedClicks: 960,
      conversions: 288, cost: 6_000, costPerConversion: 20.8,
      band: { impressions: band(40_000), uniqueReach: band(32_000), engagedClicks: band(960), conversions: band(288) },
    }],
    totals: {
      impressions: 40_000, engagedClicks: 960,
      uniqueReach: { value: 32_000, upperBound: true },
      conversions: { value: 288, upperBound: true },
      cost: 6_000, forecastableCost: 6_000, costPerConversion: 20.8,
      band: {
        impressions: band(40_000),
        uniqueReach: { ...band(32_000), upperBound: true },
        engagedClicks: band(960),
        conversions: { ...band(288), upperBound: true },
      },
    },
    unallocated: 0, unallocatedMessage: null, zeroBudget: false, warnings: [],
    ...over,
  };
}

function setup({ selectedIds = [] as number[], tier = 'silver' } = {}) {
  localStorage.clear();
  sessionStorage.clear();

  const tierSignal = signal(tier);
  const authStub = {
    tier: tierSignal,
    user: () => null,
    isAuthenticated: () => true,
    enterpriseId: () => null,
    enterprise: () => null,
  };

  const post = vi.fn().mockResolvedValue(w2());
  const edgeStub = { post, get: vi.fn() } as unknown as EdgeClient;

  // Creator data loads server-side via CreatorsService.byIds (async), wrapped in
  // a resource() inside the component. Stub it so seeding the SelectionService
  // with ids resolves to full Creator objects.
  const byIds = vi.fn(async (ids: Iterable<number>) => Array.from(ids, (id) => mkCreator(id)));
  const creatorsStub = {
    byIds,
    genres: signal(['Gaming & Esports', 'Music']),
    platforms: signal(['YouTube', 'Twitch']),
    languages: signal(['English']),
  };

  const campaignsRepoStub = {
    list: vi.fn().mockResolvedValue([]),
    byId: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  } as unknown as CampaignsRepository;

  const campaignCreatorsRepoStub = {
    listFor: vi.fn().mockResolvedValue([]),
    add: vi.fn(),
  } as unknown as CampaignCreatorsRepository;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [SimulatorComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authStub },
      { provide: CreatorsService, useValue: creatorsStub },
      { provide: EdgeClient, useValue: edgeStub },
      { provide: CampaignsRepository, useValue: campaignsRepoStub },
      { provide: CampaignCreatorsRepository, useValue: campaignCreatorsRepoStub },
    ],
  });

  const selection = TestBed.inject(SelectionService);
  for (const id of selectedIds) selection.add(id);

  return { post, selection, tier: tierSignal, campaignsRepoStub, campaignCreatorsRepoStub };
}

/** Create, hydrate the creator resource, and settle. */
async function mounted(opts?: Parameters<typeof setup>[0]) {
  const ctx = setup(opts);
  const f = TestBed.createComponent(SimulatorComponent);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  return { ...ctx, f, el: f.nativeElement as HTMLElement };
}

describe('SimulatorComponent', () => {
  it('shows empty state when no creators are selected', () => {
    setup({ selectedIds: [] });
    const f = TestBed.createComponent(SimulatorComponent);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-empty"]')).toBeTruthy();
    expect(f.nativeElement.querySelector('[data-testid="simw2-controls"]')).toBeNull();
  });

  it('renders controls + objectives + run button when creators are selected', async () => {
    const { el } = await mounted({ selectedIds: [2, 14] });
    expect(el.querySelector('[data-testid="simw2-controls"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="simw2-objectives"]')).toBeTruthy();
    const runBtn = el.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement;
    expect(runBtn).toBeTruthy();
    expect(runBtn.disabled).toBe(false);
  });

  it('runs in free mode: sends the selected ids and renders the W2 forecast', async () => {
    const { f, el, post } = await mounted({ selectedIds: [2, 14] });
    (el.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).click();
    await f.whenStable();
    f.detectChanges();

    expect(post).toHaveBeenCalledOnce();
    const body = post.mock.calls[0][1] as Record<string, unknown>;
    expect(body['mode']).toBe('free');
    expect(body['creators']).toEqual([{ id: 2 }, { id: 14 }]);
    expect(body['budget']).toBe(85_000);

    expect(el.querySelector('[data-testid="simw2-results"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="simw2-total-impressions"]')!.textContent).toContain('40,000');
    expect(TestBed.inject(RateLimitService).read()).toBe(1);
    expect((el.querySelector('[data-testid="sim-save"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('saves a campaign + roster but never persists the free-mode forecast', async () => {
    const { f, el, campaignsRepoStub, campaignCreatorsRepoStub } = await mounted({ selectedIds: [2, 14] });
    // saveToCampaigns() navigates to the new campaign's detail page after
    // saving; this suite doesn't register app routes, so stub navigate.
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const created: Campaign = {
      id: 'new-camp', createdBy: 'u', enterpriseId: null, status: 'planning',
      name: 'x', client: null, genre: 'Gaming & Esports', budget: 85_000, notes: null, objectives: [],
      forecast: null, debriefNotes: null, startedAt: null, completedAt: null, createdAt: '', updatedAt: '',
    };
    (campaignsRepoStub.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    (el.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    (el.querySelector('[data-testid="sim-save"]') as HTMLButtonElement).click();
    await f.whenStable();

    // The campaign and its roster are created – each roster add seeds that
    // creator's default deliverable (W1), so the new campaign is forecastable
    // from its own panel straight away.
    expect(campaignsRepoStub.create as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();
    const addCalls = (campaignCreatorsRepoStub.add as ReturnType<typeof vi.fn>).mock.calls;
    expect(addCalls.map((c) => c[0].creatorId).sort((a: number, b: number) => a - b)).toEqual([2, 14]);
    expect(navigate).toHaveBeenCalledWith(['/app/campaigns', 'new-camp']);

    // The free run itself is NOT persisted (spec §1): it priced against
    // synthesised default deliverables at rate-band midpoints, so keeping it as
    // the campaign's baseline would grade the campaign against numbers it was
    // never planned on. The campaign forecast panel is the only writer of
    // campaigns.forecast.
    expect(campaignsRepoStub.update as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('surfaces a failed run instead of leaving an empty forecast on screen', async () => {
    const { f, el, post } = await mounted({ selectedIds: [2] });
    post.mockRejectedValueOnce(new Error('run-simulation is down'));
    (el.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    expect(el.querySelector('[data-testid="simw2-error"]')!.textContent).toContain('run-simulation is down');
    expect(el.querySelector('[data-testid="simw2-results"]')).toBeNull();
    expect((el.querySelector('[data-testid="sim-save"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('drops the held forecast when a re-run fails, so Save cannot persist a stale one', async () => {
    const { f, el, post } = await mounted({ selectedIds: [2] });
    (el.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    expect((el.querySelector('[data-testid="sim-save"]') as HTMLButtonElement).disabled).toBe(false);

    // HttpErrorResponse shape — what HttpClient actually rejects with.
    post.mockRejectedValue({ name: 'HttpErrorResponse', status: 500, error: { error: 'boom' }, message: 'Http failure response: 500' });
    (el.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();

    expect(el.querySelector('[data-testid="simw2-results"]')).toBeNull();
    expect((el.querySelector('[data-testid="sim-save"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('free tier hitting limit disables the run button and shows banner', async () => {
    setup({ selectedIds: [2], tier: 'free' });
    const rate = TestBed.inject(RateLimitService);
    rate.increment(); rate.increment(); rate.increment();

    const f = TestBed.createComponent(SimulatorComponent);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();

    expect((f.nativeElement.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).disabled).toBe(true);
    expect(f.nativeElement.querySelector('[data-testid="simw2-rate-limit"]')).toBeTruthy();
  });

  it('gold tier has no rate-limit indicator and no blocking', () => {
    setup({ selectedIds: [2], tier: 'gold' });
    const f = TestBed.createComponent(SimulatorComponent);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="simw2-rate-usage"]')).toBeNull();
    expect(f.nativeElement.querySelector('[data-testid="simw2-rate-limit"]')).toBeNull();
  });

  it('toggling an objective updates the selected set', async () => {
    const { f, el } = await mounted({ selectedIds: [2] });
    const btn = el.querySelector('[data-testid="simw2-obj-sales"]') as HTMLButtonElement;
    btn.click();
    f.detectChanges();
    expect(btn.style.background).toContain('color-sf-blue');
  });

  it('renders clickable selected-creator chips that open the profile modal', async () => {
    const { el } = await mounted({ selectedIds: [2, 14] });
    expect(el.querySelector('[data-testid="sim-selected"]')).toBeTruthy();
    const chips = el.querySelectorAll('[data-testid="sim-selected-chip"]');
    expect(chips.length).toBe(2);

    const openSpy = vi
      .spyOn(TestBed.inject(CreatorProfileService), 'open')
      .mockImplementation(() => {});
    (chips[0] as HTMLButtonElement).click();
    expect(openSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });
});
