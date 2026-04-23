import { describe, expect, it } from 'vitest';
import { SimulationService, computeObjectiveWeights } from './simulation.service';
import { Creator } from '../data/creator.types';
import { SimInputs } from './simulation.types';

function creator(overrides: Partial<Creator> = {}): Creator {
  return {
    id: 1,
    name: 'Sample',
    handle: '@sample',
    platform: 'YouTube',
    allPlatforms: ['YouTube'],
    subs: '100K',
    avgViews: '20K',
    eng: '3.0%',
    genre: 'Gaming & Esports',
    cpi: 80,
    gfi: 75,
    color: '#00C46A',
    verifiedDeals: 2,
    sponsorHistory: [],
    bio: 'bio',
    ...overrides,
  };
}

describe('computeObjectiveWeights', () => {
  it('returns all zeros normalised to (0,0,0) via total=1 denominator when none selected', () => {
    expect(computeObjectiveWeights([])).toEqual({
      awarenessW: 0,
      salesW: 0,
      engagementW: 0,
    });
  });

  it('splits weight across categories by count', () => {
    const w = computeObjectiveWeights([
      'Brand Awareness',
      'Direct Sales',
      'Engagement Rate',
      'App Install',
    ]);
    // 1 awareness, 2 sales, 1 engagement of 4 total
    expect(w.awarenessW).toBeCloseTo(0.25, 10);
    expect(w.salesW).toBeCloseTo(0.5, 10);
    expect(w.engagementW).toBeCloseTo(0.25, 10);
  });
});

describe('SimulationService.compute — golden fixtures', () => {
  const svc = new SimulationService();

  it('returns null for empty creator list', () => {
    const inputs: SimInputs = {
      creators: [],
      budget: 10_000,
      format: 'Integrated',
      genre: 'Gaming & Esports',
      objectives: [],
    };
    expect(svc.compute(inputs)).toBeNull();
  });

  it('single-creator Integrated Gaming @ $10k / no objectives — pins to app.html behavior', () => {
    const r = svc.compute({
      creators: [creator({ cpi: 80 })],
      budget: 10_000,
      format: 'Integrated',
      genre: 'Gaming & Esports',
      objectives: [],
    })!;

    // avgCPI=0.8, cpmActual = 8 * 0.8 = 6.4, impressions = (10000/6.4)*1000 = 1562500
    expect(r.impressions).toBe(1_562_500);
    expect(r.cpM).toBeCloseTo(6.4, 10);
    // ctr = 2.4 * 0.8 * 1.0 = 1.92, rounded to 1dp → 1.9
    expect(r.ctr).toBe(1.9);
    // cvr = 0.35 * 1.0 * 0.8 * 1.15 = 0.322, rounded to 1dp → 0.3
    expect(r.cvr).toBe(0.3);
    // clicks = round(1562500 * 1.92 / 100) = 30000
    expect(r.clicks).toBe(30_000);
    // conversions = round(30000 * 0.322 / 100) = 97
    expect(r.conversions).toBe(97);
    // roas = (97 * 30) / 10000 = 0.291 → 0.3
    expect(r.roas).toBe(0.3);
    // engRate = 4.2 * 1.0 * 0.8 = 3.36 → 3.4
    expect(r.engRate).toBe(3.4);

    expect(r.p50.impressions).toBe(1_562_500);
    expect(r.p10.impressions).toBe(Math.round(1_562_500 * 0.68));
    expect(r.p90.impressions).toBe(Math.round(1_562_500 * 1.42));
    expect(r.p50.ctr).toBe(1.9);
    expect(r.p10.ctr).toBe(1.3); // round(1.92 * 0.68 * 10) / 10
    expect(r.p90.ctr).toBe(2.7); // round(1.92 * 1.42 * 10) / 10
  });

  it('Dedicated format raises CTR and lowers CVR vs Integrated', () => {
    // Dedicated has higher CPM (dedMult=1.6) partially offset by a 1.4 format
    // multiplier, so impressions can land either side depending on genre.
    // The directional CTR/CVR shifts are the stable part to pin.
    const common = {
      creators: [creator({ cpi: 70 }), creator({ id: 2, cpi: 60 })],
      budget: 50_000,
      genre: 'Gaming & Esports',
      objectives: [],
    };
    const integrated = svc.compute({ ...common, format: 'Integrated' })!;
    const dedicated = svc.compute({ ...common, format: 'Dedicated' })!;

    expect(dedicated.ctr).toBeGreaterThan(integrated.ctr);
    expect(dedicated.cvr).toBeLessThan(integrated.cvr);
  });

  it('sub-mode adds 8% to impressions', () => {
    const base = svc.compute({
      creators: [creator()],
      budget: 10_000,
      format: 'Integrated',
      genre: 'Gaming & Esports',
      objectives: [],
    })!;
    const withSub = svc.compute({
      creators: [creator()],
      budget: 10_000,
      format: 'Integrated',
      genre: 'Gaming & Esports',
      objectives: [],
      subMode: 'RPG / Open World',
    })!;
    expect(withSub.impressions).toBe(Math.round(base.impressions * 1.08));
  });

  it('awareness objectives push CTR up; sales objectives push CTR down', () => {
    const common = {
      creators: [creator()],
      budget: 10_000,
      format: 'Integrated' as const,
      genre: 'Gaming & Esports',
    };
    const awareness = svc.compute({
      ...common,
      objectives: ['Brand Awareness', 'Reach & Impressions'],
    })!;
    const sales = svc.compute({
      ...common,
      objectives: ['Direct Sales', 'App Install'],
    })!;
    expect(awareness.ctr).toBeGreaterThan(sales.ctr);
    expect(sales.cvr).toBeGreaterThan(awareness.cvr);
  });

  it('unknown genre falls back to Gaming & Esports defaults', () => {
    const result = svc.compute({
      creators: [creator()],
      budget: 10_000,
      format: 'Integrated',
      genre: 'Totally Unknown Genre',
      objectives: [],
    })!;
    // bench.ctrBase for Gaming = 2.4; with avgCPI=0.8 → ctr = 1.92 → 1.9
    expect(result.ctr).toBe(1.9);
  });

  it('P10 ≤ P50 ≤ P90 for impressions, ctr, and roas', () => {
    const r = svc.compute({
      creators: [creator()],
      budget: 10_000,
      format: 'Integrated',
      genre: 'Gaming & Esports',
      objectives: ['Direct Sales'],
    })!;
    expect(r.p10.impressions).toBeLessThanOrEqual(r.p50.impressions);
    expect(r.p50.impressions).toBeLessThanOrEqual(r.p90.impressions);
    expect(r.p10.ctr).toBeLessThanOrEqual(r.p50.ctr);
    expect(r.p50.ctr).toBeLessThanOrEqual(r.p90.ctr);
    expect(r.p10.roas).toBeLessThanOrEqual(r.p50.roas);
    expect(r.p50.roas).toBeLessThanOrEqual(r.p90.roas);
  });
});
