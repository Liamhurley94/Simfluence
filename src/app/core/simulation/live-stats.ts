import { Creator } from '../data/creator.types';

export interface LiveSimStats {
  subs: string;
  avgViews: string;
}

/**
 * The live reach stats to feed the sim for a creator, keyed off its primary
 * platform (`creator.platform`). Returns null when the creator has no live view
 * metric (unresolved / offline / never-synced) — those creators are excluded from
 * the forecast rather than stale-filled. YouTube uses subscriberCount + avgViews;
 * Twitch uses avg_ccv as avgViews (the sim reads a Twitch creator's avgViews as
 * concurrent viewers) and has no live subs.
 * See docs/superpowers/specs/2026-07-07-sim-live-stats-design.md.
 */
export function liveStatsFor(c: Creator): LiveSimStats | null {
  const p = (c.platform || '').toLowerCase();
  if (p.includes('twitch') || p.includes('kick')) {
    return c.twitchStats ? { subs: '', avgViews: String(c.twitchStats.avgCcv) } : null;
  }
  return c.ytStats ? { subs: String(c.ytStats.subscriberCount), avgViews: String(c.ytStats.avgViews) } : null;
}

/** Split a roster into creators with usable live stats (with their mapped stats)
 * and those excluded for having none. */
export function partitionByLiveData(creators: Creator[]): {
  included: Array<{ creator: Creator; live: LiveSimStats }>;
  excluded: Creator[];
} {
  const included: Array<{ creator: Creator; live: LiveSimStats }> = [];
  const excluded: Creator[] = [];
  for (const c of creators) {
    const live = liveStatsFor(c);
    if (live) included.push({ creator: c, live });
    else excluded.push(c);
  }
  return { included, excluded };
}
