import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUsageService } from './admin-usage.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('AdminUsageService', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let svc: AdminUsageService;
  beforeEach(() => {
    rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [AdminUsageService, { provide: SupabaseService, useValue: { client: { rpc } } }],
    });
    svc = TestBed.inject(AdminUsageService);
  });

  it('usage(days) calls admin_api_usage with p_days', async () => {
    await svc.usage(14);
    expect(rpc).toHaveBeenCalledWith('admin_api_usage', { p_days: 14 });
  });

  it('youtubeQuotaStatus() calls youtube_quota_status and returns the single row', async () => {
    rpc.mockResolvedValueOnce({
      data: [{ effective_ceiling: 950000, elevated_limit: 950000, default_limit: 9500, elevated_until: '2027-01-08T08:00:00+00:00', used_today: 1200 }],
      error: null,
    });
    const s = await svc.youtubeQuotaStatus();
    expect(rpc).toHaveBeenCalledWith('youtube_quota_status');
    expect(s?.effective_ceiling).toBe(950000);
  });

  it('youtubeQuotaStatus() returns null on empty (non-admin / no data)', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await svc.youtubeQuotaStatus()).toBeNull();
  });
});
