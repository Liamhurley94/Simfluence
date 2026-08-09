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

function mkBreakdown(id: string | number): SimCreatorBreakdown {
  return { id, gfi: 91, budgetShare: 18_200, impressions: 2_100_000, ctr: 2.9,
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
});
