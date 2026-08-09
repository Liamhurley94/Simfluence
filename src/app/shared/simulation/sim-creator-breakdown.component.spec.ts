import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { SimCreatorBreakdownComponent } from './sim-creator-breakdown.component';
import { Creator } from '../../core/data/creator.types';
import { SimCreatorBreakdown } from '../../core/simulation/simulation.types';

function mkCreator(id: number, name: string): Creator {
  return { id, name, handle: `@c${id}`, platform: 'YouTube', allPlatforms: ['YouTube'],
    subs: '100K', subsParsed: 100_000, avgViews: '20K', eng: '3.0%', genre: 'Gaming & Esports',
    cpi: 80, gfi: 75, color: '#fff', verifiedDeals: 0, sponsorHistory: [], bio: '' } as Creator;
}

const band = (n: number) => ({ impr: n, ctr: 2, clicks: n / 10, conv: n / 100, roas: 1.2 });

function mkBreakdown(id: string | number, reachable = true, fitFormat: 'int' | 'mix' | 'ded' = 'int'): SimCreatorBreakdown {
  return { id, gfi: 91, reachable, fitFormat, budgetShare: 18_200, impressions: 2_100_000, ctr: 2.9,
    clicks: 61_900, cvr: 0.35, conversions: 217, roas: 1.4,
    rates: { int: [4200, 8100], mix: [7000, 13_000], ded: [9800, 19_000] },
    p10: band(1_100_000), p50: band(1_600_000), p90: band(2_300_000) };
}

@Component({
  standalone: true, imports: [SimCreatorBreakdownComponent],
  template: `<app-sim-creator-breakdown [breakdowns]="breakdowns()" [creators]="creators()" />`,
})
class Host {
  breakdowns = signal<SimCreatorBreakdown[]>([mkBreakdown('1')]);
  creators = signal<Creator[]>([mkCreator(1, 'Ludwig')]);
}

describe('SimCreatorBreakdownComponent', () => {
  it('joins a string breakdown id to a numeric creator id', () => {
    TestBed.resetTestingModule();
    const f = TestBed.createComponent(Host); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-breakdown"]').textContent).toContain('Ludwig');
  });

  it('renders one row per breakdown', () => {
    TestBed.resetTestingModule();
    const f = TestBed.createComponent(Host);
    f.componentInstance.breakdowns.set([mkBreakdown('1'), mkBreakdown('2')]);
    f.componentInstance.creators.set([mkCreator(1, 'Ludwig'), mkCreator(2, 'Pokimane')]);
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('[data-testid="sim-breakdown-row"]').length).toBe(2);
  });

  it('renders a row whose creator is missing from the roster without throwing', () => {
    TestBed.resetTestingModule();
    const f = TestBed.createComponent(Host);
    f.componentInstance.creators.set([]);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-breakdown"]').textContent).toContain('#1');
  });

  it('expands a row to reveal its confidence bands, and collapses again', () => {
    TestBed.resetTestingModule();
    const f = TestBed.createComponent(Host); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-breakdown-detail"]')).toBeFalsy();
    f.nativeElement.querySelector('[data-testid="sim-breakdown-row"]').click(); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-breakdown-detail"]')).toBeTruthy();
    f.nativeElement.querySelector('[data-testid="sim-breakdown-row"]').click(); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-breakdown-detail"]')).toBeFalsy();
  });

  it('carries the required proprietary-metric disclaimer', () => {
    TestBed.resetTestingModule();
    const f = TestBed.createComponent(Host); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="proprietary-note"]')).toBeTruthy();
  });

  it('carries the source-zone header labeling the metrics as Simfluence-derived', () => {
    TestBed.resetTestingModule();
    const f = TestBed.createComponent(Host); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="metric-source-simfluence"]')).toBeTruthy();
  });

  it('expands a row on Enter for keyboard-only users', () => {
    TestBed.resetTestingModule();
    const f = TestBed.createComponent(Host); f.detectChanges();
    const row: HTMLElement = f.nativeElement.querySelector('[data-testid="sim-breakdown-row"]');
    expect(f.nativeElement.querySelector('[data-testid="sim-breakdown-detail"]')).toBeFalsy();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-breakdown-detail"]')).toBeTruthy();
  });

  it('marks the row as a focusable, aria-expanded button for keyboard access', () => {
    TestBed.resetTestingModule();
    const f = TestBed.createComponent(Host); f.detectChanges();
    const row: HTMLElement = f.nativeElement.querySelector('[data-testid="sim-breakdown-row"]');
    expect(row.getAttribute('tabindex')).toBe('0');
    expect(row.getAttribute('role')).toBe('button');
    expect(row.getAttribute('aria-expanded')).toBe('false');
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    f.detectChanges();
    expect(row.getAttribute('aria-expanded')).toBe('true');
  });

  it('groups unaffordable creators after affordable ones', () => {
    TestBed.resetTestingModule();
    const f = TestBed.createComponent(Host);
    f.componentInstance.breakdowns.set([
      { ...mkBreakdown('1'), reachable: false },
      { ...mkBreakdown('2'), reachable: true },
    ]);
    f.componentInstance.creators.set([mkCreator(1, 'Poorfit'), mkCreator(2, 'Affordable')]);
    f.detectChanges();
    const names = [...f.nativeElement.querySelectorAll('[data-testid="sim-breakdown-row"]')]
      .map((r: HTMLElement) => r.textContent ?? '');
    expect(names[0]).toContain('Affordable');
    expect(names[1]).toContain('Poorfit');
  });

  it('shows the rate instead of forecast numbers on an over-budget row', () => {
    TestBed.resetTestingModule();
    const f = TestBed.createComponent(Host);
    f.componentInstance.breakdowns.set([{ ...mkBreakdown('1'), reachable: false }]);
    f.detectChanges();
    const row = f.nativeElement.querySelector('[data-testid="sim-breakdown-unaffordable"]');
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('Over budget');
    // The row must not present a fabricated forecast for a placement the budget can't buy.
    expect(row.textContent).not.toContain('2,100,000');
  });

  it('does not expand an over-budget row', () => {
    TestBed.resetTestingModule();
    const f = TestBed.createComponent(Host);
    f.componentInstance.breakdowns.set([{ ...mkBreakdown('1'), reachable: false }]);
    f.detectChanges();
    f.nativeElement.querySelector('[data-testid="sim-breakdown-row"]').click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-breakdown-detail"]')).toBeFalsy();
  });

  it('an over-budget row renders the rate range it was actually gated on, not always Integrated', () => {
    TestBed.resetTestingModule();
    const f = TestBed.createComponent(Host);
    // fitFormat: 'ded' – the budget fit excluded this creator on its Dedicated
    // price, so the row must show the Dedicated range ($9,800-$19,000) and say
    // "Dedicated", never the unrelated Integrated range ($4,200-$8,100).
    f.componentInstance.breakdowns.set([mkBreakdown('1', false, 'ded')]);
    f.detectChanges();
    const row = f.nativeElement.querySelector('[data-testid="sim-breakdown-unaffordable"]');
    expect(row.textContent).toContain('Dedicated rate');
    expect(row.textContent).toContain('9,800');
    expect(row.textContent).toContain('19,000');
    expect(row.textContent).not.toContain('Integrated');
    expect(row.textContent).not.toContain('4,200');
  });

  it('fails open when reachable is missing (stale backend), rendering forecast numbers not Over budget', () => {
    TestBed.resetTestingModule();
    const f = TestBed.createComponent(Host);
    // Simulate a stale deployed edge function that predates `reachable` –
    // omitted entirely, not `false`. Must not be treated as unaffordable.
    const stale = { ...mkBreakdown('1') } as Partial<SimCreatorBreakdown>;
    delete stale.reachable;
    f.componentInstance.breakdowns.set([stale as SimCreatorBreakdown]);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-breakdown-unaffordable"]')).toBeFalsy();
    expect(f.nativeElement.textContent).toContain('2,100,000');
  });
});
