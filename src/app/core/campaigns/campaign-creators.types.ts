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
  'auto_match',
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

  // Measured post-campaign actuals (entered in the Results section). Null until set.
  actualImpressions: number | null;
  actualClicks: number | null;
  actualConversions: number | null;
  actualSpend: number | null;
  actualRevenue: number | null;
  // Retrospective note about THIS creator's performance. Distinct from `notes`
  // (outreach) — not shown to clients.
  debriefNotes: string | null;

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
  | 'actualImpressions' | 'actualClicks' | 'actualConversions' | 'actualSpend' | 'actualRevenue'
  | 'debriefNotes'
>>;

export const STATUS_LABELS: Record<CampaignCreatorStatus, string> = {
  shortlisted: 'Shortlisted',
  contacted: 'Contacted',
  negotiating: 'Negotiating',
  confirmed: 'Confirmed',
  declined: 'Declined',
};
