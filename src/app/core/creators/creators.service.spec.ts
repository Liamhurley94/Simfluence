import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { CreatorsService, formatCompact, parseSubs } from './creators.service';
import { SupabaseService } from '../supabase/supabase.service';
import { computeRateRanges } from '../rates/rate-estimate';

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

// A thenable query-builder stub: every chained method (.eq, .order, .range, …)
// returns the same object, so call order and arguments are easy to assert. The
// awaited value is whatever the caller stuffs into `result`.
interface QueryStub {
  result: { data: unknown; error: unknown; count: number | null };
  from: Mock;
  select: Mock;
  eq: Mock;
  overlaps: Mock;
  in: Mock;
  or: Mock;
  gte: Mock;
  lt: Mock;
  order: Mock;
  range: Mock;
  maybeSingle: Mock;
  then: (onFulfilled: (v: QueryStub['result']) => unknown) => Promise<unknown>;
}

function makeQuery(initial: Partial<QueryStub['result']> = {}): QueryStub {
  const q = {
    result: { data: [], error: null, count: 0, ...initial },
  } as Partial<QueryStub> as QueryStub;
  // Each chained method gets its own spy (sharing one breaks `not.toHaveBeenCalled`
  // assertions) but all return the same `q` so chaining works.
  const make = () => vi.fn(() => q);
  q.from = make();
  q.select = make();
  q.eq = make();
  q.overlaps = make();
  q.in = make();
  q.or = make();
  q.gte = make();
  q.lt = make();
  q.order = make();
  q.range = make();
  q.maybeSingle = make();
  q.then = (onFulfilled) => Promise.resolve(onFulfilled(q.result));
  return q;
}

function setup(query: QueryStub = makeQuery(), rpc: Mock = vi.fn().mockResolvedValue({ data: [] })) {
  const fromSpy = vi.fn(() => query);
  const supabaseStub = { client: { from: fromSpy, rpc } };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: SupabaseService, useValue: supabaseStub }],
  });
  return { svc: TestBed.inject(CreatorsService), query, rpc, fromSpy };
}

describe('CreatorsService.byId / byIds', () => {
  it('byIds queries the creator_cpi view so hydrated creators carry best_cpi', async () => {
    const { svc, fromSpy } = setup();
    await svc.byIds([1, 2]);
    expect(fromSpy).toHaveBeenCalledWith('creator_cpi');
  });

  it('byId queries the creator_cpi view', async () => {
    const { svc, fromSpy } = setup(makeQuery({ data: { id: 1, name: 'X' } }));
    await svc.byId(1);
    expect(fromSpy).toHaveBeenCalledWith('creator_cpi');
  });
});

describe('CreatorsService.list', () => {
  it('builds a paginated select with count and orders by best_cpi (show-all)', async () => {
    const { svc, query } = setup(makeQuery({ data: [], count: 0 }));
    await svc.list({}, 'cpi', 0, 10);
    const selectArg = query.select.mock.calls[0][0] as string;
    expect(selectArg).toContain('*');
    expect(query.select.mock.calls[0][1]).toEqual({ count: 'exact' });
    expect(query.order).toHaveBeenCalledWith('best_cpi', { ascending: false, nullsFirst: false });
    expect(query.range).toHaveBeenCalledWith(0, 9);
  });

  it('clamps over-range page to last page', async () => {
    const { svc } = setup(makeQuery({ data: [], count: 25 }));
    const r = await svc.list({}, 'cpi', 999_999, 10);
    expect(r.pageCount).toBe(3);
    expect(r.page).toBe(2);
  });

  it('sorts by subs uses subs_parsed column, descending', async () => {
    const { svc, query } = setup();
    await svc.list({}, 'subs', 0, 10);
    expect(query.order).toHaveBeenCalledWith('subs_parsed', { ascending: false });
  });

  it('sort=name uses ascending order', async () => {
    const { svc, query } = setup();
    await svc.list({}, 'name', 0, 10);
    expect(query.order).toHaveBeenCalledWith('name', { ascending: true });
  });

  it('applies genre filter via .eq', async () => {
    const { svc, query } = setup();
    await svc.list({ genre: 'Gaming & Esports' }, 'cpi', 0, 10);
    expect(query.eq).toHaveBeenCalledWith('genre', 'Gaming & Esports');
  });

  it('applies a non-table platform filter via .overlaps on all_platforms', async () => {
    const { svc, query } = setup();
    await svc.list({ platform: 'Kick' }, 'cpi', 0, 10);
    expect(query.overlaps).toHaveBeenCalledWith('all_platforms', ['Kick']);
  });

  it('applies languages filter via .in', async () => {
    const { svc, query } = setup();
    await svc.list({ languages: ['English'] }, 'cpi', 0, 10);
    expect(query.in).toHaveBeenCalledWith('language', ['English']);
  });

  it('escapes % and _ wildcards in search', async () => {
    const { svc, query } = setup();
    await svc.list({ search: '50%_off' }, 'cpi', 0, 10);
    expect(query.or).toHaveBeenCalledWith(
      'name.ilike.%50\\%\\_off%,handle.ilike.%50\\%\\_off%,bio.ilike.%50\\%\\_off%',
    );
  });

  it('tier=Megastar adds subs_parsed gte 2_000_000 with no upper bound', async () => {
    const { svc, query } = setup();
    await svc.list({ tier: 'Megastar' }, 'cpi', 0, 10);
    expect(query.gte).toHaveBeenCalledWith('subs_parsed', 2_000_000);
    expect(query.lt).not.toHaveBeenCalled();
  });

  it('tier=Micro adds subs_parsed gte 0 and lt 50_000', async () => {
    const { svc, query } = setup();
    await svc.list({ tier: 'Micro' }, 'cpi', 0, 10);
    expect(query.gte).toHaveBeenCalledWith('subs_parsed', 0);
    expect(query.lt).toHaveBeenCalledWith('subs_parsed', 50_000);
  });

  it('minCpi adds best_cpi gte (show-all default mode)', async () => {
    const { svc, query } = setup();
    await svc.list({ minCpi: 70 }, 'cpi', 0, 10);
    expect(query.gte).toHaveBeenCalledWith('best_cpi', 70);
  });

  it('minGfi adds gfi gte (requires a genre — GFI is genre-relative)', async () => {
    const { svc, query } = setup();
    // GFI lives in the genre-keyed `creator_genre_scores` embed, so minGfi only
    // applies when a genre is set and filters on the embedded dot-notation column.
    await svc.list({ genre: 'Gaming & Esports', minGfi: 65 }, 'cpi', 0, 10);
    expect(query.gte).toHaveBeenCalledWith('creator_genre_scores.gfi', 65);
  });

  it('filters the genre-score embed on sub_mode (defaults to baseline "")', async () => {
    const { svc, query } = setup();
    await svc.list({ genre: 'Gaming & Esports' }, 'cpi', 0, 10);
    expect(query.eq).toHaveBeenCalledWith('creator_genre_scores.sub_mode', '');

    const { svc: svc2, query: query2 } = setup();
    await svc2.list({ genre: 'Gaming & Esports', subMode: 'Battle Royale' }, 'cpi', 0, 10);
    expect(query2.eq).toHaveBeenCalledWith('creator_genre_scores.sub_mode', 'Battle Royale');
  });

  it('minCpi/minGfi=0 is treated as no filter', async () => {
    const { svc, query } = setup();
    await svc.list({ minCpi: 0, minGfi: 0 }, 'cpi', 0, 10);
    expect(query.gte).not.toHaveBeenCalled();
  });

  it('show-all mode (no platform) queries the creator_cpi view', async () => {
    const { svc, fromSpy } = setup();
    await svc.list({}, 'cpi', 0, 10);
    expect(fromSpy).toHaveBeenCalledWith('creator_cpi');
  });

  it('show-all mode orders by best_cpi descending, NULLS LAST', async () => {
    const { svc, query } = setup();
    await svc.list({}, 'cpi', 0, 10);
    expect(query.order).toHaveBeenCalledWith('best_cpi', { ascending: false, nullsFirst: false });
  });

  it('show-all mode minCpi filters on best_cpi', async () => {
    const { svc, query } = setup();
    await svc.list({ minCpi: 70 }, 'cpi', 0, 10);
    expect(query.gte).toHaveBeenCalledWith('best_cpi', 70);
  });

  it('platform-filtered mode (YouTube) queries the creators base table', async () => {
    const { svc, fromSpy } = setup();
    await svc.list({ platform: 'YouTube' }, 'cpi', 0, 10);
    expect(fromSpy).toHaveBeenCalledWith('creators');
  });

  it('platform-filtered YouTube embeds yt_cpi and sorts cpi on the youtube_creators table', async () => {
    const { svc, query } = setup();
    await svc.list({ platform: 'YouTube' }, 'cpi', 0, 10);
    const selectArg = query.select.mock.calls[0][0] as string;
    expect(selectArg).toContain('youtube_creators!inner(');
    expect(selectArg).toContain('yt_cpi');
    expect(query.order).toHaveBeenCalledWith('yt_cpi', { ascending: false, nullsFirst: false, referencedTable: 'youtube_creators' });
  });

  it('platform-filtered YouTube minCpi filters on the embedded yt_cpi (dot-notation)', async () => {
    const { svc, query } = setup();
    await svc.list({ platform: 'YouTube', minCpi: 60 }, 'cpi', 0, 10);
    // PostgREST filters on an embedded resource use dot-notation column names —
    // there is NO referencedTable option on filter methods (only on .order()).
    expect(query.gte).toHaveBeenCalledWith('youtube_creators.yt_cpi', 60);
  });

  it('maps DB row → Creator (snake_case → camelCase, subs_parsed → subsParsed)', async () => {
    const row = {
      id: 7,
      name: 'A',
      handle: '@a',
      platform: 'YouTube',
      all_platforms: ['YouTube'],
      subs: '1.5M',
      subs_parsed: 1_500_000,
      avg_views: '200K',
      eng: '4%',
      genre: 'Gaming',
      cpi: 80,
      gfi: 70,
      color: '#fff',
      verified_deals: 1,
      sponsor_history: ['X'],
      bio: 'b',
    };
    const { svc } = setup(makeQuery({ data: [row], count: 1 }));
    const r = await svc.list({}, 'cpi', 0, 10);
    expect(r.creators[0].subsParsed).toBe(1_500_000);
    expect(r.creators[0].allPlatforms).toEqual(['YouTube']);
    expect(r.creators[0].verifiedDeals).toBe(1);
  });
});

describe('CreatorsService.byId', () => {
  it('returns the row when present', async () => {
    const { svc } = setup(makeQuery({ data: { id: 42, subs_parsed: 100 } as unknown, count: null }));
    const c = await svc.byId(42);
    expect(c?.id).toBe(42);
  });

  it('returns undefined when missing', async () => {
    const { svc } = setup(makeQuery({ data: null, count: null }));
    expect(await svc.byId(-1)).toBeUndefined();
  });
});

describe('CreatorsService.loadFilterOptions', () => {
  it('fans out to the filter-option RPCs and populates signals', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'get_creator_genres') return { data: ['Gaming', 'Music'] };
      if (name === 'get_creator_platforms') return { data: ['Twitch', 'YouTube'] };
      if (name === 'get_languages') return { data: [{ code: 'en', name: 'English' }, { code: 'de', name: 'German' }] };
      if (name === 'get_creator_languages') return { data: [{ code: 'en', name: 'English' }] };
      return { data: null };
    });
    const { svc } = setup(makeQuery(), rpc as unknown as Mock);
    await svc.loadFilterOptions();
    expect(svc.genres()).toEqual(['Gaming', 'Music']);
    expect(svc.platforms()).toEqual(['Twitch', 'YouTube']);
    expect(svc.languages()).toEqual([{ code: 'en', name: 'English' }, { code: 'de', name: 'German' }]);
    expect(svc.usedLanguages()).toEqual([{ code: 'en', name: 'English' }]);
    expect(svc.loaded()).toBe(true);
  });
});

describe('fromDb — twitchStats mapping', () => {
  it('maps twitch_creators embed to twitchStats on Creator', async () => {
    const row = {
      id: 10, name: 'TwitchGuy', handle: '@tw', platform: 'Twitch',
      all_platforms: ['Twitch'], subs: '200K', subs_parsed: 200_000,
      avg_views: '0', eng: '0%', genre: 'Gaming', cpi: 65, gfi: null,
      color: '#9147ff', verified_deals: 0, sponsor_history: [],
      bio: '',
      twitch_creators: [{
        avg_ccv: 1200, peak_ccv: 3500, streams_30d: 12,
        hours_streamed_30d: 36, last_stream_at: '2026-06-15T20:00:00Z',
        primary_game_name: 'Valorant', live_refreshed_at: '2026-06-19T00:00:00Z',
      }],
    };
    const { svc } = setup(makeQuery({ data: row }));
    const creator = await svc.byId(10);
    expect(creator?.twitchStats).toBeDefined();
    expect(creator?.twitchStats?.avgCcv).toBe(1200);
    expect(creator?.twitchStats?.peakCcv).toBe(3500);
    expect(creator?.twitchStats?.streams30d).toBe(12);
    expect(creator?.twitchStats?.lastStreamAt).toBe('2026-06-15T20:00:00Z');
    expect(creator?.twitchStats?.primaryGameName).toBe('Valorant');
  });

  it('leaves twitchStats undefined when no twitch embed', async () => {
    const row = {
      id: 11, name: 'YTOnly', handle: '@yt', platform: 'YouTube',
      all_platforms: ['YouTube'], subs: '300K', subs_parsed: 300_000,
      avg_views: '0', eng: '0%', genre: 'Tech', cpi: 70, gfi: null,
      color: '#ff0', verified_deals: 0, sponsor_history: [], bio: '',
      twitch_creators: [],
    };
    const { svc } = setup(makeQuery({ data: row }));
    const creator = await svc.byId(11);
    expect(creator?.twitchStats).toBeUndefined();
  });
});

describe('formatCompact', () => {
  it('formats millions with one decimal', () => {
    expect(formatCompact(16_900_000)).toBe('16.9M');
  });

  it('formats thousands with no decimal', () => {
    expect(formatCompact(913_385)).toBe('913K');
  });

  it('leaves sub-1000 values as plain integers', () => {
    expect(formatCompact(950)).toBe('950');
  });

  it('roundtrips through parseSubs to ~the same magnitude', () => {
    expect(parseSubs(formatCompact(16_900_000))).toBe(16_900_000);
    expect(Math.abs(parseSubs(formatCompact(913_385)) - 913_385)).toBeLessThan(1_000);
    expect(parseSubs(formatCompact(950))).toBe(950);
  });
});

describe('fromDb — live-first stat overlay', () => {
  it('YouTube-primary: overlays subs/subsParsed/avgViews/eng from ytStats over empty static columns', async () => {
    const row = {
      id: 20, name: 'Linus Tech Tips', handle: '@ltt', platform: 'YouTube',
      all_platforms: ['YouTube'], subs: '', subs_parsed: 0,
      avg_views: '', eng: '', genre: 'Tech & Gadgets', cpi: 80, gfi: null,
      color: '#fff', verified_deals: 0, sponsor_history: [], bio: '',
      youtube_creators: [{
        subscriber_count: 16_900_000, avg_views: 913_385, engagement_rate: 3.4,
        sponsor_freq_pct: 12, stats_refreshed_at: '2026-07-01T00:00:00Z',
      }],
    };
    const { svc } = setup(makeQuery({ data: row }));
    const creator = await svc.byId(20);
    expect(creator?.subs).toBe('16.9M');
    expect(creator?.subsParsed).toBe(16_900_000);
    expect(creator?.avgViews).toBe('913K');
    expect(creator?.eng).toBe('3.4%');
  });

  it('Twitch-primary: overlays avgViews from twitchStats.avgCcv, leaves subs/subsParsed/eng static', async () => {
    const row = {
      id: 21, name: 'StreamerGuy', handle: '@sg', platform: 'Twitch',
      all_platforms: ['Twitch'], subs: '180K', subs_parsed: 180_000,
      avg_views: '0', eng: '0%', genre: 'Gaming & Esports', cpi: 60, gfi: null,
      color: '#9147ff', verified_deals: 0, sponsor_history: [], bio: '',
      twitch_creators: [{
        avg_ccv: 2500, peak_ccv: 5000, streams_30d: 10,
        hours_streamed_30d: 30, last_stream_at: null, primary_game_name: null,
        live_refreshed_at: null,
      }],
    };
    const { svc } = setup(makeQuery({ data: row }));
    const creator = await svc.byId(21);
    expect(creator?.avgViews).toBe('3K');
    expect(creator?.subs).toBe('180K');
    expect(creator?.subsParsed).toBe(180_000);
    expect(creator?.eng).toBe('0%');
  });

  it('legacy row (no embedded stats): all four fields identical to static values (regression)', async () => {
    const row = {
      id: 22, name: 'Legacy Creator', handle: '@legacy', platform: 'YouTube',
      all_platforms: ['YouTube'], subs: '500K', subs_parsed: 500_000,
      avg_views: '80K', eng: '4.1%', genre: 'Gaming & Esports', cpi: 70, gfi: null,
      color: '#fff', verified_deals: 0, sponsor_history: [], bio: '',
    };
    const { svc } = setup(makeQuery({ data: row }));
    const creator = await svc.byId(22);
    expect(creator?.subs).toBe('500K');
    expect(creator?.subsParsed).toBe(500_000);
    expect(creator?.avgViews).toBe('80K');
    expect(creator?.eng).toBe('4.1%');
  });
});

describe('rate-estimate sanity — live overlay unblocks floor pricing', () => {
  it('Linus-like creator with live YouTube stats prices well above the static-floor ($150/$300)', async () => {
    const row = {
      id: 23, name: 'Linus Tech Tips', handle: '@ltt', platform: 'YouTube',
      all_platforms: ['YouTube'], subs: '', subs_parsed: 0,
      avg_views: '', eng: '', genre: 'Tech & Gadgets', cpi: 80, gfi: null,
      color: '#fff', verified_deals: 0, sponsor_history: [], bio: '',
      youtube_creators: [{
        subscriber_count: 16_900_000, avg_views: 913_385, engagement_rate: 3.4,
        sponsor_freq_pct: 12, stats_refreshed_at: '2026-07-01T00:00:00Z',
      }],
    };
    const { svc } = setup(makeQuery({ data: row }));
    const creator = await svc.byId(23);
    const rates = computeRateRanges(creator!);
    // 913K avg views × ~$0.085 CPV × scale ≈ tens of thousands — loose lower
    // bound, not an exact figure (coefficients are IP, see rate-estimate.ts).
    expect(rates.ded[0]).toBeGreaterThan(10_000);
  });
});

describe('CreatorsService language lists', () => {
  it('loadFilterOptions populates all + in-use languages and languageName maps codes', async () => {
    const rpc = vi.fn().mockImplementation((name: string) => {
      if (name === 'get_languages') return Promise.resolve({ data: [{ code: 'en', name: 'English' }, { code: 'de', name: 'German' }], error: null });
      if (name === 'get_creator_languages') return Promise.resolve({ data: [{ code: 'en', name: 'English' }], error: null });
      return Promise.resolve({ data: [], error: null });
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [CreatorsService, { provide: SupabaseService, useValue: { client: { rpc } } }] });
    const svc = TestBed.inject(CreatorsService);
    await svc.loadFilterOptions();
    expect(svc.languages()).toEqual([{ code: 'en', name: 'English' }, { code: 'de', name: 'German' }]);
    expect(svc.usedLanguages()).toEqual([{ code: 'en', name: 'English' }]);
    expect(svc.languageName('de')).toBe('German');
    expect(svc.languageName('xx')).toBe('xx');
  });
});
