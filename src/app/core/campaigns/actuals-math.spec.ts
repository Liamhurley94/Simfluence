import { describe, expect, it } from 'vitest';
import {
  CreatorActuals, CreatorActualsBundle, DeliverableActualsRow,
  attributablePlatform, ctr, cvr, deltaPct, effectiveCreatorActuals, inBand,
  platformRollup, roas, rollup,
} from './actuals-math';

const dRow = (p: 'YouTube' | 'Twitch', over: Partial<DeliverableActualsRow> = {}): DeliverableActualsRow =>
  ({ platform: p, impressions: null, clicks: null, conversions: null, spend: null, revenue: null, ...over });
const cLevel = (over: Partial<CreatorActuals> = {}): CreatorActuals =>
  ({ impressions: null, clicks: null, conversions: null, spend: null, revenue: null, ...over });

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

  it('inBand inclusive at both band edges', () => {
    expect(inBand(100, 68, 142)).toBe(true);
    expect(inBand(68, 68, 142)).toBe(true);
    expect(inBand(142, 68, 142)).toBe(true);
    expect(inBand(67, 68, 142)).toBe(false);
    expect(inBand(143, 68, 142)).toBe(false);
    expect(inBand(null, 68, 142)).toBe(false);
  });
});

describe('effectiveCreatorActuals', () => {
  it('uses deliverable sums per measure when any row carries it, else creator level', () => {
    const eff = effectiveCreatorActuals({
      creatorLevel: cLevel({ impressions: 999, conversions: 40, revenue: 1200 }),
      deliverables: [dRow('YouTube', { impressions: 100, clicks: 5 }), dRow('Twitch', { impressions: 50 })],
    });
    expect(eff.impressions).toBe(150);
    expect(eff.clicks).toBe(5);
    expect(eff.conversions).toBe(40);
    expect(eff.spend).toBeNull();
    expect(eff.revenue).toBe(1200);
  });

  it('empty deliverables -> creator level verbatim', () => {
    const cl = cLevel({ impressions: 7 });
    expect(effectiveCreatorActuals({ creatorLevel: cl, deliverables: [] })).toEqual(cl);
  });
});

describe('attributablePlatform', () => {
  it('single platform across rows -> that platform; mixed or empty -> null', () => {
    expect(attributablePlatform([dRow('Twitch'), dRow('Twitch')])).toBe('Twitch');
    expect(attributablePlatform([dRow('Twitch'), dRow('YouTube')])).toBeNull();
    expect(attributablePlatform([])).toBeNull();
  });
});

describe('platformRollup', () => {
  it('single-platform creator contributes effective measures incl. creator-level conversions', () => {
    const r = platformRollup([{
      creatorLevel: cLevel({ conversions: 30, spend: 8000, revenue: 9000 }),
      deliverables: [dRow('Twitch', { impressions: 20000, clicks: 400 })],
    }]);
    expect(r.hasUnattributed).toBe(false);
    expect(r.platforms).toEqual([{
      platform: 'Twitch', impressions: 20000, clicks: 400, conversions: 30,
      spend: 8000, revenue: 9000, ctr: 2, costPerConversion: 266.67,
    }]);
  });

  it('multi-platform creator: row measures split per platform, creator-level conversions flagged unattributed', () => {
    const r = platformRollup([{
      creatorLevel: cLevel({ conversions: 50 }),
      deliverables: [dRow('YouTube', { impressions: 1000 }), dRow('Twitch', { impressions: 600, clicks: 30 })],
    }]);
    expect(r.hasUnattributed).toBe(true);
    const yt = r.platforms.find((p) => p.platform === 'YouTube')!;
    const tw = r.platforms.find((p) => p.platform === 'Twitch')!;
    expect(yt.impressions).toBe(1000);
    expect(yt.conversions).toBeNull();
    expect(tw.clicks).toBe(30);
    expect(tw.conversions).toBeNull();
  });

  it('no contributions at all -> empty platforms, nothing fabricated', () => {
    const r = platformRollup([{ creatorLevel: cLevel(), deliverables: [dRow('YouTube')] }]);
    expect(r.platforms).toEqual([]);
    expect(r.hasUnattributed).toBe(false);
  });
});
