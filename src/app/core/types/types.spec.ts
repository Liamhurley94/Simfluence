import { describe, expect, it } from 'vitest';
import { TIER_LEVELS, tierRank } from './index';

describe('tierRank', () => {
  it('returns 0 for null/undefined/falsy', () => {
    expect(tierRank(null)).toBe(0);
    expect(tierRank(undefined)).toBe(0);
  });

  it('returns the correct rank for each tier', () => {
    expect(tierRank('free')).toBe(0);
    expect(tierRank('bronze')).toBe(1);
    expect(tierRank('silver')).toBe(2);
    expect(tierRank('gold')).toBe(3);
    expect(tierRank('platinum')).toBe(4);
    expect(tierRank('diamond')).toBe(5);
    expect(tierRank('admin')).toBe(99);
  });

  it('matches TIER_LEVELS ordering for gating comparisons', () => {
    expect(tierRank('silver') >= tierRank('free')).toBe(true);
    expect(tierRank('free') >= tierRank('silver')).toBe(false);
    expect(TIER_LEVELS.gold).toBeGreaterThan(TIER_LEVELS.silver);
  });
});