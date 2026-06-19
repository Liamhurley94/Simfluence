import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { TwitchLiveService } from './twitch-live.service';
import { SupabaseService } from '../supabase/supabase.service';
import { Creator } from '../data/creator.types';

// Minimal creator factory — only the fields TwitchLiveService touches
function makeCreator(overrides: Partial<Creator> = {}): Creator {
  return {
    id: 1, name: 'Test', handle: '@test', platform: 'Twitch',
    allPlatforms: ['Twitch'], subs: '100K', subsParsed: 100_000,
    avgViews: '5K', eng: '3%', genre: 'Gaming', cpi: 70, gfi: null,
    color: '#fff', verifiedDeals: 0, sponsorHistory: [], bio: '',
    ...overrides,
  };
}

interface QueryStub {
  result: { data: unknown; error: unknown; count: number | null };
  from: Mock; select: Mock; eq: Mock; order: Mock; limit: Mock; maybeSingle: Mock;
  then: (onFulfilled: (v: QueryStub['result']) => unknown) => Promise<unknown>;
}

function makeQuery(initial: Partial<QueryStub['result']> = {}): QueryStub {
  const q = { result: { data: null, error: null, count: null, ...initial } } as Partial<QueryStub> as QueryStub;
  const make = () => vi.fn(() => q);
  q.from = make(); q.select = make(); q.eq = make(); q.order = make(); q.limit = make(); q.maybeSingle = make();
  q.then = (onFulfilled) => Promise.resolve(onFulfilled(q.result));
  return q;
}

function setup(query: QueryStub) {
  const fromSpy = vi.fn(() => query);
  const supabaseStub = { client: { from: fromSpy } };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: SupabaseService, useValue: supabaseStub }],
  });
  return { svc: TestBed.inject(TwitchLiveService), fromSpy, query };
}

const NOW = new Date('2026-06-19T12:00:00Z');

describe('TwitchLiveService.fetchEnrichment', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns live=true when session last_seen_at is 2 min ago', async () => {
    const lastSeen = new Date(NOW.getTime() - 2 * 60_000).toISOString();
    const q = makeQuery({ data: { started_at: '2026-06-19T11:55:00Z', last_seen_at: lastSeen, game_name: 'Fortnite', title: 'Test stream', viewer_peak: 200, avg_ccv: 150 } });
    const { svc } = setup(q);
    const r = await svc.fetchEnrichment(makeCreator());
    expect(r?.live).toBe(true);
    expect(r?.viewerCount).toBe(150); // avg_ccv when present
    expect(r?.gameName).toBe('Fortnite');
    expect(r?.title).toBe('Test stream');
    expect(r?.daysSinceStream).toBe(0);
  });

  it('uses viewer_peak as viewerCount when avg_ccv is null (open session)', async () => {
    const lastSeen = new Date(NOW.getTime() - 2 * 60_000).toISOString();
    const q = makeQuery({ data: { started_at: '2026-06-19T11:55:00Z', last_seen_at: lastSeen, game_name: 'Minecraft', title: 'Stream', viewer_peak: 108, avg_ccv: null } });
    const { svc } = setup(q);
    const r = await svc.fetchEnrichment(makeCreator());
    expect(r?.live).toBe(true);
    expect(r?.viewerCount).toBe(108);
  });

  it('returns offline when last_seen_at is 30 min ago (stale open session)', async () => {
    const lastSeen = new Date(NOW.getTime() - 30 * 60_000).toISOString();
    const q = makeQuery({ data: { started_at: '2026-06-19T11:00:00Z', last_seen_at: lastSeen, game_name: 'Minecraft', title: 'Old stream', viewer_peak: 50, avg_ccv: 40 } });
    const { svc } = setup(q);
    const r = await svc.fetchEnrichment(makeCreator());
    expect(r?.live).toBe(false);
  });

  it('returns offline when no session (maybeSingle returns null data)', async () => {
    const q = makeQuery({ data: null });
    const { svc } = setup(q);
    const lastStreamAt = new Date(NOW.getTime() - 2 * 24 * 60 * 60_000).toISOString(); // 2 days ago
    const creator = makeCreator({ twitchStats: { avgCcv: 0, peakCcv: 0, streams30d: 0, hoursStreamed30d: 0, lastStreamAt, primaryGameName: null, liveRefreshedAt: null } });
    const r = await svc.fetchEnrichment(creator);
    expect(r?.live).toBe(false);
    expect(r?.daysSinceStream).toBe(2);
  });

  it('daysSinceStream is 0 when lastStreamAt is today', async () => {
    const q = makeQuery({ data: null });
    const { svc } = setup(q);
    const lastStreamAt = new Date(NOW.getTime() - 30 * 60_000).toISOString(); // 30 min ago (same day)
    const creator = makeCreator({ twitchStats: { avgCcv: 0, peakCcv: 0, streams30d: 0, hoursStreamed30d: 0, lastStreamAt, primaryGameName: null, liveRefreshedAt: null } });
    const r = await svc.fetchEnrichment(creator);
    expect(r?.daysSinceStream).toBe(0);
  });

  it('daysSinceStream is null when twitchStats is undefined', async () => {
    const q = makeQuery({ data: null });
    const { svc } = setup(q);
    const r = await svc.fetchEnrichment(makeCreator({ twitchStats: undefined }));
    expect(r?.daysSinceStream).toBeNull();
  });

  it('returns offline (not throwing) on DB error, daysSinceStream from lastStreamAt', async () => {
    const q = makeQuery({ data: null, error: { message: 'DB error' } });
    const { svc } = setup(q);
    const lastStreamAt = new Date(NOW.getTime() - 5 * 24 * 60 * 60_000).toISOString(); // 5 days ago
    const creator = makeCreator({ twitchStats: { avgCcv: 0, peakCcv: 0, streams30d: 0, hoursStreamed30d: 0, lastStreamAt, primaryGameName: null, liveRefreshedAt: null } });
    const r = await svc.fetchEnrichment(creator);
    expect(r?.live).toBe(false);
    expect(r?.daysSinceStream).toBe(5);
  });

  it('caches: from() invoked once for two fetchEnrichment calls with same creator', async () => {
    const q = makeQuery({ data: null });
    const { svc, fromSpy } = setup(q);
    const creator = makeCreator();
    await svc.fetchEnrichment(creator);
    await svc.fetchEnrichment(creator);
    expect(fromSpy).toHaveBeenCalledTimes(1);
  });
});
