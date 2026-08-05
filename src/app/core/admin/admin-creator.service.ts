import { Injectable, inject } from '@angular/core';
import { EdgeClient } from '../api/edge.client';
import { SupabaseService } from '../supabase/supabase.service';
import { AddCreatorInput, AddCreatorResult, ListCreatorsResult, SyncUnsyncedResult } from './admin-creator.types';

/**
 * Admin-only creator management. Adding a creator inserts the rows and fires the
 * sanctioned service-role platform-sync kicks server-side (admins are exempt from
 * the "no user-triggered external API calls" rule — see the design spec). Both
 * endpoints are admin-gated in the edge fn; adminGuard also gates the route.
 */
@Injectable({ providedIn: 'root' })
export class AdminCreatorService {
  private edge = inject(EdgeClient);
  private supabase = inject(SupabaseService);

  async addCreators(creators: AddCreatorInput[]): Promise<AddCreatorResult> {
    return this.edge.post('admin-add-creator', { creators });
  }

  async listCreators(): Promise<ListCreatorsResult> {
    return this.edge.get('admin-list-creators');
  }

  /** Re-sync an offline (creator, platform): clears the offline flag server-side
   *  and re-fires the platform's refresh kick. Platform comes from an offline-list
   *  row, so it's always 'YouTube' or 'Twitch'. */
  async resyncCreator(creatorId: number, platform: string): Promise<{ resynced: { creatorId: number; platform: string } }> {
    return this.edge.post('admin-resync-creator', { creatorId, platform });
  }

  /** Attach a second platform to an existing creator (spec decision #4).
   *  With statsSeed (discovery "Link" flow) the platform row is born synced.
   *  Note: the backend can return 200 (not only 409) on a same-handle
   *  re-attach — it heals a previously half-completed attach rather than
   *  treating it as a conflict. */
  async attachPlatform(input: {
    creatorId: number; platform: 'youtube' | 'twitch'; handle: string;
    statsSeed?: import('./admin-discovery.types').StatsSeed;
  }): Promise<{
    attached: { creatorId: number; platform: string };
    kicks?: { youtube: import('./admin-creator.types').KickStatus; twitch: import('./admin-creator.types').KickStatus };
  }> {
    return this.edge.post('admin-attach-platform', input);
  }

  /** Targeted re-hydration of any admin-added creator the on-add kicks missed.
   *  SECURITY DEFINER RPC, admin-guarded server-side; dispatches the same SQL
   *  kicks the nightly crons use. */
  async syncUnsynced(): Promise<SyncUnsyncedResult> {
    const { data, error } = await this.supabase.client.rpc('admin_sync_unsynced');
    if (error) throw error;
    return data as SyncUnsyncedResult;
  }
}
