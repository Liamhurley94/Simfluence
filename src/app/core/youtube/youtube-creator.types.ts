// Shapes for the rewritten youtube-creator-data edge function.
// Prod's source-of-truth version takes `{handle}` and returns a flat object
// (no `data` wrapper, no Supabase-cache persistence). Sponsor detection now
// scans video title + description against a richer regex set.

// Per-video data returned in top_videos.
export interface YoutubeVideo {
  title: string;
  views: number;
  likes: number;
  comments: number;
  url: string | null;
  paid_promo: boolean;
}

// Flat response shape. No `source` / `data` wrapper.
export interface YoutubeCreatorData {
  handle: string;
  channelId: string;
  subscriberCount: number;
  totalViews: number;
  videoCount: number;
  avgViews: number;
  engagementRate: number;     // % (likes + comments) / views across top 5
  avgDaysBetween: number | null;
  lastUploadDate: string | null;   // ISO timestamp
  sponsor_freq_pct: number;
  top_videos: YoutubeVideo[];
  top_titles: string[];            // kept for parallel rendering / legacy compat
  fetched_at: string;
}

// Request body — single `handle` field. The edge fn prepends "@" if missing.
export interface YoutubeCreatorRequest {
  handle: string;
}
