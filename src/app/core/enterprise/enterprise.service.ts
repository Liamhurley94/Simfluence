import { Injectable, inject, signal } from '@angular/core';
import { EdgeClient } from '../api/edge.client';
import { SupabaseService } from '../supabase/supabase.service';
import {
  ApplyEnterpriseDto,
  Enterprise,
  EnterpriseInvite,
  EnterpriseWithStats,
} from './enterprise.types';

@Injectable({ providedIn: 'root' })
export class EnterpriseService {
  private edge = inject(EdgeClient);
  private supabase = inject(SupabaseService);

  readonly invites = signal<EnterpriseInvite[]>([]);
  readonly invitesLoading = signal(false);

  async upgradeToFull(): Promise<{ success: boolean; tier: string }> {
    return this.edge.post('upgrade-to-full', {});
  }

  async applyForEnterprise(dto: ApplyEnterpriseDto): Promise<{ enterprise: Enterprise }> {
    return this.edge.post('apply-for-enterprise', dto);
  }

  async inviteUser(email: string): Promise<{ success: boolean; invite: EnterpriseInvite }> {
    return this.edge.post('enterprise-invite-user', { email });
  }

  async acceptInvite(token: string): Promise<{ success: boolean; enterprise_id: string; tier: string }> {
    return this.edge.post('accept-enterprise-invite', { token });
  }

  async adminListEnterprises(): Promise<{ enterprises: EnterpriseWithStats[] }> {
    return this.edge.get('admin-list-enterprises');
  }

  async adminApprove(enterpriseId: string): Promise<{ success: boolean; enterprise: Enterprise }> {
    return this.edge.post('admin-approve-enterprise', { enterprise_id: enterpriseId });
  }

  async adminReject(enterpriseId: string, reason?: string): Promise<{ success: boolean; enterprise: Enterprise }> {
    return this.edge.post('admin-reject-enterprise', { enterprise_id: enterpriseId, reason });
  }

  async loadInvites(enterpriseId: string): Promise<void> {
    this.invitesLoading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('enterprise_invites')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .order('invited_at', { ascending: false });
      if (error) throw error;
      this.invites.set((data ?? []) as EnterpriseInvite[]);
    } finally {
      this.invitesLoading.set(false);
    }
  }
}
