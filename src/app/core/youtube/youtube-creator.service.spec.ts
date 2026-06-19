import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { YoutubeCreatorService } from './youtube-creator.service';
import { SupabaseService } from '../supabase/supabase.service';
import { Creator } from '../data/creator.types';

function makeCreator(id = 1): Creator {
  return {
    id, name: 'YT Creator', handle: '@yt', platform: 'YouTube',
    allPlatforms: ['YouTube'], subs: '500K', subsParsed: 500_000,
    avgViews: '50K', eng: '4%', genre: 'Tech', cpi: 75, gfi: null,
    color: '#ff0', verifiedDeals: 2, sponsorHistory: ['BrandX'], bio: 'bio',
  };
}

interface QueryStub {
  result: { data: unknown; error: unknown; count: number | null };
  from: Mock; select: Mock; eq: Mock; is: Mock; maybeSingle: Mock;
  then: (onFulfilled: (v: QueryStub['result']) => unknown) => Promise<unknown>;
}

function makeQuery(initial: Partial<QueryStub['result']> = {}): QueryStub {
  const q = { result: { data: null, error: null, count: null, ...initial } } as Partial<QueryStub> as QueryStub;
  const make = () => vi.fn(() => q);
  q.from = make(); q.select = make(); q.eq = make(); q.is = make(); q.maybeSingle = make();
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
  return { svc: TestBed.inject(YoutubeCreatorService), fromSpy };
}

describe('YoutubeCreatorService.fetch', () => {
  it('queries youtube_creators (NOT creator_youtube_stats)', async () => {
    const q = makeQuery({ data: { creator_id: 1, subscriber_count: 500_000 } });
    const { svc, fromSpy } = setup(q);
    await svc.fetch(makeCreator(1));
    expect(fromSpy).toHaveBeenCalledWith('youtube_creators');
  });

  it('returns the row on success', async () => {
    const row = { creator_id: 1, subscriber_count: 500_000, avg_views: 50_000 };
    const q = makeQuery({ data: row });
    const { svc } = setup(q);
    const result = await svc.fetch(makeCreator(1));
    expect(result).toEqual(row);
  });

  it('returns null on error and clears the cache', async () => {
    const q = makeQuery({ data: null, error: { message: 'DB error' } });
    const { svc, fromSpy } = setup(q);
    const creator = makeCreator(1);
    const r = await svc.fetch(creator);
    expect(r).toBeNull();
    // Second fetch should re-query (cache was cleared)
    await svc.fetch(creator);
    expect(fromSpy).toHaveBeenCalledTimes(2);
  });

  it('caches on success: second call does not re-query', async () => {
    const q = makeQuery({ data: { creator_id: 1 } });
    const { svc, fromSpy } = setup(q);
    const creator = makeCreator(1);
    await svc.fetch(creator);
    await svc.fetch(creator);
    expect(fromSpy).toHaveBeenCalledTimes(1);
  });
});
