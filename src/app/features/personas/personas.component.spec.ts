import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PersonasComponent } from './personas.component';
import { SelectionService } from '../../core/selection/selection.service';
import { CampaignContextService } from '../../core/context/campaign-context.service';

function setup() {
  const router = { navigateByUrl: vi.fn().mockResolvedValue(true) };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [PersonasComponent],
    providers: [
      provideRouter([]),
      { provide: Router, useValue: router },
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

  it('auto-select button populates the SelectionService with top N by CPI', () => {
    const { selection } = setup();
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

    expect(selection.count()).toBe(25);
    expect(countSelect).toBeTruthy();
  });

  it('simulate button routes to /app/simulator', () => {
    const { router } = setup();
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
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/simulator');
  });

  it('simulate auto-runs auto-select if nothing is selected yet', () => {
    const { selection } = setup();
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
