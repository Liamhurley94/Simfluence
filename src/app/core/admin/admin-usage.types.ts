export interface DailyUsage {
  day: string; // 'YYYY-MM-DD' (Pacific calendar day)
  yt_units: number;
  tw_calls: number;
}

export interface YoutubeQuotaStatus {
  effective_ceiling: number;
  elevated_limit: number;
  default_limit: number;
  elevated_until: string; // ISO
  used_today: number;
}
