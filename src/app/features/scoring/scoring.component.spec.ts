import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ScoringComponent } from './scoring.component';
import { AuthService } from '../../core/auth/auth.service';
import { SelectionService } from '../../core/selection/selection.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { ScoreCreatorService } from '../../core/score/score-creator.service';
import { CampaignContextService } from '../../core/context/campaign-context.service';
import { EdgeClient } from '../../core/api/edge.client';
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
  };
}

function setup({ selectedIds = [] as number[], tier = 'silver' } = {}) {
  const tierSignal = signal(tier);
  const authStub = {
    tier: tierSignal,
    user: () => null,
    isAuthenticated: () => true,
  };

  const post = vi.fn().mockResolvedValue({ results: [] });
  const edgeStub = { post, get: vi.fn() } as unknown as EdgeClient;

  // Creator data now loads server-side via CreatorsService.byIds (async),
  // consumed both by the component's resource() and its rescore effect.
  const byIds = vi.fn(async (ids: Iterable<number>) =>
    Array.from(ids, (id) => mkCreator(id)),
  );
  const creatorsStub = {
    byIds,
    genres: signal(['Gaming & Esports', 'Beauty & Skincare']),
    platforms: signal(['YouTube', 'Twitch']),
    languages: signal(['English']),
    submodesByGenre: signal<Record<string, { subMode: string; hasKeywords: boolean }[]>>({}),
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [ScoringComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authStub },
      { provide: CreatorsService, useValue: creatorsStub },
      { provide: EdgeClient, useValue: edgeStub },
    ],
  });

  const selection = TestBed.inject(SelectionService);
  for (const id of selectedIds) selection.add(id);

  return {
    selection,
    score: TestBed.inject(ScoreCreatorService),
    context: TestBed.inject(CampaignContextService),
    post,
    tier: tierSignal,
  };
}

describe('ScoringComponent', () => {
  beforeEach(() => {
    // noop
  });

  it('shows the empty state when no creators are selected', () => {
    setup({ selectedIds: [] });
    const fixture = TestBed.createComponent(ScoringComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="scoring-empty"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="scoring-summary"]')).toBeNull();
  });

  it('renders summary + table + benchmark once creators are selected', async () => {
    setup({ selectedIds: [2, 14] });
    const fixture = TestBed.createComponent(ScoringComponent);
    fixture.detectChanges();
    // CreatorsService.byIds is async (server-backed); let the resource() resolve.
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="scoring-empty"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="scoring-summary"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="scoring-table"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="genre-benchmark"]')).toBeTruthy();
  });

  it('triggers scoreBulk with selected creators on mount, and refetches on genre change', async () => {
    const { post, context } = setup({ selectedIds: [2, 14] });
    const fixture = TestBed.createComponent(ScoringComponent);
    fixture.detectChanges();
    TestBed.flushEffects();
    // The rescore effect awaits the async byIds before calling scoreBulk.
    await fixture.whenStable();

    expect(post).toHaveBeenCalledTimes(1);
    const firstPayload = post.mock.calls[0][1] as {
      campaignGenre: string;
      creators: Array<{ id: string }>;
    };
    expect(firstPayload.creators.length).toBe(2);
    expect(firstPayload.campaignGenre).toBe('Gaming & Esports');

    post.mockClear();
    context.genre.set('Beauty & Skincare');
    TestBed.flushEffects();
    await fixture.whenStable();

    expect(post).toHaveBeenCalledTimes(1);
    const secondPayload = post.mock.calls[0][1] as { campaignGenre: string };
    expect(secondPayload.campaignGenre).toBe('Beauty & Skincare');
  });

  it('applies scored GFI from the service when rendering rows', async () => {
    const { score, selection } = setup({ selectedIds: [2] });
    const fixture = TestBed.createComponent(ScoringComponent);
    fixture.detectChanges();
    TestBed.flushEffects();
    await fixture.whenStable();
    fixture.detectChanges();

    // Simulate the edge function response populating the cache directly
    (score as unknown as { gfiCache: Map<number, number> }).gfiCache.set(2, 99);
    score.version.update((v) => v + 1);
    fixture.detectChanges();

    const gfiCell = fixture.nativeElement.querySelector('[data-testid="scoring-row-2"]')
      ?.children[2];
    // GFI cell renders "<score>%" plus a "genre fit" sublabel.
    expect(gfiCell?.textContent).toContain('99');
    expect(selection.count()).toBe(1);
  });

  it('blurs rate column for free tier; clear for silver+', async () => {
    const { tier } = setup({ selectedIds: [2], tier: 'free' });
    const fixture = TestBed.createComponent(ScoringComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rateCell: HTMLElement = fixture.nativeElement
      .querySelector('[data-testid="scoring-row-2"]')
      ?.children[4];
    expect(rateCell?.classList.contains('blur-sm')).toBe(true);

    tier.set('silver');
    fixture.detectChanges();
    expect(rateCell?.classList.contains('blur-sm')).toBe(false);
  });

  it('confidence reflects % of creators with verified deals', async () => {
    setup({ selectedIds: [2, 14] });
    const fixture = TestBed.createComponent(ScoringComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const confidence = fixture.nativeElement.querySelector('[data-testid="summary-confidence"]');
    // Creators 2 and 14 both have verifiedDeals:2 in the stub → 100%.
    expect(confidence?.textContent).toContain('100');
  });

  it('refetches with the new sub-mode when it changes', async () => {
    const { post, context } = setup({ selectedIds: [2, 14] });
    const fixture = TestBed.createComponent(ScoringComponent);
    fixture.detectChanges();
    TestBed.flushEffects();
    await fixture.whenStable();

    post.mockClear();
    context.subMode.set('Battle Royale');
    TestBed.flushEffects();
    await fixture.whenStable();

    expect(post).toHaveBeenCalledTimes(1);
    const payload = post.mock.calls[0][1] as { subMode: string };
    expect(payload.subMode).toBe('Battle Royale');
  });
});
