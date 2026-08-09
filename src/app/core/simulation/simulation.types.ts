import { Creator } from '../data/creator.types';
import { GenreBenchmark } from '../data/benchmarks.data';

export type Format = 'Integrated' | 'Mixed' | 'Dedicated';

// The forecast engine (`run-simulation` getObjWeights) only distinguishes these
// 3 buckets, so the objective picker is a multi-select of exactly these. Must
// match the backend's canonical values. See docs/superpowers/specs/
// 2026-07-03-objectives-and-format-honesty.md §2.
export const OBJECTIVES = ['Awareness', 'Sales', 'Engagement'] as const;

export type Objective = (typeof OBJECTIVES)[number];

export interface SimInputs {
  creators: Creator[];
  budget: number;
  format: Format;
  genre: string;
  objectives: Objective[];
  subMode?: string;
  // Optional per-creator sponsorship format (creatorId → format). When set for a
  // creator, it's sent on that creator's payload entry; the edge fn falls back to
  // the top-level `format` for creators without one. Used by the campaign forecast
  // (per-creator formats from campaign_creators); the standalone sim leaves it unset.
  creatorFormats?: Record<number, string>;
  /** Average conversion value (AOV) in USD – drives per-creator ROAS and
   *  revenue only, never the headline ROAS. Defaults to DEFAULT_AOV. */
  aov?: number;
  /** Campaign length in weeks, 1–12. Scales volume metrics only. Defaults to
   *  DEFAULT_DURATION_WEEKS. */
  durationWeeks?: number;
}

export interface SimBand {
  impressions: number;
  ctr: number;
  roas: number;
}

/** Defaults mirrored from the edge function (`breakdown.ts`, `duration.ts`). */
export const DEFAULT_AOV = 30;
export const DEFAULT_DURATION_WEEKS = 4;

/** One confidence band of a per-creator breakdown row. Field names are the edge
 *  function's abbreviated ones, not the roster-level `SimBand` spellings. */
export interface SimCreatorBand {
  impr: number;
  ctr: number;
  clicks: number;
  conv: number;
  roas: number;
}

/** Budget range [low, high] per sponsorship format, in USD. */
export interface SimCreatorRates {
  int: [number, number];
  mix: [number, number];
  ded: [number, number];
}

export interface SimCreatorBreakdown {
  /** Echoed back exactly as the payload sent it – `run-simulation.service`
   *  sends `String(creator.id)`, so this arrives as a string at runtime. Callers
   *  keying by creator id must `Number()` it first. */
  id: string | number;
  /** Genre Fit Index, 0–100. */
  gfi: number;
  /** False when the budget could not cover this creator's rate. Their forecast
   *  fields are 0 in that case – the row shows the rate instead. */
  reachable: boolean;
  /** Which of `rates` (Integrated/Mixed/Dedicated) the budget fit gated this
   *  creator on: the creator's own per-creator format, else the campaign
   *  fallback – same resolution `run-simulation` used to price the fit. An
   *  unaffordable row must display this range, not always Integrated,
   *  otherwise it can advertise a rate that isn't what excluded the creator. */
  fitFormat: 'int' | 'mix' | 'ded';
  budgetShare: number;
  impressions: number;
  ctr: number;
  clicks: number;
  cvr: number;
  conversions: number;
  roas: number;
  rates: SimCreatorRates;
  p10: SimCreatorBand;
  p50: SimCreatorBand;
  p90: SimCreatorBand;
}

export interface SimResult {
  impressions: number;
  ctr: number;
  cpM: number;
  cvr: number;
  conversions: number;
  roas: number;                    // P50 — kept for templates/callers that show a single number
  roasP10: number;
  roasP50: number;
  roasP90: number;
  roasRange: string;               // formatted "P10×–P90×" for headline display
  engRate: number;
  clicks: number;
  budget: number;
  /** Echoed back by the edge function so a saved forecast records the
   *  assumptions it was produced under. */
  aov: number;
  durationWeeks: number;
  reachableCount: number;          // creators we could actually afford under the budget
  bench: GenreBenchmark;
  p10: SimBand;
  p50: SimBand;
  p90: SimBand;
  // Per-creator breakdown returned by the edge fn. Optional: absent on older
  // cached results and on test stubs that don't provide it.
  creatorBreakdowns?: SimCreatorBreakdown[];
}

export interface ObjectiveWeights {
  awarenessW: number;
  salesW: number;
  engagementW: number;
}
