import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { DailyUsage, YoutubeQuotaStatus } from './admin-usage.types';

/**
 * Admin-only API usage + YouTube quota status. Both RPCs are SECURITY DEFINER and
 * guarded server-side by current_user_is_admin() (non-admins get empty results).
 */
@Injectable({ providedIn: 'root' })
export class AdminUsageService {
  private supabase = inject(SupabaseService);

  async usage(days: number): Promise<DailyUsage[]> {
    const { data, error } = await this.supabase.client.rpc('admin_api_usage', { p_days: days });
    if (error) throw error;
    return (data ?? []) as DailyUsage[];
  }

  async youtubeQuotaStatus(): Promise<YoutubeQuotaStatus | null> {
    const { data, error } = await this.supabase.client.rpc('youtube_quota_status');
    if (error) throw error;
    const rows = (data ?? []) as YoutubeQuotaStatus[];
    return rows.length ? rows[0] : null;
  }
}
