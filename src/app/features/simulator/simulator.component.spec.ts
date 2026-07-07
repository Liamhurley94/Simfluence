import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SimulatorComponent } from './simulator.component';
import { AuthService } from '../../core/auth/auth.service';
import { SelectionService } from '../../core/selection/selection.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { EdgeClient } from '../../core/api/edge.client';
import { RateLimitService } from '../../core/simulation/rate-limit.service';
import { CampaignsRepository } from '../../core/campaigns/campaigns.repository';
import { CreatorProfileService } from '../../core/creator-profile/creator-profile.service';
import { Creator } from '../../core/data/creator.types';

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

  const post = vi.fn().mockResolvedValue({ error: 'no server in tests' });
  const edgeStub = { post, get: vi.fn() } as unknown as EdgeClient;

  // Creator data now loads server-side via CreatorsService.byIds (async),
  // wrapped in a resource() inside the component. Stub it so seeding the
  // SelectionService with ids resolves to full Creator objects.
  const byIds = vi.fn(async (ids: Iterable<number>) =>
    Array.from(ids, (id) => mkCreator(id)),
  );
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

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [SimulatorComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authStub },
      { provide: CreatorsService, useValue: creatorsStub },
      { provide: EdgeClient, useValue: edgeStub },
      { provide: CampaignsRepository, useValue: campaignsRepoStub },
    ],
  });

  const selection = TestBed.inject(SelectionService);
  for (const id of selectedIds) selection.add(id);

  return { post, selection, tier: tierSignal };
}

describe('SimulatorComponent', () => {
  beforeEach(() => {
    /* noop */
  });

  it('shows empty state when no creators are selected', () => {
    setup({ selectedIds: [] });
    const fixture = TestBed.createComponent(SimulatorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-empty"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-controls"]')).toBeNull();
  });

  it('renders controls + objectives + run button when creators are selected', async () => {
    setup({ selectedIds: [2, 14] });
    const fixture = TestBed.createComponent(SimulatorComponent);
    fixture.detectChanges();
    // CreatorsService.byIds is async (server-backed); let the resource() resolve.
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-controls"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-objectives"]')).toBeTruthy();
    const runBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="sim-run"]');
    expect(runBtn).toBeTruthy();
    expect(runBtn.disabled).toBe(false);
  });

  it('clicking run renders the server result bands and increments rate limit', async () => {
    const { post } = setup({ selectedIds: [2, 14] });
    // The simulator is server-only (the local-compute fallback was removed — sim
    // math is IP). Bands render only when the edge fn returns a result.
    post.mockResolvedValueOnce({
      impressions: 100,
      ctr: 2,
      cpM: 6,
      cvr: 0.5,
      conversions: 1,
      roas: 0.1,
      roasRange: '0.1–0.4×',
      engRate: 3,
      clicks: 2,
      budget: 85_000,
      bench: { ctrBase: 2, cpmBase: 8, cvrBase: 0.5, roasBase: 2, engBase: 4 },
      p10: { impressions: 68, ctr: 1.3, roas: 0.07 },
      p50: { impressions: 100, ctr: 2, roas: 0.1 },
      p90: { impressions: 142, ctr: 2.8, roas: 0.15 },
    });

    const fixture = TestBed.createComponent(SimulatorComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const runBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="sim-run"]');
    runBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="sim-bands"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-p10"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-p50"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-p90"]')).toBeTruthy();
    expect(post).toHaveBeenCalledOnce();

    const rateLimit = TestBed.inject(RateLimitService);
    expect(rateLimit.read()).toBe(1);

    const save: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="sim-save"]');
    expect(save.disabled).toBe(false);
  });

  it('free tier hitting limit disables the run button and shows banner', async () => {
    setup({ selectedIds: [2], tier: 'free' });
    const rate = TestBed.inject(RateLimitService);
    rate.increment();
    rate.increment();
    rate.increment();

    const fixture = TestBed.createComponent(SimulatorComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const runBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="sim-run"]');
    expect(runBtn.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="sim-rate-limit"]')).toBeTruthy();
  });

  it('gold tier has no rate-limit indicator and no blocking', () => {
    setup({ selectedIds: [2], tier: 'gold' });
    const fixture = TestBed.createComponent(SimulatorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-rate-usage"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-rate-limit"]')).toBeNull();
  });

  it('toggling an objective updates the selected set', async () => {
    setup({ selectedIds: [2] });
    const fixture = TestBed.createComponent(SimulatorComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="sim-obj-sales"]',
    );
    btn.click();
    fixture.detectChanges();
    // Style flips background — inspect the attr for the blue class indicator.
    expect(btn.style.background).toContain('color-sf-blue');
  });

  it('renders clickable selected-creator chips that open the profile modal', async () => {
    setup({ selectedIds: [2, 14] });
    const fixture = TestBed.createComponent(SimulatorComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="sim-selected"]')).toBeTruthy();
    const chips = fixture.nativeElement.querySelectorAll('[data-testid="sim-selected-chip"]');
    expect(chips.length).toBe(2);

    const openSpy = vi
      .spyOn(TestBed.inject(CreatorProfileService), 'open')
      .mockImplementation(() => {});
    (chips[0] as HTMLButtonElement).click();
    expect(openSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });
});
