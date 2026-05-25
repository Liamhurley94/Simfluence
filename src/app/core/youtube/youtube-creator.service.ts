import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { Creator } from '../data/creator.types';
import { YoutubeCreatorData } from './youtube-creator.types';

// Reads YouTube creator data from the `creator_youtube_stats` cache table via
// PostgREST. The cache is populated by the `refresh-youtube-cache` edge fn on
// a nightly cron — this service NEVER triggers a YouTube API call. See
// ~/.claude/projects/.../memory/feedback_no_user_triggered_yt_api.md.

@Injectable({ providedIn: 'root' })
export class YoutubeCreatorService {
  private supabase = inject(SupabaseService);

  // Per-session cache keyed by creator.id. Avoids re-querying PostgREST when
  // the same modal is re-opened in one tab. NOT load-bearing for quota (the
  // DB read costs nothing against YouTube) — purely a latency optimisation.
  private readonly cache = new Map<number, Promise<YoutubeCreatorData | null>>();

  fetch(creator: Creator): Promise<YoutubeCreatorData | null> {
    const existing = this.cache.get(creator.id);
    if (existing) return existing;
    const p = this.doFetch(creator);
    this.cache.set(creator.id, p);
    return p;
  }

  private async doFetch(creator: Creator): Promise<YoutubeCreatorData | null> {
    try {
      const { data, error } = await this.supabase.client
        .from('creator_youtube_stats')
        .select('*')
        .eq('creator_id', creator.id)
        .is('offline_at', null)
        .maybeSingle();
      if (error) {
        console.warn('[YoutubeCreatorService] cache read failed', error);
        this.cache.delete(creator.id);
        return null;
      }
      return (data as YoutubeCreatorData | null) ?? null;
    } catch (err) {
      console.warn('[YoutubeCreatorService] fetch failed', err);
      this.cache.delete(creator.id);
      return null;
    }
  }
}
