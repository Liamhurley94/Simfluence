import { Injectable, signal } from '@angular/core';
import { createClient, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;
  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);
  /** Settles once the initial localStorage session (or its absence) has been
   * applied — before this, `user()` being null means "unknown", not "signed out". */
  readonly sessionReady: Promise<void>;

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    this.sessionReady = this.client.auth.getSession().then(({ data }) => this.applySession(data.session));
    this.client.auth.onAuthStateChange((_event, session) => this.applySession(session));
  }

  get accessToken(): string | null {
    return this.session()?.access_token ?? null;
  }

  private applySession(session: Session | null): void {
    this.session.set(session);
    this.user.set(session?.user ?? null);
  }
}