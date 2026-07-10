import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DiscoveryComponent } from './discovery.component';
import { AuthService } from '../../core/auth/auth.service';
import { SelectionService } from '../../core/selection/selection.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { CampaignsRepository } from '../../core/campaigns/campaigns.repository';
import { CampaignContextService } from '../../core/context/campaign-context.service';
import { Creator, PagedCreators } from '../../core/data/creator.types';

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
    rates: { mix: [10_000, 40_000] },
  };
}

describe('DiscoveryComponent', () => {
  let router: { navigateByUrl: ReturnType<typeof vi.fn>; navigate: ReturnType<typeof vi.fn> };
  let tier: ReturnType<typeof signal<string>>;
  let listMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    router = {
      navigateByUrl: vi.fn().mockResolvedValue(true),
      navigate: vi.fn().mockResolvedValue(true),
    };
    tier = signal('free');

    // Creator listing now loads server-side via CreatorsService.list (async),
    // wrapped in a resource() inside the component. Stub it so the grid renders.
    const paged: PagedCreators = {
      creators: [mkCreator(1), mkCreator(2)],
      total: 2,
      pageCount: 1,
      page: 0,
    };
    listMock = vi.fn().mockResolvedValue(paged);
    const creatorsStub = {
      list: listMock,
      genres: signal(['Gaming & Esports', 'Music']),
      platforms: signal(['YouTube', 'Twitch']),
      languages: signal([{ code: 'en', name: 'English' }]),
      usedLanguages: signal([{ code: 'en', name: 'English' }]),
      submodesByGenre: signal<Record<string, { subMode: string; hasKeywords: boolean }[]>>({}),
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
      imports: [DiscoveryComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            tier,
            user: () => null,
            isAuthenticated: () => true,
            enterpriseId: () => null,
            enterprise: () => null,
          },
        },
        { provide: Router, useValue: router },
        { provide: CreatorsService, useValue: creatorsStub },
        { provide: CampaignsRepository, useValue: campaignsRepoStub },
      ],
    });
  });

  it('renders the filter panel, creator grid, and pagination', async () => {
    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
    // CreatorsService.list is async (server-backed); let the resource() resolve.
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-filter-panel')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="creator-grid"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-pagination')).toBeTruthy();
  });

  it('shows total creator count', () => {
    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
    const count = fixture.nativeElement.querySelector('[data-testid="results-count"]');
    expect(count.textContent).toMatch(/\d[\d,]* creators/);
  });

  it('selection bar appears once at least one creator is selected', () => {
    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="selection-bar"]')).toBeNull();

    const selection = TestBed.inject(SelectionService);
    selection.add(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="selection-bar"]')).toBeTruthy();
  });

  it('clear selection button empties the selection service', () => {
    const selection = TestBed.inject(SelectionService);
    selection.add(1);
    selection.add(2);

    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
    const clear: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="selection-clear"]',
    );
    clear.click();
    expect(selection.count()).toBe(0);
  });

  it('score-selected button routes to /app/scoring', () => {
    const selection = TestBed.inject(SelectionService);
    selection.add(1);

    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="selection-score"]',
    );
    btn.click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/scoring');
  });

  it('score-selected carries the active genre filter into the scoring context', () => {
    const selection = TestBed.inject(SelectionService);
    selection.add(1);
    const context = TestBed.inject(CampaignContextService);

    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();

    // User narrowed Discovery to Music before scoring their shortlist. Without
    // the carry-over, scoring defaults to 'Gaming & Esports' and these creators
    // would all floor at GFI 5 (no gaming affinity).
    fixture.componentInstance.onQuery({
      sort: 'cpi',
      format: 'Mixed',
      platform: 'All platforms',
      genre: 'Music',
    });

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="selection-score"]',
    );
    btn.click();

    expect(context.genre()).toBe('Music');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/scoring');
  });

  it('score-selected leaves the scoring genre untouched when no genre filter is set', () => {
    const selection = TestBed.inject(SelectionService);
    selection.add(1);
    const context = TestBed.inject(CampaignContextService);
    context.genre.set('Tech & Gadgets');

    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();

    // Discovery query has no genre (browsing "All genres") — don't clobber a
    // genre the user may have already chosen on the scoring screen.
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="selection-score"]',
    );
    btn.click();

    expect(context.genre()).toBe('Tech & Gadgets');
  });

  it('simulate-selected button routes to /app/simulator', () => {
    const selection = TestBed.inject(SelectionService);
    selection.add(1);

    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="selection-simulate"]',
    );
    btn.click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/simulator?run=1');
  });

  it('simulate-selected carries the active genre filter into the shared context', () => {
    const selection = TestBed.inject(SelectionService);
    selection.add(1);
    const context = TestBed.inject(CampaignContextService);

    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
    fixture.componentInstance.onQuery({
      sort: 'cpi',
      format: 'Mixed',
      platform: 'All platforms',
      genre: 'Music',
    });

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="selection-simulate"]',
    );
    btn.click();

    expect(context.genre()).toBe('Music');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/simulator?run=1');
  });

  it('free tier shows blurred rate labels on cards', async () => {
    tier.set('free');
    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const firstRate = fixture.nativeElement.querySelector('[data-testid="creator-rate"]');
    expect(firstRate?.classList.contains('blur-sm')).toBe(true);
  });

  it('silver+ tier shows unblurred rates', async () => {
    tier.set('silver');
    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const firstRate = fixture.nativeElement.querySelector('[data-testid="creator-rate"]');
    expect(firstRate?.classList.contains('blur-sm')).toBe(false);
  });

  it('passes the shared sub-mode into the creator query', async () => {
    const context = TestBed.inject(CampaignContextService);
    context.genre.set('Gaming & Esports');
    context.subMode.set('Battle Royale');

    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const lastFilters = listMock.mock.calls.at(-1)![0];
    expect(lastFilters.subMode).toBe('Battle Royale');
  });
});
