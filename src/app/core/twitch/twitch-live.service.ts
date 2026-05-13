import { Injectable, inject } from '@angular/core';
import { Creator } from '../data/creator.types';
import { EdgeClient } from '../api/edge.client';
import { TwitchEnrichment, TwitchLiveResponse } from './twitch-live.types';

function loginFor(c: Creator): string {
  return (c.handle ?? '').replace(/^@/, '').trim().toLowerCase();
}

@Injectable({ providedIn: 'root' })
export class TwitchLiveService {
  private edge = inject(EdgeClient);

  // Session-scoped cache keyed by creator id. Avoids re-fetching when the
  // same profile modal is opened twice in one session. Hard refresh clears.
  private readonly cache = new Map<number, Promise<TwitchEnrichment | null>>();

  /**
   * On-demand per-creator fetch for the profile modal's Twitch section.
   * Returns `null` when the call fails (API keys not configured, network
   * error, edge fn 5xx) — caller renders an "unavailable" message.
   * Returns a populated object when offline too (live: false, plus the
   * activity fields if Twitch returned them).
   */
  fetchEnrichment(creator: Creator): Promise<TwitchEnrichment | null> {
    if (this.cache.has(creator.id)) return this.cache.get(creator.id)!;
    const p = this.doFetch(creator);
    this.cache.set(creator.id, p);
    return p;
  }

  private async doFetch(creator: Creator): Promise<TwitchEnrichment | null> {
    const login = loginFor(creator);
    if (!login) return null;
    try {
      const res = await this.edge.post<TwitchLiveResponse, { logins: string[]; with_activity: boolean }>(
        'twitch-live-status',
        { logins: [login], with_activity: true },
      );
      const entry = res.streams?.[login];
      if (!entry) return null;
      return {
        login,
        live: !!entry.live,
        viewerCount: entry.viewerCount ?? 0,
        gameName: entry.gameName ?? '',
        title: entry.title ?? '',
        thumbnailUrl: entry.thumbnailUrl ?? null,
        startedAt: entry.startedAt ?? '',
        daysSinceStream: entry.daysSinceStream ?? null,
      };
    } catch (err) {
      console.warn('[TwitchLiveService] enrichment fetch failed', err);
      return null;
    }
  }
}
