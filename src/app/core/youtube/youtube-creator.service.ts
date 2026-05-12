import { Injectable, inject } from '@angular/core';
import { EdgeClient } from '../api/edge.client';
import { Creator } from '../data/creator.types';
import {
  YoutubeCreatorData,
  YoutubeCreatorRequest,
  YoutubeCreatorResponse,
} from './youtube-creator.types';

// Extract a channel ID from a URL like https://www.youtube.com/channel/UCxxx.
// Returns null for handle-style URLs or anything we don't recognize.
function channelIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/channel\/(UC[A-Za-z0-9_-]{20,})/);
  return m ? m[1] : null;
}

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

  // Per-session cache keyed by creator id. The edge fn has its own 24h DB
  // cache; this layer just avoids re-hitting the network within one tab
  // visit if the user opens the same profile twice.
  private readonly cache = new Map<number, Promise<YoutubeCreatorData | null>>();

  fetch(creator: Creator): Promise<YoutubeCreatorData | null> {
    const existing = this.cache.get(creator.id);
    if (existing) return existing;
    const p = this.doFetch(creator);
    this.cache.set(creator.id, p);
    return p;
  }

  private async doFetch(creator: Creator): Promise<YoutubeCreatorData | null> {
    const channel_handle = handleFor(creator);
    if (!channel_handle && !creator.ytUrl) return null;

    try {
      const res = await this.edge.post<YoutubeCreatorResponse, YoutubeCreatorRequest>(
        'youtube-creator-data',
        {
          creator_id: creator.id,
          channel_handle,
          channel_id: channelIdFromUrl(creator.ytUrl),
        },
      );
      return res?.data ?? null;
    } catch (err) {
      console.warn('[YoutubeCreatorService] fetch failed', err);
      // Drop the failed promise from cache so a retry can hit fresh.
      this.cache.delete(creator.id);
      return null;
    }
  }
}
