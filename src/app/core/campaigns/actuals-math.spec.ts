import { describe, expect, it } from 'vitest';
import { CreatorActuals, ctr, cvr, roas, rollup, deltaPct, inBand } from './actuals-math';

const row = (o: Partial<CreatorActuals> = {}): CreatorActuals => ({
  impressions: null, clicks: null, conversions: null, spend: null, revenue: null, ...o,
});

describe('actuals-math', () => {
  it('ctr = clicks/impressions %, 1dp; null when impressions 0/absent or clicks absent', () => {
    expect(ctr(1000, 32)).toBe(3.2);
    expect(ctr(0, 10)).toBeNull();
    expect(ctr(null, 10)).toBeNull();
    expect(ctr(1000, null)).toBeNull();
    expect(ctr(1000, 0)).toBe(0);
  });

  it('cvr = conversions/clicks %, 1dp; null when clicks 0/absent', () => {
    expect(cvr(1000, 15)).toBe(1.5);
    expect(cvr(0, 5)).toBeNull();
    expect(cvr(null, 5)).toBeNull();
  });

  it('roas = revenue/spend ×, 2dp; null when spend 0/absent or revenue absent', () => {
    expect(roas(40000, 96000)).toBe(2.4);
    expect(roas(0, 100)).toBeNull();
    expect(roas(40000, null)).toBeNull();
  });

  it('rollup sums non-null fields (null skipped)', () => {
    const r = rollup([
      row({ impressions: 1000, clicks: 30, conversions: 5, spend: 100, revenue: 400 }),
      row({ impressions: 500, clicks: 10, conversions: null, spend: 50, revenue: 100 }),
    ]);
    expect(r.impressions).toBe(1500);
    expect(r.clicks).toBe(40);
    expect(r.conversions).toBe(5);
    expect(r.spend).toBe(150);
    expect(r.revenue).toBe(500);
  });

  it('revenueComplete true only when every row with spend>0 has revenue', () => {
    expect(rollup([row({ spend: 100, revenue: 400 })]).revenueComplete).toBe(true);
    expect(rollup([row({ spend: 100, revenue: null })]).revenueComplete).toBe(false);
    expect(rollup([row({ spend: null, revenue: null })]).revenueComplete).toBe(true);
    expect(rollup([row({ spend: 0, revenue: null })]).revenueComplete).toBe(true);
  });

  it('deltaPct signed integer %, null on missing actual or zero forecast', () => {
    expect(deltaPct(2180000, 2400000)).toBe(-9);
    expect(deltaPct(3.6, 3.2)).toBe(13);
    expect(deltaPct(null, 100)).toBeNull();
    expect(deltaPct(50, 0)).toBeNull();
  });

  it('inBand inclusive of P10 and P90', () => {
    expect(inBand(100, 68, 142)).toBe(true);
    expect(inBand(68, 68, 142)).toBe(true);
    expect(inBand(142, 68, 142)).toBe(true);
    expect(inBand(67, 68, 142)).toBe(false);
    expect(inBand(143, 68, 142)).toBe(false);
    expect(inBand(null, 68, 142)).toBe(false);
  });
});
