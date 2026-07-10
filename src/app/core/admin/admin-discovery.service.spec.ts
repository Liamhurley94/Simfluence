import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AdminDiscoveryService } from './admin-discovery.service';
import { EdgeClient } from '../api/edge.client';
import { SupabaseService } from '../supabase/supabase.service';

// A thenable query-builder stub: every chained method (.eq, .order, .range, …)
// returns the same object, so call order and arguments are easy to assert. The
// awaited value is whatever the caller stuffs into `result`. Mirrors
// creators.service.spec.ts's makeQuery.
interface QueryStub {
  result: { data: unknown; error: unknown; count: number | null };
  from: Mock;
  select: Mock;
  update: Mock;
  eq: Mock;
  neq: Mock;
  in: Mock;
  order: Mock;
  range: Mock;
  limit: Mock;
  then: (onFulfilled: (v: QueryStub['result']) => unknown) => Promise<unknown>;
}

function makeQuery(initial: Partial<QueryStub['result']> = {}): QueryStub {
  const q = {
    result: { data: [], error: null, count: 0, ...initial },
  } as Partial<QueryStub> as QueryStub;
  const make = () => vi.fn(() => q);
  q.from = make();
  q.select = make();
  q.update = make();
  q.eq = make();
  q.neq = make();
  q.in = make();
  q.order = make();
  q.range = make();
  q.limit = make();
  q.then = (onFulfilled) => Promise.resolve(onFulfilled(q.result));
  return q;
}

describe('AdminDiscoveryService', () => {
  let post: ReturnType<typeof vi.fn>;
  let query: QueryStub;
  let fromSpy: ReturnType<typeof vi.fn>;
  let rpc: ReturnType<typeof vi.fn>;
  let svc: AdminDiscoveryService;

  beforeEach(() => {
    post = vi.fn().mockResolvedValue({});
    query = makeQuery();
    fromSpy = vi.fn(() => query);
    rpc = vi.fn().mockResolvedValue({ data: [] });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AdminDiscoveryService,
        { provide: EdgeClient, useValue: { post } },
        { provide: SupabaseService, useValue: { client: { from: fromSpy, rpc } } },
      ],
    });
    svc = TestBed.inject(AdminDiscoveryService);
  });

  describe('search', () => {
    it('POSTs admin-discover-creators with mode: search and the input spread in', async () => {
      await svc.search({ genre: 'Gaming & Esports', subMode: 'Battle Royale', query: 'valorant', maxResults: 10 });
      expect(post).toHaveBeenCalledWith('admin-discover-creators', {
        mode: 'search', genre: 'Gaming & Esports', subMode: 'Battle Royale', query: 'valorant', maxResults: 10,
      });
    });

    it('works with no input fields (sweep-adjacent bare search)', async () => {
      await svc.search({});
      expect(post).toHaveBeenCalledWith('admin-discover-creators', { mode: 'search' });
    });
  });

  describe('startSweep', () => {
    it('POSTs admin-discover-creators with mode: sweep and the input spread in', async () => {
      await svc.startSweep({ genre: 'Gaming & Esports', subMode: 'Battle Royale' });
      expect(post).toHaveBeenCalledWith('admin-discover-creators', {
        mode: 'sweep', genre: 'Gaming & Esports', subMode: 'Battle Royale',
      });
    });
  });

  describe('listRuns', () => {
    it('queries discovery_runs ordered by created_at desc, limit 25', async () => {
      await svc.listRuns();
      expect(fromSpy).toHaveBeenCalledWith('discovery_runs');
      expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(query.limit).toHaveBeenCalledWith(25);
    });

    it('returns [] when data is null', async () => {
      query.result.data = null;
      const rows = await svc.listRuns();
      expect(rows).toEqual([]);
    });

    it('throws on error', async () => {
      query.result.error = { message: 'boom' };
      await expect(svc.listRuns()).rejects.toThrow('boom');
    });
  });

  describe('cancelRun', () => {
    it('updates discovery_runs status to cancelled for the given run id', async () => {
      await svc.cancelRun('run-1');
      expect(fromSpy).toHaveBeenCalledWith('discovery_runs');
      expect(query.update).toHaveBeenCalledWith({ status: 'cancelled' });
      expect(query.eq).toHaveBeenCalledWith('id', 'run-1');
    });

    it('throws on error', async () => {
      query.result.error = { message: 'nope' };
      await expect(svc.cancelRun('run-1')).rejects.toThrow('nope');
    });
  });

  describe('listQueue', () => {
    it('applies the status filter and returns rows + total count', async () => {
      const rows = [{ channel_id: 'c1', status: 'new' }];
      query.result = { data: rows, error: null, count: 1 };
      const res = await svc.listQueue({ status: 'new' }, 0);
      expect(fromSpy).toHaveBeenCalledWith('discovered_channels');
      expect(query.eq).toHaveBeenCalledWith('status', 'new');
      expect(res).toEqual({ rows, total: 1 });
    });

    it('applies genre and runId filters when present', async () => {
      await svc.listQueue({ genre: 'Gaming & Esports', runId: 'run-1' }, 0);
      expect(query.eq).toHaveBeenCalledWith('genre', 'Gaming & Esports');
      expect(query.eq).toHaveBeenCalledWith('run_id', 'run-1');
    });

    it('omits filters that are not provided', async () => {
      await svc.listQueue({}, 0);
      expect(query.eq).not.toHaveBeenCalled();
    });

    it('always excludes purged tombstone rows via neq name', async () => {
      await svc.listQueue({}, 0);
      expect(query.neq).toHaveBeenCalledWith('name', '');
    });

    it('paginates with page * pageSize ranges (default pageSize 50)', async () => {
      await svc.listQueue({}, 2);
      expect(query.range).toHaveBeenCalledWith(100, 149);
    });

    it('respects a custom pageSize', async () => {
      await svc.listQueue({}, 1, 20);
      expect(query.range).toHaveBeenCalledWith(20, 39);
    });

    it('defaults total to 0 when count is null', async () => {
      query.result = { data: [], error: null, count: null };
      const res = await svc.listQueue({}, 0);
      expect(res.total).toBe(0);
    });

    it('throws on error', async () => {
      query.result.error = { message: 'query failed' };
      await expect(svc.listQueue({}, 0)).rejects.toThrow('query failed');
    });
  });

  describe('setStatus', () => {
    it('updates status + reviewed_at and filters by the given channel ids', async () => {
      const before = Date.now();
      await svc.setStatus(['c1', 'c2'], 'shortlisted');
      expect(fromSpy).toHaveBeenCalledWith('discovered_channels');
      expect(query.update).toHaveBeenCalledTimes(1);
      const [payload] = query.update.mock.calls[0];
      expect(payload.status).toBe('shortlisted');
      expect(new Date(payload.reviewed_at).getTime()).toBeGreaterThanOrEqual(before);
      expect(query.in).toHaveBeenCalledWith('channel_id', ['c1', 'c2']);
    });

    it('throws on error', async () => {
      query.result.error = { message: 'update failed' };
      await expect(svc.setStatus(['c1'], 'rejected')).rejects.toThrow('update failed');
    });
  });

  describe('quotaStatus', () => {
    it('calls youtube_quota_status and returns the single row', async () => {
      rpc.mockResolvedValueOnce({
        data: [{ effective_ceiling: 950000, elevated_limit: 950000, default_limit: 9500, elevated_until: '2027-01-08T08:00:00+00:00', used_today: 1200 }],
      });
      const s = await svc.quotaStatus();
      expect(rpc).toHaveBeenCalledWith('youtube_quota_status');
      expect(s?.effective_ceiling).toBe(950000);
    });

    it('returns null on empty (non-admin / no data)', async () => {
      rpc.mockResolvedValueOnce({ data: [] });
      expect(await svc.quotaStatus()).toBeNull();
    });
  });
});
