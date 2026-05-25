// Shapes for YouTube creator data served from the `creator_youtube_stats`
// cache table via PostgREST. The cache is populated by the `refresh-youtube-
// cache` edge function running on a nightly pg_cron schedule — the frontend
// never triggers a YouTube API call directly. See
// `simfluence-backend/supabase/functions/refresh-youtube-cache/index.ts`.

// Per-video data stored in `top_videos` jsonb.
export interface YoutubeVideo {
  title: string;
  views: number;
  likes: number;
  comments: number;
  url: string | null;
  paid_promo: boolean;
}

// One cache row keyed by creator_id. snake_case mirrors the DB shape directly;
// no transformation in the service.
export interface YoutubeCreatorData {
  creator_id:          number;
  channel_id:          string;
  channel_handle:      string | null;
  subscriber_count:    number | null;
  total_views:         number | null;
  video_count:         number | null;
  avg_views:           number | null;
  engagement_rate:     number | null;     // %
  avg_days_between:    number | null;
  last_upload_date:    string | null;     // ISO timestamp
  sponsor_freq_pct:    number | null;
  top_videos:          YoutubeVideo[];
  // Freshness — the modal displays "Updated Nh ago" from these.
  stats_refreshed_at:  string | null;     // last channels.list write
  videos_refreshed_at: string | null;     // last videos.list write
  // Offline tracking (null on live rows).
  offline_at:          string | null;
}
