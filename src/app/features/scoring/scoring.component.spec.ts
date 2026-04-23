import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ScoringComponent } from './scoring.component';
import { AuthService } from '../../core/auth/auth.service';
import { SelectionService } from '../../core/selection/selection.service';
import { ScoreCreatorService } from '../../core/score/score-creator.service';
import { CampaignContextService } from '../../core/context/campaign-context.service';
import { EdgeClient } from '../../core/api/edge.client';

function setup({ selectedIds = [] as number[], tier = 'silver' } = {}) {
  const tierSignal = signal(tier);
  const authStub = {
    tier: tierSignal,
    user: () => null,
    isAuthenticated: () => true,
  };

  const post = vi.fn().mockResolvedValue({ results: [] });
  const edgeStub = { post, get: vi.fn() } as unknown as EdgeClient;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [ScoringComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authStub },
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

  it('renders summary + table + benchmark once creators are selected', () => {
    setup({ selectedIds: [2, 14] });
    const fixture = TestBed.createComponent(ScoringComponent);
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

    expect(post).toHaveBeenCalledTimes(1);
    const secondPayload = post.mock.calls[0][1] as { campaignGenre: string };
    expect(secondPayload.campaignGenre).toBe('Beauty & Skincare');
  });

  it('applies scored GFI from the service when rendering rows', async () => {
    const { score, selection } = setup({ selectedIds: [2] });
    const fixture = TestBed.createComponent(ScoringComponent);
    fixture.detectChanges();
    TestBed.flushEffects();

    // Simulate the edge function response populating the cache directly
    (score as unknown as { gfiCache: Map<number, number> }).gfiCache.set(2, 99);
    score.version.update((v) => v + 1);
    fixture.detectChanges();

    const gfiCell = fixture.nativeElement.querySelector('[data-testid="scoring-row-2"]')
      ?.children[2];
    expect(gfiCell?.textContent?.trim()).toBe('99');
    expect(selection.count()).toBe(1);
  });

  it('blurs rate column for free tier; clear for silver+', () => {
    const { tier } = setup({ selectedIds: [2], tier: 'free' });
    const fixture = TestBed.createComponent(ScoringComponent);
    fixture.detectChanges();

    const rateCell: HTMLElement = fixture.nativeElement
      .querySelector('[data-testid="scoring-row-2"]')
      ?.children[4];
    expect(rateCell?.classList.contains('blur-sm')).toBe(true);

    tier.set('silver');
    fixture.detectChanges();
    expect(rateCell?.classList.contains('blur-sm')).toBe(false);
  });

  it('confidence reflects % of creators with verified deals', () => {
    setup({ selectedIds: [2, 14] });
    const fixture = TestBed.createComponent(ScoringComponent);
    fixture.detectChanges();
    const confidence = fixture.nativeElement.querySelector('[data-testid="summary-confidence"]');
    // Creators 2 and 14 both have verifiedDeals:2 in the source data → 100%.
    expect(confidence?.textContent).toContain('100');
  });
});
