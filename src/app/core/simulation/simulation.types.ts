import { Creator } from '../data/creator.types';
import { GenreBenchmark } from '../data/benchmarks.data';

export type Format = 'Integrated' | 'Mixed' | 'Dedicated';

export const OBJECTIVES = [
  'Brand Awareness',
  'Reach & Impressions',
  'Content Virality',
  'Sentiment Shift',
  'Direct Sales',
  'App Install',
  'Promo / Affiliate',
  'Lead Generation',
  'Community Growth',
  'Engagement Rate',
  'Pre-launch Sign-up',
  'Retention',
] as const;

export type Objective = (typeof OBJECTIVES)[number];

export const AWARENESS_OBJECTIVES: readonly Objective[] = [
  'Brand Awareness',
  'Reach & Impressions',
  'Content Virality',
  'Sentiment Shift',
];

export const SALES_OBJECTIVES: readonly Objective[] = [
  'Direct Sales',
  'App Install',
  'Promo / Affiliate',
  'Lead Generation',
];

export const ENGAGEMENT_OBJECTIVES: readonly Objective[] = [
  'Community Growth',
  'Engagement Rate',
  'Pre-launch Sign-up',
  'Retention',
];

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
  roas: number;
  engRate: number;
  clicks: number;
  budget: number;
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
