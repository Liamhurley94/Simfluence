import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { Tier, tierRank } from '../types';
import { AccountStatus, Enterprise } from '../enterprise/enterprise.types';

type ProfileRow = {
  tier: Tier | null;
  client: string | null;
  enterprise_id: string | null;
  is_admin: boolean | null;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService);

  readonly user = this.supabase.user;
  readonly session = this.supabase.session;
  readonly tier = signal<Tier>('free');
  readonly client = signal<string | null>(null);
  readonly isAdmin = signal<boolean>(false);
  readonly enterpriseId = signal<string | null>(null);
  readonly enterprise = signal<Enterprise | null>(null);

  readonly isAuthenticated = computed(() => !!this.user());
  readonly tierLevel = computed(() => tierRank(this.tier()));

  readonly accountStatus = computed<AccountStatus>(() => {
    const eid = this.enterpriseId();
    const ent = this.enterprise();
    if (eid && ent) {
      if (ent.status === 'pending') return 'enterprise_pending';
      if (ent.status === 'rejected') return 'enterprise_rejected';
      if (ent.status === 'active') {
        return ent.created_by === this.user()?.id ? 'enterprise_owner' : 'enterprise_member';
      }
    }
    return this.tier() === 'free' ? 'basic' : 'full';
  });

  constructor() {
    // When the user changes (sign-in, sign-out, rehydration), reload their profile.
    effect(() => {
      const u = this.user();
      if (u?.email) {
        void this.loadProfile(u.email);
      } else {
        this.resetAccount();
      }
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signUp(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.signUp({ email, password });
    if (error) throw error;
  }

  async recover(email: string): Promise<void> {
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    await this.supabase.client.auth.signOut();
  }

  /** Re-reads profile + enterprise from the DB. Call after upgrade/apply/accept-invite. */
  async refresh(): Promise<void> {
    const email = this.user()?.email;
    if (email) await this.loadProfile(email);
  }

  private async loadProfile(email: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('tier, client, enterprise_id, is_admin')
      .eq('email', email)
      .maybeSingle<ProfileRow>();

    if (error || !data) {
      this.resetAccount();
      return;
    }

    this.tier.set(data.tier ?? 'free');
    this.client.set(data.client);
    this.isAdmin.set(!!data.is_admin);
    this.enterpriseId.set(data.enterprise_id);

    if (data.enterprise_id) {
      const { data: ent } = await this.supabase.client
        .from('enterprises')
        .select('*')
        .eq('id', data.enterprise_id)
        .maybeSingle<Enterprise>();
      this.enterprise.set(ent ?? null);
    } else {
      this.enterprise.set(null);
    }
  }

  private resetAccount(): void {
    this.tier.set('free');
    this.client.set(null);
    this.isAdmin.set(false);
    this.enterpriseId.set(null);
    this.enterprise.set(null);
  }
}