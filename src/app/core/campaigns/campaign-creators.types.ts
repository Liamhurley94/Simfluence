export const CAMPAIGN_CREATOR_STATUSES = [
  'shortlisted',
  'contacted',
  'negotiating',
  'confirmed',
  'declined',
] as const;
export type CampaignCreatorStatus = (typeof CAMPAIGN_CREATOR_STATUSES)[number];

export const CAMPAIGN_CREATOR_SOURCES = [
  'manual',
  'simulator',
  'persona_suggestion',
  'discovery',
] as const;
export type CampaignCreatorSource = (typeof CAMPAIGN_CREATOR_SOURCES)[number];

export const SPONSORSHIP_FORMATS = ['Integrated', 'Dedicated', 'Mixed'] as const;
export type SponsorshipFormat = (typeof SPONSORSHIP_FORMATS)[number];

export interface CampaignCreator {
  id: string;                            // uuid
  campaignId: string;
  creatorId: number;

  status: CampaignCreatorStatus;
  source: CampaignCreatorSource;

  // Set during outreach negotiation (not at add-time). Different creators on the
  // same campaign can end up on different formats.
  format: SponsorshipFormat | null;

  contactEmail: string | null;
  contactHandle: string | null;
  notes: string | null;
  lastContactAt: string | null;

  rateEstimate: number | null;
  cpiAtAdd: number | null;

  addedAt: string;
  updatedAt: string;
}

export type NewCampaignCreator = Pick<CampaignCreator, 'campaignId' | 'creatorId'>
  & Partial<Pick<CampaignCreator,
    'status' | 'source' | 'contactEmail' | 'contactHandle' | 'notes' | 'rateEstimate' | 'cpiAtAdd'
  >>;

export type UpdateCampaignCreator = Partial<Pick<CampaignCreator,
  'status' | 'format' | 'contactEmail' | 'contactHandle' | 'notes' | 'lastContactAt'
  | 'rateEstimate'
>>;

export const STATUS_LABELS: Record<CampaignCreatorStatus, string> = {
  shortlisted: 'Shortlisted',
  contacted: 'Contacted',
  negotiating: 'Negotiating',
  confirmed: 'Confirmed',
  declined: 'Declined',
};
