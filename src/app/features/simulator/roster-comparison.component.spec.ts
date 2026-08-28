import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { RosterComparisonComponent } from './roster-comparison.component';
import { RunSimulationService } from '../../core/simulation/run-simulation.service';
import { RateLimitService } from '../../core/simulation/rate-limit.service';
import { AuthService } from '../../core/auth/auth.service';
import { Creator } from '../../core/data/creator.types';
import { W2Response } from '../../core/simulation/simulation-w2.types';

function mkCreator(id: number, name = `C${id}`): Creator {
  return { id, name, handle: `@c${id}`, platform: 'YouTube' } as Creator;
}

const band = (n: number) => ({
  conservative: Math.round(n * 0.68),
  expected: n,
  optimistic: Math.round(n * 1.42),
});

function w2(totalsOver: Partial<W2Response['totals']> = {}, over: Partial<W2Response> = {}): W2Response {
  return {
    mode: 'free', budget: 85_000, genre: 'Gaming & Esports', subMode: '', objectives: [],
    model: { version: 'w2-2026-08', params: { T: 0.35, k_youtube: 1.6, k_twitch: 2.5 }, generatedAt: '' },
    bench: { ctrBase: 2, cvrBase: 0.5, engBase: 4 },
    creators: [],
    platforms: [{
      platform: 'YouTube', impressions: 90_000, uniqueReach: 72_000, engagedClicks: 2_160,
      conversions: 648, cost: 40_000, costPerConversion: 61.73,
      band: { impressions: band(90_000), uniqueReach: band(72_000), engagedClicks: band(2_160), conversions: band(648) },
    }],
    totals: {
      impressions: 90_000, engagedClicks: 2_160,
      uniqueReach: { value: 72_000, upperBound: true },
      conversions: { value: 648, upperBound: true },
      cost: 40_000, forecastableCost: 40_000, costPerConversion: 61.73,
      band: {
        impressions: band(90_000),
        uniqueReach: { ...band(72_000), upperBound: true },
        engagedClicks: band(2_160),
        conversions: { ...band(648), upperBound: true },
      },
      ...totalsOver,
    },
    unallocated: 0, unallocatedMessage: null, zeroBudget: false, warnings: [],
    ...over,
  };
}

async function mount(creators: Creator[] = [mkCreator(1), mkCreator(2), mkCreator(3)]) {
  const runFree = vi.fn().mockImplementation(async (req: { creators: Array<{ id: number }> }) =>
    // Side B (fewer/other creators) returns a cheaper, lower-volume forecast so
    // deltas are non-zero and polarity is testable.
    req.creators.length === 2
      ? w2()
      : w2({ impressions: 45_000, cost: 20_000, costPerConversion: 80,
             conversions: { value: 250, upperBound: true } },
           { unallocated: 65_000, unallocatedMessage: 'This roster tops out at $20,000.' }),
  );
  const rateLimit = { check: vi.fn().mockReturnValue({ blocked: false, limit: Infinity, remaining: Infinity }), increment: vi.fn() };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [RosterComparisonComponent],
    providers: [
      { provide: RunSimulationService, useValue: { runFree } },
      { provide: RateLimitService, useValue: rateLimit },
      { provide: AuthService, useValue: { tier: signal('silver') } },
    ],
  });
  const f = TestBed.createComponent(RosterComparisonComponent);
  f.componentRef.setInput('creators', creators);
  f.componentRef.setInput('genres', ['Gaming & Esports']);
  f.componentRef.setInput('initialGenre', 'Gaming & Esports');
  f.detectChanges(); await f.whenStable(); f.detectChanges();
  return { f, el: f.nativeElement as HTMLElement, runFree, rateLimit };
}

describe('RosterComparisonComponent', () => {
  it('seeds both sides from the selection pool; chips toggle exclusion per side', async () => {
    const { f, el } = await mount();
    expect(el.querySelectorAll('[data-testid="cmp-chip-a-1"], [data-testid="cmp-chip-a-2"], [data-testid="cmp-chip-a-3"]').length).toBe(3);
    expect(el.querySelectorAll('[data-testid^="cmp-chip-b-"]').length).toBe(3);
    (el.querySelector('[data-testid="cmp-chip-b-3"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect((el.querySelector('[data-testid="cmp-count-b"]') as HTMLElement).textContent).toContain('2');
    expect((el.querySelector('[data-testid="cmp-count-a"]') as HTMLElement).textContent).toContain('3');
  });

  it('run is disabled while either side is empty', async () => {
    const { f, el } = await mount([mkCreator(1)]);
    (el.querySelector('[data-testid="cmp-chip-b-1"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect((el.querySelector('[data-testid="cmp-run"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('run fires two free-mode calls with the same budget and genre and each side\'s ids', async () => {
    const { f, el, runFree, rateLimit } = await mount();
    (el.querySelector('[data-testid="cmp-chip-b-3"]') as HTMLButtonElement).click();
    f.detectChanges();
    (el.querySelector('[data-testid="cmp-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    expect(runFree).toHaveBeenCalledTimes(2);
    const [reqA, reqB] = runFree.mock.calls.map((c) => c[0]);
    expect(reqA.creators).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(reqB.creators).toEqual([{ id: 1 }, { id: 2 }]);
    expect(reqA.budget).toBe(reqB.budget);
    expect(reqA.genre).toBe('Gaming & Esports');
    expect(rateLimit.increment).toHaveBeenCalledTimes(2);
  });

  it('renders side-by-side totals with polarity-colored deltas (cost rows: lower is better)', async () => {
    const { f, el } = await mount();
    (el.querySelector('[data-testid="cmp-chip-b-3"]') as HTMLButtonElement).click();
    f.detectChanges();
    (el.querySelector('[data-testid="cmp-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    // A = 3 creators -> low fixture (45,000); B = 2 creators -> high fixture (90,000)
    const imp = el.querySelector('[data-testid="cmp-row-impressions"]') as HTMLElement;
    expect(imp.textContent).toContain('45,000');
    expect(imp.textContent).toContain('90,000');
    expect((imp.querySelector('[data-testid="cmp-delta-impressions"]') as HTMLElement).textContent).toContain('+100%');
    // costPerConversion: B (61.73) worse->better? A=80, B=61.73 -> delta -23%, lower is better -> green
    const cpc = el.querySelector('[data-testid="cmp-delta-costPerConversion"]') as HTMLElement;
    expect(cpc.textContent).toContain('-23%');
    expect(cpc.style.color).toContain('green');
    // conversions upper-bound label survives
    expect((el.querySelector('[data-testid="cmp-row-conversions"]') as HTMLElement).textContent).toContain('Upper bound');
  });

  it('shows each side\'s unallocated advisory', async () => {
    const { f, el } = await mount();
    (el.querySelector('[data-testid="cmp-chip-b-3"]') as HTMLButtonElement).click();
    f.detectChanges();
    (el.querySelector('[data-testid="cmp-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    expect((el.querySelector('[data-testid="cmp-unallocated-a"]') as HTMLElement).textContent)
      .toContain('This roster tops out at $20,000.');
    expect(el.querySelector('[data-testid="cmp-unallocated-b"]')).toBeNull();
  });

  it('a failed run drops both results and shows the error', async () => {
    const { f, el, runFree } = await mount();
    (el.querySelector('[data-testid="cmp-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    runFree.mockRejectedValue({ error: { error: 'boom' } });
    (el.querySelector('[data-testid="cmp-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    expect(el.querySelector('[data-testid="cmp-results"]')).toBeNull();
    expect((el.querySelector('[data-testid="cmp-error"]') as HTMLElement).textContent).toContain('boom');
  });
});
