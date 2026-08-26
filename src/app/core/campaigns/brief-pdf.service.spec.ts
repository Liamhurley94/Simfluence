import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BriefPdfService } from './brief-pdf.service';
import { Campaign } from './campaign.types';
import { W2Response } from '../simulation/simulation-w2.types';

const SAMPLE: Campaign = {
  id: 'cmp-1',
  createdBy: 'user-1',
  enterpriseId: null,
  status: 'active',
  name: 'Nestlé Gaming Q3',
  client: 'Nestlé',
  genre: 'Gaming & Esports',
  budget: 85_000,
  notes: 'Awareness + sales, EMEA',
  objectives: ['Brand awareness'],
  forecast: {
    impressions: 1_562_500,
    ctr: 1.9,
    cvr: 0.3,
    roas: 0.3,
    p10: { impressions: 1_062_500, ctr: 1.3, roas: 0.2 },
    p50: { impressions: 1_562_500, ctr: 1.9, roas: 0.3 },
    p90: { impressions: 2_218_750, ctr: 2.7, roas: 0.4 },
  },
  debriefNotes: null,
  startedAt: '2026-06-01T12:00:00.000Z',
  completedAt: null,
  createdAt: '2026-04-23T10:00:00.000Z',
  updatedAt: '2026-04-23T10:00:00.000Z',
};

const band = (n: number) => ({
  conservative: Math.round(n * 0.68),
  expected: n,
  optimistic: Math.round(n * 1.42),
});

/** A W2-era saved forecast — version-stamped, so the brief takes the new path. */
const W2_SAMPLE: W2Response = {
  mode: 'campaign', budget: 85_000, genre: 'Gaming & Esports', subMode: '', objectives: [],
  model: {
    version: 'w2-2026-08',
    params: { T: 0.35, k_youtube: 1.6, k_twitch: 2.5 },
    generatedAt: '2026-08-26T00:00:00.000Z',
  },
  bench: { ctrBase: 2, cvrBase: 0.5, engBase: 4 },
  creators: [],
  platforms: [],
  totals: {
    impressions: 1_562_500, engagedClicks: 29_688,
    uniqueReach: { value: 1_250_000, upperBound: true },
    conversions: { value: 11_250, upperBound: true },
    cost: 85_000, forecastableCost: 85_000, costPerConversion: 7.56,
    band: {
      impressions: band(1_562_500),
      uniqueReach: { ...band(1_250_000), upperBound: true },
      engagedClicks: band(29_688),
      conversions: { ...band(11_250), upperBound: true },
    },
  },
  unallocated: 0, unallocatedMessage: null, zeroBudget: false, warnings: [],
};

describe('BriefPdfService.buildHtml', () => {
  const svc = new BriefPdfService();

  it('contains all the headline fields', () => {
    const html = svc.buildHtml(SAMPLE, 3);
    expect(html).toContain('<title>Nestlé Gaming Q3');
    expect(html).toContain('Nestlé');
    expect(html).toContain('Gaming &amp; Esports');
    expect(html).toContain('$85,000');
    expect(html).toContain('Awareness + sales, EMEA');
  });

  it('renders the P10/P50/P90 bands when forecast is present', () => {
    const html = svc.buildHtml(SAMPLE, 3);
    expect(html).toContain('1,062,500');
    expect(html).toContain('1,562,500');
    expect(html).toContain('2,218,750');
  });

  it('renders an empty-forecast note when forecast is null', () => {
    const html = svc.buildHtml({ ...SAMPLE, forecast: null }, 0);
    expect(html).toContain('No forecast attached');
  });

  it('html-escapes user-provided fields', () => {
    const html = svc.buildHtml({ ...SAMPLE, name: '<script>alert(1)</script>' }, 0);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('includes the creator count when passed', () => {
    const html = svc.buildHtml(SAMPLE, 7);
    expect(html).toMatch(/Creators[\s\S]*7/);
  });

  it('renders a W2 forecast as Conservative/Expected/Optimistic, with no percentiles or ROAS', () => {
    const html = svc.buildHtml({ ...SAMPLE, forecast: W2_SAMPLE }, 3);
    expect(html).toContain('Conservative');
    expect(html).toContain('Expected');
    expect(html).toContain('Optimistic');
    expect(html).toContain('1,562,500');
    expect(html).toContain('conversions (upper bound)');
    expect(html).not.toContain('P50');
    expect(html).not.toContain('ROAS');
  });
});

describe('BriefPdfService.export', () => {
  let svc: BriefPdfService;

  beforeEach(() => {
    svc = new BriefPdfService();
  });

  it('returns false when window.open is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValueOnce(null);
    expect(svc.export(SAMPLE)).toBe(false);
  });

  it('writes the brief HTML into the new window', () => {
    const write = vi.fn();
    const close = vi.fn();
    const print = vi.fn();
    const focus = vi.fn();
    const setTimeoutFn = vi.fn((cb: () => void) => cb());

    const fakeWin = {
      document: { write, close },
      setTimeout: setTimeoutFn,
      focus,
      print,
    } as unknown as Window;

    vi.spyOn(window, 'open').mockReturnValueOnce(fakeWin);

    const ok = svc.export(SAMPLE);
    expect(ok).toBe(true);
    expect(write).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(print).toHaveBeenCalled();
  });
});
