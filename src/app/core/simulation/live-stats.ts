import { Creator } from '../data/creator.types';

export interface LiveSimStats {
  subs: string;
  avgViews: string;
  /** Live engagement rate — YouTube only (from ytStats.engagementRate). Twitch has
   *  no live equivalent, so it's '' there; the scoring CPI breakdown's engagement
   *  factor is YouTube-shaped and doesn't apply to Twitch (scored on viewership). */
  eng: string;
}

/**
 * The live stats to feed the sim (reach) and scoring (CPI breakdown) for a
 * creator, keyed off its primary platform (`creator.platform`). Shared by
 * run-simulation.service (reads subs/avgViews) and score-creator.service (also
 * reads eng). Returns null when the creator has no live view metric (unresolved /
 * offline / never-synced) — those creators are excluded rather than stale-filled.
 * YouTube uses subscriberCount + avgViews + engagementRate; Twitch uses avg_ccv as
 * avgViews (the sim reads a Twitch creator's avgViews as concurrent viewers) and
 * has no live subs or engagement rate.
 * See docs/superpowers/specs/2026-07-07-sim-live-stats-design.md.
 */
export function liveStatsFor(c: Creator): LiveSimStats | null {
  const p = (c.platform || '').toLowerCase();
  if (p.includes('twitch') || p.includes('kick')) {
    return c.twitchStats ? { subs: '', avgViews: String(c.twitchStats.avgCcv), eng: '' } : null;
  }
  return c.ytStats
    ? { subs: String(c.ytStats.subscriberCount), avgViews: String(c.ytStats.avgViews), eng: String(c.ytStats.engagementRate) }
    : null;
}

/** True only for a YouTube creator carrying live stats — i.e. one for whom the
 *  YouTube-shaped CPI breakdown (engagement / view-to-sub / channel authority) is
 *  meaningful. Twitch (no live subs/eng — scored on viewership) and unresolved /
 *  offline creators return false; scoring suppresses their breakdown rather than
 *  showing misleading zeros. */
export function hasLiveYoutubeStats(c: Creator): boolean {
  const p = (c.platform || '').toLowerCase();
  if (p.includes('twitch') || p.includes('kick')) return false;
  return !!c.ytStats;
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
