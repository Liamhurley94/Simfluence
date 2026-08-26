import { SimBand } from '../simulation/simulation.types';
import { W2Response } from '../simulation/simulation-w2.types';

export const CAMPAIGN_STATUSES = ['planning', 'active', 'completed', 'archived'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export interface CampaignForecastCreator {
  id: number;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
}

/**
 * A forecast saved before the W2 rebuild (no `model.version`). Saved forecasts
 * are records, never migrated or recomputed (spec §8 / D12) — so this shape
 * stays exactly as it was and the debrief keeps rendering it.
 */
export interface LegacyCampaignForecast {
  impressions: number;
  ctr: number;
  roas: number;
  cvr: number;
  p10: SimBand;
  p50: SimBand;
  p90: SimBand;
  // Slim per-creator snapshot captured at Save time, for the debrief's per-creator
  // rows. Optional so pre-existing saved forecasts still load.
  creatorBreakdowns?: CampaignForecastCreator[];
  /** Assumptions the forecast was produced under, so the debrief can say what
   *  it is grading against. Optional – forecasts saved before 2026-08-09 have
   *  neither. `campaigns.forecast` is jsonb, so this needs no migration. */
  aov?: number;
  durationWeeks?: number;
}

/**
 * `campaigns.forecast` holds whichever forecast shape was current when Save was
 * pressed. W2 persists the whole `W2Response`, version-stamped (spec §8); every
 * read path discriminates with `isW2Forecast` rather than guessing.
 */
export type CampaignForecast = LegacyCampaignForecast | W2Response;

/** D18 rule 4: the version stamp is the discriminator, nothing else. */
export function isW2Forecast(f: CampaignForecast | null | undefined): f is W2Response {
  return !!f && typeof (f as W2Response).model?.version === 'string';
}

export interface Campaign {
  id: string;
  createdBy: string;                // auth user uuid
  enterpriseId: string | null;      // null → personal campaign; non-null → enterprise-owned

  status: CampaignStatus;

  name: string;
  client: string | null;
  genre: string | null;
  budget: number | null;
  notes: string | null;
  objectives: string[];

  forecast: CampaignForecast | null;

  // Retrospective note about the campaign overall (Results section). Distinct
  // from `notes` (the planning brief, which flows into the client brief PDF).
  debriefNotes: string | null;

  startedAt: string | null;         // ISO timestamp, set when Start campaign button is pressed
  completedAt: string | null;       // ISO timestamp, set when Mark complete is pressed
  createdAt: string;                // ISO timestamp
  updatedAt: string;                // ISO timestamp
}

export type NewCampaign = Pick<Campaign, 'name'>
  & Partial<Pick<Campaign,
    'client' | 'genre' | 'budget' | 'notes' | 'objectives' | 'enterpriseId'
  >>;

export type UpdateCampaign = Partial<Pick<Campaign,
  'name' | 'client' | 'genre' | 'budget' | 'notes' | 'objectives' | 'status'
  | 'forecast' | 'startedAt' | 'completedAt' | 'debriefNotes'
>>;

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};
