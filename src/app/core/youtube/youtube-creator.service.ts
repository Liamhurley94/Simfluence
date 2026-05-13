import { Injectable, inject } from '@angular/core';
import { EdgeClient } from '../api/edge.client';
import { Creator } from '../data/creator.types';
import {
  YoutubeCreatorData,
  YoutubeCreatorRequest,
} from './youtube-creator.types';

// Pick the best handle we have for the YouTube enrichment fetch.
// Falls back to the generic `handle` (often "@" + channel name) when no
// YouTube-specific handle is recorded on the creator.
function handleFor(creator: Creator): string {
  return (
    creator.ytHandle ||
    creator.youtubeHandle ||
    creator.handle ||
    ''
  ).replace(/^@/, '').trim();
}

@Injectable({ providedIn: 'root' })
export class YoutubeCreatorService {
  private edge = inject(EdgeClient);

  // Per-session cache keyed by creator id — the edge fn no longer persists
  // to Supabase, so this is our only cache layer. Avoids re-hitting YouTube's
  // API quota when the user reopens the same profile during one session.
  private readonly cache = new Map<number, Promise<YoutubeCreatorData | null>>();

  fetch(creator: Creator): Promise<YoutubeCreatorData | null> {
    const existing = this.cache.get(creator.id);
    if (existing) return existing;
    const p = this.doFetch(creator);
    this.cache.set(creator.id, p);
    return p;
  }

  private async doFetch(creator: Creator): Promise<YoutubeCreatorData | null> {
    const handle = handleFor(creator);
    if (!handle) return null;

    try {
      const res = await this.edge.post<YoutubeCreatorData, YoutubeCreatorRequest>(
        'youtube-creator-data',
        { handle },
      );
      return res ?? null;
    } catch (err) {
      console.warn('[YoutubeCreatorService] fetch failed', err);
      // Drop the failed promise from cache so a retry hits fresh.
      this.cache.delete(creator.id);
      return null;
    }
  }
}
