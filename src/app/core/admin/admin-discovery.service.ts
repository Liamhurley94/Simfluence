import { Injectable, inject } from '@angular/core';
import { EdgeClient } from '../api/edge.client';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CandidateStatus, DiscoveredChannel, DiscoveryRun, QuotaStatus, SearchResult,
} from './admin-discovery.types';

/** Admin creator discovery. Edge fn for anything touching YouTube (search,
 *  sweeps); plain PostgREST under admin RLS for queue reads + review flips
 *  (no quota involved — spec decision: only YT-touching actions need edge fns). */
@Injectable({ providedIn: 'root' })
export class AdminDiscoveryService {
  private edge = inject(EdgeClient);
  private supabase = inject(SupabaseService);

  search(input: { genre?: string; subMode?: string; query?: string; maxResults?: number; minSubscribers?: number }): Promise<SearchResult> {
    return this.edge.post('admin-discover-creators', { mode: 'search', ...input });
  }

  startSweep(input: { genre?: string; subMode?: string; minSubscribers?: number }): Promise<{ runId: string; queryTotal: number }> {
    return this.edge.post('admin-discover-creators', { mode: 'sweep', ...input });
  }

  async listRuns(): Promise<DiscoveryRun[]> {
    const { data, error } = await this.supabase.client
      .from('discovery_runs').select('*').order('created_at', { ascending: false }).limit(25);
    if (error) throw new Error(error.message);
    return (data ?? []) as DiscoveryRun[];
  }

  async cancelRun(runId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('discovery_runs').update({ status: 'cancelled' }).eq('id', runId);
    if (error) throw new Error(error.message);
  }

  async listQueue(filter: { status?: CandidateStatus; genre?: string; runId?: string },
                  page: number, pageSize = 50): Promise<{ rows: DiscoveredChannel[]; total: number }> {
    let q = this.supabase.client
      .from('discovered_channels').select('*', { count: 'exact' })
      .neq('name', '')                       // hide purged rejected-tombstones
      .order('fetched_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (filter.status) q = q.eq('status', filter.status);
    if (filter.genre) q = q.eq('genre', filter.genre);
    if (filter.runId) q = q.eq('run_id', filter.runId);
    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as DiscoveredChannel[], total: count ?? 0 };
  }

  async setStatus(channelIds: string[], status: Extract<CandidateStatus, 'shortlisted' | 'rejected' | 'new'>): Promise<void> {
    const { error } = await this.supabase.client
      .from('discovered_channels')
      .update({ status, reviewed_at: new Date().toISOString() })
      .in('channel_id', channelIds);
    if (error) throw new Error(error.message);
  }

  async quotaStatus(): Promise<QuotaStatus | null> {
    const { data } = await this.supabase.client.rpc('youtube_quota_status');
    const row = Array.isArray(data) ? data[0] : data;
    return (row as QuotaStatus) ?? null;
  }
}
