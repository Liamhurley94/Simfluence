export const OUTREACH_STATUSES = [
  'shortlisted',
  'contacted',
  'negotiating',
  'confirmed',
  'declined',
] as const;

export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export interface OutreachRecord {
  id: string;
  creatorId: number;
  campaignId: string | null;
  status: OutreachStatus;
  contact: string;
  notes: string;
  lastContactAt: string | null; // ISO timestamp or null
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export type NewOutreachRecord = Omit<OutreachRecord, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateOutreachRecord = Partial<NewOutreachRecord>;

export const STATUS_LABELS: Record<OutreachStatus, string> = {
  shortlisted: 'Shortlisted',
  contacted: 'Contacted',
  negotiating: 'Negotiating',
  confirmed: 'Confirmed',
  declined: 'Declined',
};
