// Response shape from /functions/v1/youtube-creator-data.
// Matches simfluence-backend/supabase/functions/youtube-creator-data/index.ts.

export interface YoutubeCreatorData {
  creator_id: number;
  channel_id: string;
  channel_handle: string;
  subs_live: number;
  total_views: number;
  avg_views_20: number;
  video_count: number;
  sponsor_freq_pct: number;
  genre_signals: Record<string, number>; // genre name → match count
  top_titles: string[];
  thumbnail_url: string | null;
  fetched_at: string; // ISO timestamp
  expires_at: string; // ISO timestamp (24h after fetched_at)
}

export interface YoutubeCreatorResponse {
  source: 'cache' | 'youtube';
  data: YoutubeCreatorData;
}

export interface YoutubeCreatorRequest {
  creator_id: number;
  channel_handle: string;
  channel_id: string | null;
}
