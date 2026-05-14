import { describe, expect, it } from 'vitest';

import { computeRateRanges } from './rate-estimate';
import { Creator } from '../data/creator.types';

function mk(overrides: Partial<Creator> = {}): Creator {
  return {
    id: 1,
    name: 'Sample',
    handle: '@sample',
    platform: 'YouTube',
    allPlatforms: ['YouTube'],
    subs: '500K',
    subsParsed: 500_000,
    avgViews: '100K',
    eng: '4%',
    genre: 'Gaming & Esports',
    cpi: 75,
    gfi: 70,
    color: '#fff',
    verifiedDeals: 0,
    sponsorHistory: [],
    bio: '',
    language: 'English',
    ...overrides,
  };
}

describe('computeRateRanges — YouTube branch', () => {
  it('returns ordered ranges (lo ≤ hi) for all three formats', () => {
    const r = computeRateRanges(mk());
    expect(r.int[0]).toBeLessThanOrEqual(r.int[1]);
    expect(r.ded[0]).toBeLessThanOrEqual(r.ded[1]);
    expect(r.mix[0]).toBeLessThanOrEqual(r.mix[1]);
  });

  it('Dedicated > Mixed > Integrated by midpoint', () => {
    const r = computeRateRanges(mk());
    const mid = ([lo, hi]: [number, number]) => (lo + hi) / 2;
    expect(mid(r.ded)).toBeGreaterThan(mid(r.mix));
    expect(mid(r.mix)).toBeGreaterThan(mid(r.int));
  });

  it('higher avg views → lower per-view rate (scale factor kicks in)', () => {
    const small = computeRateRanges(mk({ avgViews: '20K' }));
    const big = computeRateRanges(mk({ avgViews: '600K' }));
    const ratePer = ([lo, hi]: [number, number], v: number) => ((lo + hi) / 2) / v;
    expect(ratePer(small.ded, 20_000)).toBeGreaterThan(ratePer(big.ded, 600_000));
  });

  it('higher-CPM niche (Finance) prices higher than Gaming for equal stats', () => {
    const finance = computeRateRanges(mk({ genre: 'Finance & Investing' }));
    const gaming = computeRateRanges(mk({ genre: 'Gaming & Esports' }));
    expect(finance.ded[1]).toBeGreaterThan(gaming.ded[1]);
  });

  it('falls back to stored rates.ded mid only when avgViews AND subs are unusable', () => {
    // Both view paths must be zero to reach the stored-rates fallback.
    const fallback = computeRateRanges(
      mk({
        avgViews: '',
        subs: '0',
        subsParsed: 0,
        rates: { ded: [10_000, 20_000] },
      }),
    );
    // With stored mid of 15K, ded range should hover around it (not the 400 floor).
    expect(fallback.ded[1]).toBeGreaterThan(10_000);
  });

  it('subs-derived fallback (8% of subs) kicks in before stored-rates fallback', () => {
    // avgViews missing but subs present → uses subs * 0.08 = 40K views.
    const r = computeRateRanges(
      mk({ avgViews: '', rates: { ded: [10_000, 20_000] } }),
    );
    // Should NOT use the stored 15K mid — should compute from synthetic 40K views.
    expect(r.ded[1]).toBeLessThan(10_000);
  });

  it('applies the 300 floor for ded lo on tiny creators', () => {
    const tiny = computeRateRanges(mk({ avgViews: '0', subs: '100', subsParsed: 100 }));
    expect(tiny.ded[0]).toBeGreaterThanOrEqual(300);
  });
});

describe('computeRateRanges — Twitch / Kick branch', () => {
  it('uses CCV-based formula with a 650 minimum stream base', () => {
    const tiny = computeRateRanges(mk({ platform: 'Twitch', avgViews: '50' }));
    // streamBase = max(650, 50 * 2.65) = 650 → intLo = max(500, 650*0.72/50 rounded)
    expect(tiny.int[0]).toBeGreaterThanOrEqual(500);
  });

  it('Dedicated is ~1.3x Integrated (rounded to nearest 50)', () => {
    const r = computeRateRanges(mk({ platform: 'Twitch', avgViews: '5K' }));
    const intMid = (r.int[0] + r.int[1]) / 2;
    const dedMid = (r.ded[0] + r.ded[1]) / 2;
    expect(dedMid / intMid).toBeGreaterThan(1.2);
    expect(dedMid / intMid).toBeLessThan(1.4);
  });

  it('French streamers price lower than English (€2.25 vs €2.65)', () => {
    const en = computeRateRanges(mk({ platform: 'Twitch', avgViews: '5K', language: 'English' }));
    const fr = computeRateRanges(mk({ platform: 'Twitch', avgViews: '5K', language: 'French' }));
    expect(fr.int[1]).toBeLessThan(en.int[1]);
  });

  it('Kick uses a lower base rate than Twitch', () => {
    const tw = computeRateRanges(mk({ platform: 'Twitch', avgViews: '5K' }));
    const ki = computeRateRanges(mk({ platform: 'Kick', avgViews: '5K' }));
    // floor-clamped at low views, so check at a level where the floor doesn't bind
    const tw2 = computeRateRanges(mk({ platform: 'Twitch', avgViews: '50K' }));
    const ki2 = computeRateRanges(mk({ platform: 'Kick', avgViews: '50K' }));
    expect(ki2.int[1]).toBeLessThan(tw2.int[1]);
    // Sanity: smoke that both small calls still produce floored ranges.
    expect(tw.int[0]).toBeGreaterThanOrEqual(500);
    expect(ki.int[0]).toBeGreaterThanOrEqual(500);
  });
});

describe('computeRateRanges — Instagram branch', () => {
  it('uses follower-tier base pricing', () => {
    const micro = computeRateRanges(
      mk({ platform: 'Instagram', subs: '60K', subsParsed: 60_000 }),
    );
    const macro = computeRateRanges(
      mk({ platform: 'Instagram', subs: '2M', subsParsed: 2_000_000 }),
    );
    expect(macro.int[1]).toBeGreaterThan(micro.int[1]);
  });

  it('higher engagement → higher rates', () => {
    const lowEng = computeRateRanges(
      mk({ platform: 'Instagram', subs: '200K', subsParsed: 200_000, eng: '0.3%' }),
    );
    const highEng = computeRateRanges(
      mk({ platform: 'Instagram', subs: '200K', subsParsed: 200_000, eng: '5%' }),
    );
    expect(highEng.int[1]).toBeGreaterThan(lowEng.int[1]);
  });

  it('rounds to nearest 100 (not 50 like YouTube)', () => {
    const r = computeRateRanges(
      mk({ platform: 'Instagram', subs: '200K', subsParsed: 200_000 }),
    );
    expect(r.int[0] % 100).toBe(0);
    expect(r.int[1] % 100).toBe(0);
    expect(r.ded[0] % 100).toBe(0);
  });
});
