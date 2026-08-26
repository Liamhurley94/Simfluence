export type Format = 'Integrated' | 'Mixed' | 'Dedicated';

// The forecast engine (`run-simulation` getObjWeights) only distinguishes these
// 3 buckets, so the objective picker is a multi-select of exactly these. Must
// match the backend's canonical values. See docs/superpowers/specs/
// 2026-07-03-objectives-and-format-honesty.md §2.
export const OBJECTIVES = ['Awareness', 'Sales', 'Engagement'] as const;

export type Objective = (typeof OBJECTIVES)[number];

/** One confidence band of a **pre-W2** saved forecast. The W2 rebuild
 *  (2026-08-27) replaced P10/P50/P90 with Conservative/Expected/Optimistic and
 *  dropped ROAS, so nothing computes this any more – it survives solely to type
 *  `LegacyCampaignForecast`, which the debrief still renders for forecasts
 *  saved before that date. Those are permanent records (D12): never migrated,
 *  never recomputed. See `simulation-w2.types.ts` for the live contract. */
export interface SimBand {
  impressions: number;
  ctr: number;
  roas: number;
}

export interface ObjectiveWeights {
  awarenessW: number;
  salesW: number;
  engagementW: number;
}
