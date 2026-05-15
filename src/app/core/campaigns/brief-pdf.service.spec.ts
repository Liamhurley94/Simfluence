import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BriefPdfService } from './brief-pdf.service';
import { Campaign } from './campaign.types';

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
  startedAt: '2026-06-01T12:00:00.000Z',
  completedAt: null,
  createdAt: '2026-04-23T10:00:00.000Z',
  updatedAt: '2026-04-23T10:00:00.000Z',
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
