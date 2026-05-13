// Shape of one stream entry returned by the twitch-live-status edge function.
// Mirror of simfluence-backend/supabase/functions/twitch-live-status/index.ts.
export interface LiveStream {
  login: string;
  viewerCount: number;
  gameName: string;
  title: string;
  thumbnailUrl: string | null;
  startedAt: string;
}

// Raw response shape from /functions/v1/twitch-live-status.
// `daysSinceStream` is only present when the request was made with
// `with_activity: true`. For offline creators when activity was requested,
// the per-login entry will have `live: false` plus the daysSinceStream field.
export interface TwitchLiveResponse {
  streams: Record<
    string,
    {
      live: boolean;
      viewerCount?: number;
      gameName?: string;
      title?: string;
      thumbnailUrl?: string | null;
      startedAt?: string;
      daysSinceStream?: number | null;
    }
  >;
}

// Per-creator profile-modal enrichment, normalized for UI consumption.
// `null` is returned by the service when the upstream call failed (API keys
// not set, network error, etc.) — modal renders an "unavailable" message.
export interface TwitchEnrichment {
  login: string;
  live: boolean;
  viewerCount: number;
  gameName: string;
  title: string;
  thumbnailUrl: string | null;
  startedAt: string;
  daysSinceStream: number | null;
}
