import { Injectable, inject } from '@angular/core';
import { Creator } from '../data/creator.types';
import { SupabaseService } from '../supabase/supabase.service';
import { TwitchEnrichment } from './twitch-live.types';

const DAY_MS = 86_400_000;
// An "open" session whose last sample is within this window ≈ live now. Accepts
// the live-sweep's ~5-min cadence (+ a little finalize lag) rather than hitting
// the Twitch API on demand.
const LIVE_FRESHNESS_MS = 12 * 60_000;

function loginFor(c: Creator): string {
  return (c.handle ?? '').replace(/^@/, '').trim().toLowerCase();
}

@Injectable({ providedIn: 'root' })
export class TwitchLiveService {
  private supabase = inject(SupabaseService);

  // Session-scoped cache keyed by creator id. Avoids re-querying when the same
  // profile modal is opened twice in one session. Hard refresh clears.
  private readonly cache = new Map<number, Promise<TwitchEnrichment | null>>();

  /**
   * Per-creator Twitch live/activity for the profile modal — read entirely from
   * OUR data: the `twitch_live_sessions` table (populated by the 5-min live-sweep
   * cron) for "live now", and the `twitch_creators.last_stream_at` rolling
   * aggregate (surfaced on `creator.twitchStats`) for "last streamed". It does
   * NOT call the Twitch Helix API on demand — the UI tolerates the cron's ~5-min
   * lag instead of risking rate limits / ToS issues with per-open API calls.
   */
  fetchEnrichment(creator: Creator): Promise<TwitchEnrichment | null> {
    if (this.cache.has(creator.id)) return this.cache.get(creator.id)!;
    const p = this.doFetch(creator);
    this.cache.set(creator.id, p);
    return p;
  }

  private async doFetch(creator: Creator): Promise<TwitchEnrichment> {
    // Days since last stream — from our rolling aggregate (already on the creator
    // via twitchStats.lastStreamAt). No query, no API.
    const lastStreamAt = creator.twitchStats?.lastStreamAt ?? null;
    const daysSinceStream = lastStreamAt
      ? Math.max(0, Math.floor((Date.now() - new Date(lastStreamAt).getTime()) / DAY_MS))
      : null;

    const offline: TwitchEnrichment = {
      login: loginFor(creator),
      live: false,
      viewerCount: 0,
      gameName: '',
      title: '',
      thumbnailUrl: null,
      startedAt: '',
      daysSinceStream,
    };

    // Live now — the latest OPEN session from our live-sweep table (a DB read,
    // not a Helix call). Treated as live only if its last sample is recent.
    try {
      const { data, error } = await this.supabase.client
        .from('twitch_live_sessions')
        .select('started_at, last_seen_at, game_name, title, viewer_peak, avg_ccv')
        .eq('creator_id', creator.id)
        .eq('status', 'open')
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return offline;

      const lastSeen = data.last_seen_at ? new Date(data.last_seen_at).getTime() : 0;
      if (Date.now() - lastSeen >= LIVE_FRESHNESS_MS) return offline;

      return {
        login: loginFor(creator),
        live: true,
        viewerCount: data.avg_ccv ?? data.viewer_peak ?? 0,
        gameName: data.game_name ?? '',
        title: data.title ?? '',
        thumbnailUrl: null,
        startedAt: data.started_at ?? '',
        daysSinceStream: 0,
      };
    } catch (err) {
      console.warn('[TwitchLiveService] live-session read failed', err);
      return offline;
    }
  }
}
