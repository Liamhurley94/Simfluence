import { Injectable, inject } from '@angular/core';
import { EdgeClient } from '../api/edge.client';
import { SupabaseService } from '../supabase/supabase.service';
import { TaxonomyGenre } from './admin-taxonomy.types';

/** Admin discovery-taxonomy authoring. All writes (and the keyword-carrying
 *  read) go through the identity-gated admin-manage-taxonomy edge fn —
 *  keywords are scoring IP and are never exposed via a client-readable
 *  table/RPC (see the design doc). Progress reads are plain PostgREST under
 *  admin RLS, same split as AdminDiscoveryService. */
@Injectable({ providedIn: 'root' })
export class TaxonomyService {
  private edge = inject(EdgeClient);
  private supabase = inject(SupabaseService);

  async list(): Promise<TaxonomyGenre[]> {
    const res = await this.edge.post<{ genres: TaxonomyGenre[] }>('admin-manage-taxonomy', { action: 'list' });
    return res.genres;
  }

  createSubMode(genre: string, subMode: string): Promise<{ ok: true }> {
    return this.edge.post('admin-manage-taxonomy', { action: 'createSubMode', genre, subMode });
  }

  setPhrases(genre: string, subMode: string, phrases: string[]): Promise<{ ok: true; count: number }> {
    return this.edge.post('admin-manage-taxonomy', { action: 'setPhrases', genre, subMode, phrases });
  }

  setKeywords(genre: string, subMode: string, keywords: string[]): Promise<{ ok: true; count: number }> {
    return this.edge.post('admin-manage-taxonomy', { action: 'setKeywords', genre, subMode, keywords });
  }

  refreshRankings(genre: string, subMode: string): Promise<{ ok: true }> {
    return this.edge.post('admin-manage-taxonomy', { action: 'refreshRankings', genre, subMode });
  }

  /** Count of creator_genre_scores rows *freshly recomputed* for this
   *  (genre, subMode) pair since `since` – the numerator the recompute
   *  progress bar polls. An upsert overwrites rows in place, so for an
   *  existing sub-genre the row count alone is already at target before a
   *  recompute starts; the `computed_at` floor is what actually moves as
   *  the run progresses. */
  async rankingProgress(genre: string, subMode: string, since: string): Promise<number> {
    const { count } = await this.supabase.client
      .from('creator_genre_scores').select('*', { count: 'exact', head: true })
      .eq('campaign_genre', genre).eq('sub_mode', subMode).gte('computed_at', since);
    return count ?? 0;
  }

  /** Total creator count — the progress bar's denominator. A scoped
   *  refresh-creator-gfi run writes one creator_genre_scores row per creator
   *  for the (genre, subMode) pair regardless of the creator's own genre
   *  (it scores every creator against every configured sub-mode), so the
   *  finished row count converges on this total. */
  async creatorCount(): Promise<number> {
    const { count } = await this.supabase.client
      .from('creators').select('*', { count: 'exact', head: true });
    return count ?? 0;
  }
}
