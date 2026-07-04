// Pure helpers for the campaign forecast-vs-actual debrief. Per-creator actuals
// are entered on campaign_creators; these derive the rates and the headline
// roll-up, plus the delta / band-hit against the saved forecast.
// See docs/superpowers/specs/2026-07-04-campaign-actuals-design.md.

export interface CreatorActuals {
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  spend: number | null;
  revenue: number | null;
}

export interface ActualsRollup {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  /** true when every row with spend > 0 also has a revenue — gates headline ROAS. */
  revenueComplete: boolean;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Click-through rate (%). Null when impressions is 0/absent or clicks absent. */
export function ctr(impressions: number | null, clicks: number | null): number | null {
  return impressions != null && impressions > 0 && clicks != null
    ? round1((clicks / impressions) * 100)
    : null;
}

/** Conversion rate (%). Null when clicks is 0/absent or conversions absent. */
export function cvr(clicks: number | null, conversions: number | null): number | null {
  return clicks != null && clicks > 0 && conversions != null
    ? round1((conversions / clicks) * 100)
    : null;
}

/** Return on ad spend (×). Null when spend is 0/absent or revenue absent. */
export function roas(spend: number | null, revenue: number | null): number | null {
  return spend != null && spend > 0 && revenue != null ? round2(revenue / spend) : null;
}

/** Sum per-creator actuals into a campaign headline (null summands skipped). */
export function rollup(rows: CreatorActuals[]): ActualsRollup {
  const sum = (pick: (r: CreatorActuals) => number | null): number =>
    rows.reduce((a, r) => a + (pick(r) ?? 0), 0);
  const revenueComplete = rows.every(
    (r) => !(r.spend != null && r.spend > 0) || r.revenue != null,
  );
  return {
    impressions: sum((r) => r.impressions),
    clicks: sum((r) => r.clicks),
    conversions: sum((r) => r.conversions),
    spend: sum((r) => r.spend),
    revenue: sum((r) => r.revenue),
    revenueComplete,
  };
}

/** Signed percentage delta of actual vs the forecast P50. Null if either is unusable. */
export function deltaPct(actual: number | null, forecastP50: number): number | null {
  return actual != null && forecastP50 !== 0
    ? Math.round((actual / forecastP50 - 1) * 100)
    : null;
}

/** Whether the actual landed inside the forecast P10–P90 band (inclusive). */
export function inBand(actual: number | null, p10: number, p90: number): boolean {
  return actual != null && actual >= p10 && actual <= p90;
}
