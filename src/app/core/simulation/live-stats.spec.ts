import { describe, expect, it } from 'vitest';
import { Creator } from '../data/creator.types';
import { hasLiveYoutubeStats, liveStatsFor, partitionByLiveData } from './live-stats';

function mk(o: Partial<Creator> = {}): Creator {
  return {
    id: 1, name: 'C', handle: '@c', platform: 'YouTube', allPlatforms: ['YouTube'],
    subs: '100K', subsParsed: 100000, avgViews: '20K', eng: '3.0%', genre: 'Gaming & Esports',
    cpi: 80, gfi: 75, color: '#fff', verifiedDeals: 0, sponsorHistory: [], bio: '', ...o,
  } as Creator;
}

const YT = { subscriberCount: 120000, avgViews: 24000, engagementRate: 3.1, sponsorFreqPct: 10, statsRefreshedAt: null };
const TW = { avgCcv: 2000, peakCcv: 5000, streams30d: 12, hoursStreamed30d: 40, lastStreamAt: null, primaryGameName: null, liveRefreshedAt: null };

describe('live-stats', () => {
  it('YouTube: live subscriberCount + avgViews + engagementRate as strings', () => {
    expect(liveStatsFor(mk({ platform: 'YouTube', ytStats: YT }))).toEqual({ subs: '120000', avgViews: '24000', eng: '3.1' });
  });

  it('Twitch: avg_ccv as avgViews, empty subs + empty eng (no live YouTube-style fields)', () => {
    expect(liveStatsFor(mk({ platform: 'Twitch', ytStats: undefined, twitchStats: TW }))).toEqual({ subs: '', avgViews: '2000', eng: '' });
  });

  it('hasLiveYoutubeStats: true only for a YouTube creator carrying ytStats', () => {
    expect(hasLiveYoutubeStats(mk({ platform: 'YouTube', ytStats: YT }))).toBe(true);
    expect(hasLiveYoutubeStats(mk({ platform: 'YouTube', ytStats: undefined }))).toBe(false);
    expect(hasLiveYoutubeStats(mk({ platform: 'Twitch', ytStats: undefined, twitchStats: TW }))).toBe(false);
  });

  it('no live stats for the primary platform → null', () => {
    expect(liveStatsFor(mk({ platform: 'YouTube', ytStats: undefined }))).toBeNull();
    expect(liveStatsFor(mk({ platform: 'Twitch', ytStats: undefined, twitchStats: undefined }))).toBeNull();
  });

  it('partitionByLiveData splits included (with live stats) from excluded', () => {
    const yt = mk({ id: 1, platform: 'YouTube', ytStats: { ...YT, subscriberCount: 100, avgViews: 50 } });
    const off = mk({ id: 2, platform: 'YouTube', ytStats: undefined });
    const { included, excluded } = partitionByLiveData([yt, off]);
    expect(included.map((i) => i.creator.id)).toEqual([1]);
    expect(included[0].live).toEqual({ subs: '100', avgViews: '50', eng: '3.1' });
    expect(excluded.map((e) => e.id)).toEqual([2]);
  });
});
