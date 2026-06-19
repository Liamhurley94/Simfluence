import { describe, expect, it } from 'vitest';
import { lastStreamPhrase } from './twitch-live.util';

describe('lastStreamPhrase', () => {
  it('returns "recently" for null', () => {
    expect(lastStreamPhrase(null)).toBe('recently');
  });
  it('returns "today" for 0', () => {
    expect(lastStreamPhrase(0)).toBe('today');
  });
  it('returns "today" for negative values', () => {
    expect(lastStreamPhrase(-1)).toBe('today');
  });
  it('returns "yesterday" for 1', () => {
    expect(lastStreamPhrase(1)).toBe('yesterday');
  });
  it('returns "5 days ago" for 5', () => {
    expect(lastStreamPhrase(5)).toBe('5 days ago');
  });
});
