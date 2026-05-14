import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { CreatorsService, parseSubs } from './creators.service';
import { SupabaseService } from '../supabase/supabase.service';

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
  const supabaseStub = { client: { from: () => query, rpc } };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: SupabaseService, useValue: supabaseStub }],
  });
  return { svc: TestBed.inject(CreatorsService), query, rpc };
}

describe('CreatorsService.list', () => {
  it('builds a paginated select with count', async () => {
    const { svc, query } = setup(makeQuery({ data: [], count: 0 }));
    await svc.list({}, 'cpi', 0, 10);
    expect(query.select).toHaveBeenCalledWith('*', { count: 'exact' });
    expect(query.order).toHaveBeenCalledWith('cpi', { ascending: false });
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

  it('applies platforms filter via .overlaps on all_platforms', async () => {
    const { svc, query } = setup();
    await svc.list({ platforms: ['Twitch', 'YouTube'] }, 'cpi', 0, 10);
    expect(query.overlaps).toHaveBeenCalledWith('all_platforms', ['Twitch', 'YouTube']);
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

  it('minCpi adds cpi gte', async () => {
    const { svc, query } = setup();
    await svc.list({ minCpi: 70 }, 'cpi', 0, 10);
    expect(query.gte).toHaveBeenCalledWith('cpi', 70);
  });

  it('minGfi adds gfi gte', async () => {
    const { svc, query } = setup();
    await svc.list({ minGfi: 65 }, 'cpi', 0, 10);
    expect(query.gte).toHaveBeenCalledWith('gfi', 65);
  });

  it('minCpi/minGfi=0 is treated as no filter', async () => {
    const { svc, query } = setup();
    await svc.list({ minCpi: 0, minGfi: 0 }, 'cpi', 0, 10);
    expect(query.gte).not.toHaveBeenCalled();
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
  it('fans out to three RPCs and populates signals', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'get_creator_genres') return { data: ['Gaming', 'Music'] };
      if (name === 'get_creator_platforms') return { data: ['Twitch', 'YouTube'] };
      if (name === 'get_creator_languages') return { data: ['English'] };
      return { data: null };
    });
    const { svc } = setup(makeQuery(), rpc as unknown as Mock);
    await svc.loadFilterOptions();
    expect(svc.genres()).toEqual(['Gaming', 'Music']);
    expect(svc.platforms()).toEqual(['Twitch', 'YouTube']);
    expect(svc.languages()).toEqual(['English']);
    expect(svc.loaded()).toBe(true);
  });
});
