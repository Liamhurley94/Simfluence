export type EnterpriseStatus = 'pending' | 'active' | 'rejected';

export interface Enterprise {
  id: string;
  name: string;
  address: string | null;
  contact_email: string;
  status: EnterpriseStatus;
  created_at: string;
  created_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_reason: string | null;
}

export interface EnterpriseWithStats extends Enterprise {
  owner_email: string | null;
  member_count: number;
}

export type InviteStatus = 'pending' | 'accepted' | 'cancelled' | 'expired';

export interface EnterpriseInvite {
  id: string;
  enterprise_id: string;
  email: string;
  status: InviteStatus;
  invited_at: string;
  expires_at: string;
  accepted_at: string | null;
}

export type AccountStatus =
  | 'basic'
  | 'full'
  | 'enterprise_pending'
  | 'enterprise_rejected'
  | 'enterprise_member'
  | 'enterprise_owner';

export interface ApplyEnterpriseDto {
  name: string;
  address: string | null;
  contact_email: string;
}
