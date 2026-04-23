import { beforeEach, describe, expect, it } from 'vitest';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  let svc: RateLimitService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    svc = new RateLimitService();
  });

  it('currentKey formats as sf_sim_runs_YYYY-MM', () => {
    const key = svc.currentKey(new Date('2026-04-23T12:00:00Z'));
    expect(key).toBe('sf_sim_runs_2026-04');
  });

  it('returns 0 when no counter stored', () => {
    expect(svc.read()).toBe(0);
  });

  it('increment adds 1 each call', () => {
    svc.increment();
    svc.increment();
    svc.increment();
    expect(svc.read()).toBe(3);
  });

  it('check returns tier-specific limits', () => {
    expect(svc.check('free').limit).toBe(3);
    expect(svc.check('bronze').limit).toBe(3);
    expect(svc.check('silver').limit).toBe(10);
    expect(svc.check('gold').limit).toBe(Infinity);
    expect(svc.check('platinum').limit).toBe(Infinity);
    expect(svc.check('diamond').limit).toBe(Infinity);
  });

  it('blocked flips true once remaining hits zero for a finite tier', () => {
    svc.increment();
    svc.increment();
    svc.increment();
    expect(svc.check('free').blocked).toBe(true);
    expect(svc.check('free').remaining).toBe(0);
  });

  it('unlimited tiers never block', () => {
    for (let i = 0; i < 100; i++) svc.increment();
    expect(svc.check('gold').blocked).toBe(false);
    expect(svc.check('gold').remaining).toBe(Infinity);
  });

  it('reset clears the current-month counter', () => {
    svc.increment();
    svc.increment();
    svc.reset();
    expect(svc.read()).toBe(0);
  });

  it('read ignores garbage values in storage', () => {
    localStorage.setItem(svc.currentKey(), 'not-a-number');
    expect(svc.read()).toBe(0);
  });
});
