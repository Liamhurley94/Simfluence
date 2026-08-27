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

/**
 * Signed percentage delta of actual vs the forecast midpoint — P50 on the
 * legacy path, Expected on the W2 path. Null if either is unusable.
 */
export function deltaPct(actual: number | null, forecastMidpoint: number): number | null {
  return actual != null && forecastMidpoint !== 0
    ? Math.round((actual / forecastMidpoint - 1) * 100)
    : null;
}

/**
 * Whether the actual landed inside the forecast band (inclusive) — P10–P90 on
 * the legacy path, Conservative–Optimistic on the W2 path.
 */
export function inBand(actual: number | null, bandLow: number, bandHigh: number): boolean {
  return actual != null && actual >= bandLow && actual <= bandHigh;
}

export interface DeliverableActualsRow {
  platform: 'YouTube' | 'Twitch';
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  spend: number | null;
  revenue: number | null;
}

export interface CreatorActualsBundle {
  creatorLevel: CreatorActuals;
  deliverables: DeliverableActualsRow[];
}

const MEASURES = ['impressions', 'clicks', 'conversions', 'spend', 'revenue'] as const;
type Measure = (typeof MEASURES)[number];

const sumIfAny = (rows: DeliverableActualsRow[], m: Measure): number | null =>
  rows.some((r) => r[m] != null)
    ? rows.reduce((a, r) => a + (r[m] ?? 0), 0)
    : null;

/**
 * Per-measure read rule: deliverable-grain sum when any row carries the
 * measure, else the creator-level value. Deterministic — deliverable grain
 * wins per measure, so double-filled data never double-counts.
 */
export function effectiveCreatorActuals(b: CreatorActualsBundle): CreatorActuals {
  const out = { ...b.creatorLevel };
  for (const m of MEASURES) {
    const dg = sumIfAny(b.deliverables, m);
    if (dg != null) out[m] = dg;
  }
  return out;
}

/** The single platform all rows share, else null (mixed or no rows). */
export function attributablePlatform(rows: DeliverableActualsRow[]): 'YouTube' | 'Twitch' | null {
  const set = new Set(rows.map((r) => r.platform));
  return set.size === 1 ? rows[0].platform : null;
}

export interface PlatformActuals {
  platform: 'YouTube' | 'Twitch';
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  spend: number | null;
  revenue: number | null;
  ctr: number | null;
  costPerConversion: number | null;
}

export interface PlatformRollup {
  platforms: PlatformActuals[];
  /** true when creator-level values existed that no platform could honestly claim. */
  hasUnattributed: boolean;
}

/**
 * The D27 payoff: actuals by platform. A single-platform creator's effective
 * measures (incl. creator-level conversions) attribute wholly to that
 * platform; a multi-platform creator contributes only deliverable-grain
 * values to each row's platform — creator-level values with no
 * deliverable-grain coverage are flagged unattributed, never split.
 */
export function platformRollup(bundles: CreatorActualsBundle[]): PlatformRollup {
  const acc = new Map<'YouTube' | 'Twitch', Record<Measure, number | null>>();
  const addTo = (p: 'YouTube' | 'Twitch', m: Measure, v: number | null) => {
    if (v == null) return;
    const slot = acc.get(p) ?? { impressions: null, clicks: null, conversions: null, spend: null, revenue: null };
    slot[m] = (slot[m] ?? 0) + v;
    acc.set(p, slot);
  };
  let hasUnattributed = false;
  for (const b of bundles) {
    const single = attributablePlatform(b.deliverables);
    if (single) {
      const eff = effectiveCreatorActuals(b);
      for (const m of MEASURES) addTo(single, m, eff[m]);
    } else {
      for (const row of b.deliverables) for (const m of MEASURES) addTo(row.platform, m, row[m]);
      for (const m of MEASURES) {
        if (b.creatorLevel[m] != null && sumIfAny(b.deliverables, m) == null) hasUnattributed = true;
      }
    }
  }
  const platforms: PlatformActuals[] = [...acc.entries()].map(([platform, s]) => ({
    platform, ...s,
    ctr: ctr(s.impressions, s.clicks),
    costPerConversion:
      s.conversions != null && s.conversions > 0 && s.spend != null
        ? round2(s.spend / s.conversions)
        : null,
  }));
  return { platforms, hasUnattributed };
}
