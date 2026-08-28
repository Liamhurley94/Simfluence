import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { CreatorMatcherPanelComponent } from './creator-matcher-panel.component';
import { CreatorMatcherService, MatchResult } from '../../../core/creator-matcher/creator-matcher.service';
import { CreatorProfileService } from '../../../core/creator-profile/creator-profile.service';

function makeResult(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    optimizedFor: 'fit',
    budgetConstrained: true,
    budget: 50_000,
    creators: [
      {
        creator: { id: 7, name: 'Nova', handle: 'nova', platform: 'YouTube', color: '#0f0', genre: 'Gaming & Esports' },
        best_cpi: 88,
        gfi: 91,
        reach: 1_200_000,
        rateEstimate: { ranges: { mix: [1200, 2400] } },
        why: 'CPI 88 · GFI 91',
      },
      {
        creator: { id: 9, name: 'Blaze', handle: 'blaze', platform: 'Twitch', color: '#f00', genre: 'Gaming & Esports' },
        best_cpi: 72,
        gfi: 80,
        reach: 350_000,
        rateEstimate: { ranges: { mix: [800, 1600] } },
        why: '~$1.2k, fits budget',
      },
    ],
    ...overrides,
  };
}

function setup(result: MatchResult, excludeIds: number[] = []) {
  const match = vi.fn().mockResolvedValue(result);
  const matcherStub = { match } as unknown as CreatorMatcherService;
  const openById = vi.fn();
  const profileStub = { openById } as unknown as CreatorProfileService;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CreatorMatcherPanelComponent],
    providers: [
      { provide: CreatorMatcherService, useValue: matcherStub },
      { provide: CreatorProfileService, useValue: profileStub },
    ],
  });

  const fixture = TestBed.createComponent(CreatorMatcherPanelComponent);
  fixture.componentRef.setInput('genre', 'Gaming & Esports');
  fixture.componentRef.setInput('budget', 50_000);
  fixture.componentRef.setInput('objectives', ['Sales']);
  fixture.componentRef.setInput('excludeIds', excludeIds);
  fixture.componentRef.setInput('disabled', false);
  return { fixture, match, openById };
}

async function settle(fixture: { whenStable: () => Promise<unknown>; detectChanges: () => void }) {
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('CreatorMatcherPanelComponent', () => {
  describe('rateLabel', () => {
    it('suffixes Twitch rate labels with the 2hr-stream basis', async () => {
      const { fixture } = setup(makeResult());
      fixture.detectChanges();
      await settle(fixture);

      const twitchCard: HTMLElement = fixture.nativeElement.querySelector('[data-testid="matcher-card-9"]'); // Blaze is Twitch
      expect(twitchCard.textContent).toContain('/ 2hr stream');
    });

    it('leaves YouTube rate labels unsuffixed', async () => {
      const { fixture } = setup(makeResult());
      fixture.detectChanges();
      await settle(fixture);

      const youtubeCard: HTMLElement = fixture.nativeElement.querySelector('[data-testid="matcher-card-7"]'); // Nova is YouTube
      expect(youtubeCard.textContent).not.toContain('2hr stream');
    });
  });

  it('calls match with genre/budget/objectives, roster excludeIds, and limit 12', async () => {
    const { fixture, match } = setup(makeResult(), [1, 2, 3]);
    fixture.detectChanges();
    await settle(fixture);

    expect(match).toHaveBeenCalledOnce();
    expect(match).toHaveBeenCalledWith({
      genre: 'Gaming & Esports',
      budget: 50_000,
      objectives: ['Sales'],
      excludeIds: [1, 2, 3],
      limit: 12,
      campaignId: null,
    });
  });

  it('renders a why banner derived from optimizedFor + budgetConstrained', async () => {
    const { fixture } = setup(makeResult({ optimizedFor: 'fit', budgetConstrained: true, budget: 50_000 }));
    fixture.detectChanges();
    await settle(fixture);

    const banner: HTMLElement | null = fixture.nativeElement.querySelector('[data-testid="matcher-why-banner"]');
    expect(banner).toBeTruthy();
    expect(banner!.textContent).toContain('audience fit');
    expect(banner!.textContent).toContain('$50k');
  });

  it('renders the reach banner copy when optimizing for reach without a budget', async () => {
    const { fixture } = setup(makeResult({ optimizedFor: 'reach', budgetConstrained: false, budget: null }));
    fixture.detectChanges();
    await settle(fixture);

    const banner: HTMLElement = fixture.nativeElement.querySelector('[data-testid="matcher-why-banner"]');
    expect(banner.textContent).toContain('reach');
  });

  it('renders one ranked card per matched creator with cpi/gfi/why', async () => {
    const { fixture } = setup(makeResult());
    fixture.detectChanges();
    await settle(fixture);

    const cards = fixture.nativeElement.querySelectorAll('[data-testid^="matcher-card-"]');
    expect(cards).toHaveLength(2);

    const first: HTMLElement = fixture.nativeElement.querySelector('[data-testid="matcher-card-7"]');
    expect(first.textContent).toContain('Nova');
    expect(first.textContent).toContain('88'); // best_cpi
    expect(first.textContent).toContain('91'); // gfi
    expect(first.textContent).toContain('CPI 88 · GFI 91'); // why
  });

  it('emits add with the matched item when the Add button is clicked', async () => {
    const { fixture } = setup(makeResult());
    fixture.detectChanges();
    await settle(fixture);

    const emitted: unknown[] = [];
    fixture.componentInstance.add.subscribe((v: unknown) => emitted.push(v));

    const addBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="matcher-add-7"]');
    addBtn.click();

    expect(emitted).toHaveLength(1);
    expect((emitted[0] as { creator: { id: number } }).creator.id).toBe(7);
  });

  it('opens the profile modal by id when the card body is clicked', async () => {
    const { fixture, openById } = setup(makeResult());
    fixture.detectChanges();
    await settle(fixture);

    fixture.nativeElement.querySelector('[data-testid="matcher-card-9"]').click();

    expect(openById).toHaveBeenCalledOnce();
    expect(openById).toHaveBeenCalledWith(9);
  });

  it('does NOT open the profile modal when the Add button is clicked', async () => {
    const { fixture, openById } = setup(makeResult());
    fixture.detectChanges();
    await settle(fixture);

    const emitted: unknown[] = [];
    fixture.componentInstance.add.subscribe((v: unknown) => emitted.push(v));

    fixture.nativeElement.querySelector('[data-testid="matcher-add-7"]').click();

    expect(emitted).toHaveLength(1); // add still fires
    expect(openById).not.toHaveBeenCalled(); // but the click stops there
  });

  it('shows an empty state when the matcher returns no creators', async () => {
    const { fixture } = setup(makeResult({ creators: [] }));
    fixture.detectChanges();
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('[data-testid="matcher-empty"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('[data-testid^="matcher-card-"]')).toHaveLength(0);
  });

  it('renders skeleton placeholders while loading and no result cards', () => {
    // match() never resolves → loading stays true through the first render.
    const match = vi.fn().mockReturnValue(new Promise<MatchResult>(() => {}));
    const matcherStub = { match } as unknown as CreatorMatcherService;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CreatorMatcherPanelComponent],
      providers: [{ provide: CreatorMatcherService, useValue: matcherStub }],
    });
    const fixture = TestBed.createComponent(CreatorMatcherPanelComponent);
    fixture.componentRef.setInput('genre', 'Gaming & Esports');
    fixture.componentRef.setInput('budget', 50_000);
    fixture.detectChanges();

    const skeletons = fixture.nativeElement.querySelectorAll('[data-testid="matcher-skeleton-card"]');
    expect(skeletons).toHaveLength(4);
    // The real results container / cards should not render while loading.
    expect(fixture.nativeElement.querySelector('[data-testid="matcher-cards"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[data-testid^="matcher-card-"]')).toHaveLength(0);
  });

  it('caps the results container with a scroll (max-height + overflow)', async () => {
    const { fixture } = setup(makeResult());
    fixture.detectChanges();
    await settle(fixture);

    const cards: HTMLElement = fixture.nativeElement.querySelector('[data-testid="matcher-cards"]');
    expect(cards.className).toContain('overflow-y-auto');
    expect(cards.className).toContain('max-h-[22rem]');
  });
});
