import { Objective } from './simulation.types';

/**
 * W2 simulator rebuild request/response shapes. Mirrors
 * `supabase/functions/run-simulation/index.ts` (+ `aggregate.ts`) on the
 * `feature/sim-rebuild-w2` backend branch EXACTLY — that function is the
 * contract source of truth, and it emits camelCase JSON directly (no
 * snake_case mapping happens on either side). Do not add fields here that
 * the backend doesn't produce.
 *
 * See docs/superpowers/specs/2026-08-26-simulator-rebuild-design.md.
 *
 * The legacy `SimInputs`/`SimResult` types in `simulation.types.ts` are
 * untouched — the debrief still renders legacy saved forecasts (no
 * `model.version`) through that path. The panel switch to W2 is Task 7.
 */

export type SimW2Mode = 'free' | 'campaign';
export type DeliverablePlatform = 'YouTube' | 'Twitch';
export type DeliverableFormat = 'Integrated' | 'Dedicated';

// ── REQUEST ───────────────────────────────────────────────────────────
// The client sends ids, never stats or deliverable contents (D18 rule 4) —
// no aov, no durationWeeks (both cut, spec §6.1/§6.3), no per-creator subs/
// avgViews/cpi (spec §2: the server loads all of that itself).

export interface W2FreeRequest {
  mode: 'free';
  creators: Array<{ id: number }>;
  budget: number;
  genre: string;
  subMode?: string;
  objectives?: Objective[];
}

export interface W2CampaignRequest {
  mode: 'campaign';
  campaignId: string;
  genre?: string;
  subMode?: string;
  objectives?: Objective[];
}

export type W2Request = W2FreeRequest | W2CampaignRequest;

// ── RESPONSE ──────────────────────────────────────────────────────────

export interface VolumeWindow {
  impressions: number;
  uniqueReach: number;
  engagedClicks: number;
  conversions: number;
}

/** D18 rule 3: Conservative / Expected / Optimistic replace P10/P90. */
export interface Band {
  conservative: number;
  expected: number;
  optimistic: number;
}

/** A band over a metric that cannot be summed across platforms without overlap — labelled everywhere it appears, exactly like the point estimate (spec §5). */
export interface UpperBoundBand extends Band {
  upperBound: true;
}

export interface DeliverableResult {
  creatorId: string;
  platform: DeliverablePlatform;
  format: DeliverableFormat;
  quantity: number;
  durationHours: number | null;
  /** Input echo (spec §8): the per-unit reach, CPI and GFI this row was computed from. */
  reach: number | null;
  cpi: number;
  /** True when the platform had no CPI and the neutral 50 stood in. Never set on a `noData` row, which is already reported in full. */
  cpiSubstituted: boolean;
  gfi: number;
  /** True when the selected platform has no stats row or no usable reach — excluded from every aggregate. */
  noData: boolean;
  ctr: number;
  cvr: number;
  impressions: number;
  uniqueReach: number;
  engagedClicks: number;
  conversions: number;
  d60: VolumeWindow;
  d90: VolumeWindow;
  band: { impressions: Band; uniqueReach: Band; engagedClicks: Band; conversions: Band };
  cost: number;
  costSource: 'agreed' | 'estimated';
  bandBreach: 'above' | 'below' | null;
  rateRange: [number, number] | null;
  costPerConversion: number | null;
}

export interface CreatorResult {
  id: string;
  name: string | null;
  primaryPlatform: string | null;
  gfi: number;
  /** False when the budget could not cover this creator's summed deliverable cost — excluded from the campaign totals, kept on the response so the client can show what it is missing. */
  reachable: boolean;
  /** Observed engagement rate from the platform cache (YouTube only, D26) — measured, not modelled. */
  engagementRate: number | null;
  /** Every deliverable's cost, including rows excluded from the forecast for want of stats — money is owed either way. */
  cost: number;
  /** The slice of `cost` that bought forecastable rows — the divisor behind this creator's `costPerConversion`, mirroring `totals`. */
  forecastableCost: number;
  impressions: number;
  uniqueReach: number;
  engagedClicks: number;
  conversions: number;
  costPerConversion: number | null;
  /** True when this creator's rows span more than one platform, making its own reach/conversions an upper bound too. */
  reachUpperBound: boolean;
  deliverables: DeliverableResult[];
}

export interface PlatformTotals {
  platform: string;
  impressions: number;
  uniqueReach: number;
  engagedClicks: number;
  conversions: number;
  cost: number;
  costPerConversion: number | null;
}

export interface CampaignTotals {
  impressions: number;
  engagedClicks: number;
  /** Never a silent sum — the per-platform total, labelled (spec §5). */
  uniqueReach: { value: number; upperBound: true };
  conversions: { value: number; upperBound: true };
  /** What the campaign spends: every deliverable of every affordable creator. */
  cost: number;
  /** The slice of `cost` that bought forecastable rows — the denominator `costPerConversion` is honest about. */
  forecastableCost: number;
  costPerConversion: number | null;
  band: { impressions: Band; uniqueReach: UpperBoundBand; engagedClicks: Band; conversions: UpperBoundBand };
}

export interface W2Response {
  mode: SimW2Mode;
  budget: number;
  genre: string;
  subMode: string;
  objectives: string[];
  model: {
    version: string;
    params: { T: number; k_youtube: number; k_twitch: number };
    generatedAt: string;
  };
  bench: { ctrBase: number; cvrBase: number; engBase: number };
  creators: CreatorResult[];
  platforms: Array<PlatformTotals & { band: { impressions: Band; uniqueReach: Band; engagedClicks: Band; conversions: Band } }>;
  totals: CampaignTotals;
  unallocated: number;
  unallocatedMessage: string | null;
  /** True when the resolved budget is zero or less — nothing is affordable, so the empty forecast below is a consequence and not a result. */
  zeroBudget: boolean;
  warnings: string[];
}
