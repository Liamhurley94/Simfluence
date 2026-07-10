/** Contracts for admin creator discovery. Mirrors discovered_channels /
 *  discovery_runs and the admin-discover-creators edge fn (backend plan). */

export interface StatsSeed {
  channelId: string;
  uploadsPlaylistId: string;
  subscriberCount: number;
  totalViews: number;
  videoCount: number;
  avgViews: number;
  engagementRate: number;
  sponsorFreqPct: number;
  recentVideos: RecentVideo[];
}

export interface RecentVideo {
  title: string;
  views: number;
  likes: number;
  comments: number;
  url: string;
  paid_promo: boolean;
}

export type CandidateStatus = 'new' | 'shortlisted' | 'rejected' | 'added';

/** Row shape of public.discovered_channels (snake_case = PostgREST verbatim). */
export interface DiscoveredChannel {
  channel_id: string;
  name: string;
  handle: string;
  bio: string;
  country: string;
  language: string | null;
  video_count: number;
  thumbnail_url: string;
  subscriber_count: number;
  avg_views: number;
  engagement_rate: number;
  sponsor_freq_pct: number;
  uploads_playlist_id: string;
  recent_videos: RecentVideo[];
  found_by_query: string;
  run_id: string | null;
  genre: string;
  sub_mode: string;
  fetched_at: string;
  status: CandidateStatus;
  matched_creator_id: number | null;
  match_type: 'exact' | 'name_hint' | null;
}

export type RunStatus = 'queued' | 'running' | 'paused_quota' | 'done' | 'failed' | 'cancelled';

/** Row shape of public.discovery_runs. */
export interface DiscoveryRun {
  id: string;
  created_at: string;
  status: RunStatus;
  genre: string | null;
  sub_mode: string | null;
  min_subscribers: number;
  query_total: number;
  query_done: number;
  channels_found: number;
  skipped_known: number;
  units_spent: number;
  last_slice_at: string | null;
  error: string | null;
}

export interface SearchResult {
  candidates: DiscoveredChannel[];
  /** Channels already in the roster — rendered as "already in roster ✓" rows. */
  alreadyInRoster: { channelId: string; name: string }[];
  /** Channels already staged in the queue — rendered with their current status. */
  alreadyStaged: DiscoveredChannel[];
  unitsSpent: number;
}

export interface QuotaStatus {
  effective_ceiling: number;
  elevated_limit: number;
  default_limit: number;
  elevated_until: string;
  used_today: number;
}
