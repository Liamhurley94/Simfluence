import { Injectable, computed, inject, signal } from '@angular/core';
import { CreatorsService } from '../creators/creators.service';
import { EdgeClient } from '../api/edge.client';
import { Creator } from '../data/creator.types';
import { LiveStream, TwitchLiveResponse } from './twitch-live.types';

// Polling cadence — matches the legacy app's 90-second interval. Adjust here
// if we ever want to balance freshness vs. Twitch API quota / our edge fn cost.
const POLL_INTERVAL_MS = 90_000;

// Cap on how many creators we ask Twitch about per poll. Twitch's helix
// /streams endpoint accepts up to 100 user_login params per call.
const POLL_LIMIT = 100;

function loginFor(c: Creator): string {
  return (c.handle ?? '').replace(/^@/, '').trim().toLowerCase();
}

@Injectable({ providedIn: 'root' })
export class TwitchLiveService {
  private creators = inject(CreatorsService);
  private edge = inject(EdgeClient);

  // streams keyed by lowercased login. Only contains currently-live streams.
  private readonly _streams = signal<Map<string, LiveStream>>(new Map());
  // The creators we polled this cycle, in CPI order. Used by the panel to
  // join stream data back to creator metadata (avatar color, name, etc).
  private readonly _polledCreators = signal<Creator[]>([]);

  readonly streams = this._streams.asReadonly();
  readonly polledCreators = this._polledCreators.asReadonly();
  readonly liveCount = computed(() => this._streams().size);

  /** Joined view: currently-live creators with their stream metadata,
   * ordered by viewer count desc. Drives the LiveChannelsPanel. */
  readonly liveEntries = computed<{ creator: Creator; stream: LiveStream }[]>(() => {
    const streams = this._streams();
    const out: { creator: Creator; stream: LiveStream }[] = [];
    for (const c of this._polledCreators()) {
      const s = streams.get(loginFor(c));
      if (s) out.push({ creator: c, stream: s });
    }
    out.sort((a, b) => b.stream.viewerCount - a.stream.viewerCount);
    return out;
  });

  // No auto-poll. The Live Channels feed that used this is retired; the
  // remaining consumers (e.g. profile-modal Twitch enrichment, planned next)
  // call poll() / fetch-style methods on demand. Keeping the polling pattern
  // available — just dormant — so a future per-creator enrichment can either
  // use isLive(creator) opportunistically or call poll() explicitly.

  /** Returns true if the creator's Twitch login is currently streaming. */
  isLive(creator: Creator): boolean {
    const login = loginFor(creator);
    return login.length > 0 && this._streams().has(login);
  }

  /** Returns currently-live (creator, stream) pairs from the given list. */
  liveAmong(creators: readonly Creator[]): { creator: Creator; stream: LiveStream }[] {
    const map = this._streams();
    const out: { creator: Creator; stream: LiveStream }[] = [];
    for (const c of creators) {
      const stream = map.get(loginFor(c));
      if (stream) out.push({ creator: c, stream });
    }
    return out;
  }

  /** One poll cycle: fetch the top-N Twitch creators, ask Twitch which are live. */
  async poll(): Promise<void> {
    try {
      const targets = await this.pollTargets();
      this._polledCreators.set(targets);
      const logins = targets.map(loginFor).filter((l) => l.length > 0);
      if (logins.length === 0) {
        this._streams.set(new Map());
        return;
      }

      const res = await this.edge.post<TwitchLiveResponse, { logins: string[] }>(
        'twitch-live-status',
        { logins },
      );

      const next = new Map<string, LiveStream>();
      for (const [login, entry] of Object.entries(res.streams ?? {})) {
        if (!entry?.live) continue;
        next.set(login.toLowerCase(), {
          login: login.toLowerCase(),
          viewerCount: entry.viewerCount ?? 0,
          gameName: entry.gameName ?? '',
          title: entry.title ?? '',
          thumbnailUrl: entry.thumbnailUrl ?? null,
          startedAt: entry.startedAt ?? '',
        });
      }
      this._streams.set(next);
    } catch (err) {
      // Keep the last known state on failure — silent like the legacy app.
      // Worth surfacing in observability later if poll failures become a thing.
      console.warn('[TwitchLiveService] poll failed', err);
    }
  }

  private async pollTargets(): Promise<Creator[]> {
    const page = await this.creators.list(
      { platforms: ['Twitch'] },
      'cpi',
      0,
      POLL_LIMIT,
    );
    return page.creators;
  }
}
