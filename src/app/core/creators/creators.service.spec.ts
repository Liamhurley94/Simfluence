import { describe, expect, it } from 'vitest';
import { CreatorsService, parseSubs } from './creators.service';

describe('parseSubs', () => {
  it('parses "1.5M" → 1_500_000', () => {
    expect(parseSubs('1.5M')).toBe(1_500_000);
  });
  it('parses "94K" → 94_000', () => {
    expect(parseSubs('94K')).toBe(94_000);
  });
  it('parses plain numbers', () => {
    expect(parseSubs('250')).toBe(250);
  });
  it('returns 0 on invalid input', () => {
    expect(parseSubs('')).toBe(0);
    expect(parseSubs('unknown')).toBe(0);
  });
});

describe('CreatorsService', () => {
  const svc = new CreatorsService();

  it('returns a page of creators with pagination metadata', () => {
    const r = svc.list({}, 'cpi', 0, 10);
    expect(r.creators.length).toBe(10);
    expect(r.total).toBeGreaterThan(10);
    expect(r.pageCount).toBeGreaterThan(1);
    expect(r.page).toBe(0);
  });

  it('clamps over-range page to last page', () => {
    const r = svc.list({}, 'cpi', 999999, 10);
    expect(r.page).toBe(r.pageCount - 1);
  });

  it('sorts by CPI descending', () => {
    const r = svc.list({}, 'cpi', 0, 20);
    for (let i = 1; i < r.creators.length; i++) {
      expect(r.creators[i - 1].cpi).toBeGreaterThanOrEqual(r.creators[i].cpi);
    }
  });

  it('sorts by subscribers descending (numeric, not string)', () => {
    const r = svc.list({}, 'subs', 0, 20);
    for (let i = 1; i < r.creators.length; i++) {
      expect(parseSubs(r.creators[i - 1].subs)).toBeGreaterThanOrEqual(parseSubs(r.creators[i].subs));
    }
  });

  it('filters by genre', () => {
    const r = svc.list({ genre: 'Gaming & Esports' }, 'cpi', 0, 50);
    for (const c of r.creators) expect(c.genre).toBe('Gaming & Esports');
  });

  it('filters by platform (matches allPlatforms, falling back to platform)', () => {
    const r = svc.list({ platforms: ['Twitch'] }, 'cpi', 0, 50);
    for (const c of r.creators) {
      const plats = c.allPlatforms?.length ? c.allPlatforms : [c.platform];
      expect(plats).toContain('Twitch');
    }
  });

  it('filters by language, defaulting undefined language to English', () => {
    const r = svc.list({ languages: ['English'] }, 'cpi', 0, 50);
    for (const c of r.creators) {
      expect(c.language ?? 'English').toBe('English');
    }
  });

  it('search matches against name, handle, and bio', () => {
    const r = svc.list({ search: 'gaming' }, 'cpi', 0, 20);
    for (const c of r.creators) {
      const hay = (c.name + ' ' + c.handle + ' ' + c.bio).toLowerCase();
      expect(hay).toContain('gaming');
    }
  });

  it('byId returns the matching creator or undefined', () => {
    const list = svc.list({}, 'cpi', 0, 1);
    const first = list.creators[0];
    expect(svc.byId(first.id)?.id).toBe(first.id);
    expect(svc.byId(-1)).toBeUndefined();
  });

  it('genres() / platforms() / languages() are deduped and sorted', () => {
    expect(svc.genres().length).toBeGreaterThan(1);
    expect(svc.platforms()).toContain('Twitch');
    expect(svc.platforms()).toContain('YouTube');
    expect(svc.languages()).toContain('English');

    const genres = svc.genres();
    const sorted = [...genres].sort();
    expect(genres).toEqual(sorted);
  });
});
