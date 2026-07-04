import { SimBand } from '../simulation/simulation.types';

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

export interface CampaignForecast {
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
  | 'forecast' | 'startedAt' | 'completedAt'
>>;

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};
