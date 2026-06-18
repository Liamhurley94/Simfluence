import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PersonasComponent } from './personas.component';
import { SelectionService } from '../../core/selection/selection.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { CampaignContextService } from '../../core/context/campaign-context.service';
import { Creator, PagedCreators } from '../../core/data/creator.types';

function mkCreator(id: number, cpi: number): Creator {
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
    cpi,
    gfi: 75,
    color: '#fff',
    verifiedDeals: 2,
    sponsorHistory: [],
    bio: 'bio',
  };
}

function setup() {
  const router = { navigateByUrl: vi.fn().mockResolvedValue(true) };

  // Auto-select now hits the backend: PersonasService.autoSelect → CreatorsService.list
  // (async). Stub list so the real PersonasService can populate the selection.
  const list = vi.fn(
    async (_filters: unknown, _sort: unknown, _page: number, count: number): Promise<PagedCreators> => ({
      creators: Array.from({ length: count }, (_, i) => mkCreator(i + 1, 100 - i)),
      total: count,
      pageCount: 1,
      page: 0,
    }),
  );
  const creatorsStub = {
    list,
    genres: signal(['Gaming & Esports', 'Beauty & Skincare']),
    platforms: signal(['YouTube', 'Twitch']),
    languages: signal(['English']),
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [PersonasComponent],
    providers: [
      provideRouter([]),
      { provide: Router, useValue: router },
      { provide: CreatorsService, useValue: creatorsStub },
    ],
  });

  return {
    router,
    selection: TestBed.inject(SelectionService),
    context: TestBed.inject(CampaignContextService),
  };
}

describe('PersonasComponent', () => {
  beforeEach(() => {
    // noop
  });

  it('renders persona cards for the current genre', () => {
    const { context } = setup();
    context.genre.set('Gaming & Esports');
    const fixture = TestBed.createComponent(PersonasComponent);
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('[data-testid^="persona-"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('shows recommendation banner only after a persona is clicked', () => {
    setup();
    const fixture = TestBed.createComponent(PersonasComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="recommendation-banner"]')).toBeNull();

    const firstCard: HTMLElement = fixture.nativeElement.querySelector('[data-testid^="persona-"]');
    firstCard.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="recommendation-banner"]')).toBeTruthy();
  });

  it('clicking the same persona twice deselects it', () => {
    setup();
    const fixture = TestBed.createComponent(PersonasComponent);
    fixture.detectChanges();
    const firstCard: HTMLElement = fixture.nativeElement.querySelector('[data-testid^="persona-"]');
    firstCard.click();
    fixture.detectChanges();
    firstCard.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="recommendation-banner"]')).toBeNull();
  });

  it('auto-select button populates the SelectionService with top N by CPI', async () => {
    const { context, selection } = setup();
    context.genre.set('Gaming & Esports');
    const fixture = TestBed.createComponent(PersonasComponent);
    fixture.detectChanges();

    const countSelect: HTMLSelectElement = fixture.nativeElement.querySelector(
      '[data-testid="auto-select-count"]',
    );
    // Count dropdown defaults to 25; leave it
    const runBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="auto-select-run"]',
    );
    runBtn.click();
    // runAutoSelect → CreatorsService.list is async; let it resolve.
    await fixture.whenStable();

    expect(selection.count()).toBe(25);
    expect(countSelect).toBeTruthy();
  });

  it('simulate button routes to /app/simulator', async () => {
    const { context, router } = setup();
    context.genre.set('Gaming & Esports');
    const fixture = TestBed.createComponent(PersonasComponent);
    fixture.detectChanges();

    // Pick a persona to reveal the banner
    const firstCard: HTMLElement = fixture.nativeElement.querySelector('[data-testid^="persona-"]');
    firstCard.click();
    fixture.detectChanges();

    const simBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="simulate-this-campaign"]',
    );
    simBtn.click();
    // simulate() awaits the auto-select round-trip before navigating.
    await fixture.whenStable();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/simulator');
  });

  it('simulate auto-runs auto-select if nothing is selected yet', async () => {
    const { context, selection } = setup();
    context.genre.set('Gaming & Esports');
    const fixture = TestBed.createComponent(PersonasComponent);
    fixture.detectChanges();

    expect(selection.count()).toBe(0);
    const firstCard: HTMLElement = fixture.nativeElement.querySelector('[data-testid^="persona-"]');
    firstCard.click();
    fixture.detectChanges();

    const simBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="simulate-this-campaign"]',
    );
    simBtn.click();
    await fixture.whenStable();
    expect(selection.count()).toBeGreaterThan(0);
  });

  it('updates persona grid when genre context changes', () => {
    const { context } = setup();
    context.genre.set('Gaming & Esports');
    const fixture = TestBed.createComponent(PersonasComponent);
    fixture.detectChanges();
    const gamingCount = fixture.nativeElement.querySelectorAll('[data-testid^="persona-"]').length;

    context.genre.set('Beauty & Skincare');
    fixture.detectChanges();
    const beautyCount = fixture.nativeElement.querySelectorAll('[data-testid^="persona-"]').length;

    expect(beautyCount).toBeGreaterThan(0);
    expect(gamingCount).not.toBe(beautyCount);
  });
});
