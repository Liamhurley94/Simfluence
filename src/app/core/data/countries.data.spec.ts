import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, COUNTRY_OPTIONS, countryName } from './countries.data';

describe('countries.data', () => {
  it('codes are unique two-letter uppercase', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    for (const c of COUNTRY_CODES) expect(c).toMatch(/^[A-Z]{2}$/);
  });

  it('resolves display names via Intl (demo markets)', () => {
    expect(countryName('BR')).toBe('Brazil');
    expect(countryName('KR')).toBe('South Korea');
    expect(countryName('ES')).toBe('Spain');
  });

  it('options are sorted by display name', () => {
    const names = COUNTRY_OPTIONS.map((o) => o.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });
});
