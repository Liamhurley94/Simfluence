import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { CreatorMatcherPanelComponent } from './creator-matcher-panel.component';
import { CreatorMatcherService, MatchResult } from '../../../core/creator-matcher/creator-matcher.service';

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

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CreatorMatcherPanelComponent],
    providers: [{ provide: CreatorMatcherService, useValue: matcherStub }],
  });

  const fixture = TestBed.createComponent(CreatorMatcherPanelComponent);
  fixture.componentRef.setInput('genre', 'Gaming & Esports');
  fixture.componentRef.setInput('budget', 50_000);
  fixture.componentRef.setInput('objectives', ['Sales']);
  fixture.componentRef.setInput('excludeIds', excludeIds);
  fixture.componentRef.setInput('disabled', false);
  return { fixture, match };
}

async function settle(fixture: { whenStable: () => Promise<unknown>; detectChanges: () => void }) {
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('CreatorMatcherPanelComponent', () => {
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

  it('shows an empty state when the matcher returns no creators', async () => {
    const { fixture } = setup(makeResult({ creators: [] }));
    fixture.detectChanges();
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('[data-testid="matcher-empty"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('[data-testid^="matcher-card-"]')).toHaveLength(0);
  });
});
