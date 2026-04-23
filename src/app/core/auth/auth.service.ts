import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { Tier, tierRank } from '../types';

type ProfileRow = { tier: Tier | null; client: string | null };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService);

  readonly user = this.supabase.user;
  readonly session = this.supabase.session;
  readonly tier = signal<Tier>('free');
  readonly client = signal<string | null>(null);

  readonly isAuthenticated = computed(() => !!this.user());
  readonly tierLevel = computed(() => tierRank(this.tier()));

  constructor() {
    // When the user changes (sign-in, sign-out, rehydration), reload their profile.
    effect(() => {
      const u = this.user();
      if (u?.email) {
        void this.loadProfile(u.email);
      } else {
        this.tier.set('free');
        this.client.set(null);
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

  private async loadProfile(email: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('tier, client')
      .eq('email', email)
      .maybeSingle<ProfileRow>();

    if (error || !data) {
      this.tier.set('free');
      this.client.set(null);
      return;
    }

    this.tier.set(data.tier ?? 'free');
    this.client.set(data.client);
  }
}