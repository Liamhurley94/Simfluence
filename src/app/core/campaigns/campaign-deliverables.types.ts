export const DELIVERABLE_PLATFORMS = ['YouTube', 'Twitch'] as const;
export type DeliverablePlatform = (typeof DELIVERABLE_PLATFORMS)[number];

// No 'Mixed': a mixed deal is multiple deliverable rows (1 × Dedicated +
// n × Integrated) — D26/D27. Twitch rows are always 'Dedicated' (DB CHECK).
export const DELIVERABLE_FORMATS = ['Integrated', 'Dedicated'] as const;
export type DeliverableFormat = (typeof DELIVERABLE_FORMATS)[number];

export interface CampaignDeliverable {
  id: string;                        // uuid
  campaignCreatorId: string;         // uuid -> campaign_creators.id
  platform: DeliverablePlatform;
  format: DeliverableFormat;
  quantity: number;
  durationHours: number | null;      // Twitch only; null = not applicable
  agreedFee: number | null;          // stored now, unused by the sim until W2
  // Measured post-campaign actuals (Results section). Impressions/clicks are
  // the deliverable-grain entry fields; conversions/spend/revenue exist for
  // split attribution but have no entry UI yet (spec: Exclusions).
  actualImpressions: number | null;
  actualClicks: number | null;
  actualConversions: number | null;
  actualSpend: number | null;
  actualRevenue: number | null;
  deliveredAt: string | null; // ISO date (YYYY-MM-DD) the video/stream went live
  createdAt: string;
  updatedAt: string;
}

export type NewCampaignDeliverable =
  Pick<CampaignDeliverable, 'campaignCreatorId' | 'platform' | 'format'>
  & Partial<Pick<CampaignDeliverable, 'quantity' | 'durationHours' | 'agreedFee'>>;

export type UpdateCampaignDeliverable = Partial<Pick<CampaignDeliverable,
  'platform' | 'format' | 'quantity' | 'durationHours' | 'agreedFee'>>;

export type UpdateDeliverableActuals = Partial<Pick<CampaignDeliverable,
  'actualImpressions' | 'actualClicks' | 'actualConversions'
  | 'actualSpend' | 'actualRevenue' | 'deliveredAt'>>;
