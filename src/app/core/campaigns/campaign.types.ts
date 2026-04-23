import { SimBand } from '../simulation/simulation.types';

export interface CampaignForecast {
  impressions: number;
  ctr: number;
  roas: number;
  cvr: number;
  p10: SimBand;
  p50: SimBand;
  p90: SimBand;
}

export interface Campaign {
  id: string;
  name: string;
  client: string;
  genre: string;
  budget: number;
  goLiveDate: string | null; // ISO date (YYYY-MM-DD) or null
  notes: string;
  creatorIds: number[];
  forecast: CampaignForecast | null;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export type NewCampaign = Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateCampaign = Partial<NewCampaign>;
