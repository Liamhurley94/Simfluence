// Shape of a single live stream entry returned by the twitch-live-status
// edge function, normalized for frontend consumption.
export interface LiveStream {
  login: string; // lowercased Twitch login (the map key in the streams signal)
  viewerCount: number;
  gameName: string;
  title: string;
  thumbnailUrl: string | null;
  startedAt: string; // ISO timestamp
}

// Raw response shape from /functions/v1/twitch-live-status.
// Mirror of the edge fn's response — see simfluence-backend/supabase/functions/twitch-live-status/index.ts
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
    }
  >;
}
