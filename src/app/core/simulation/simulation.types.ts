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
}

export interface SimBand {
  impressions: number;
  ctr: number;
  roas: number;
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
  reachableCount: number;          // creators we could actually afford under the budget
  bench: GenreBenchmark;
  p10: SimBand;
  p50: SimBand;
  p90: SimBand;
}

export interface ObjectiveWeights {
  awarenessW: number;
  salesW: number;
  engagementW: number;
}
