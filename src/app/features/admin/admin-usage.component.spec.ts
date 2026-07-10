import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AdminUsageComponent } from './admin-usage.component';
import { AdminUsageService } from '../../core/admin/admin-usage.service';

function setup(
  status: unknown = { effective_ceiling: 950000, elevated_limit: 950000, default_limit: 9500, elevated_until: '2027-01-08T08:00:00+00:00', used_today: 95000 },
) {
  const usage = vi.fn().mockResolvedValue([
    { day: '2026-07-09', yt_units: 4000, tw_calls: 120 },
    { day: '2026-07-10', yt_units: 95000, tw_calls: 90 },
  ]);
  const youtubeQuotaStatus = vi.fn().mockResolvedValue(status);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AdminUsageComponent],
    providers: [{ provide: AdminUsageService, useValue: { usage, youtubeQuotaStatus } }],
  });
  return { usage, youtubeQuotaStatus };
}

// Drive the resource() load: flush its effect, await the loader promise, re-render.
async function settle(f: ComponentFixture<AdminUsageComponent>): Promise<void> {
  f.detectChanges();
  TestBed.flushEffects();
  await f.whenStable();
  f.detectChanges();
}

describe('AdminUsageComponent', () => {
  it('loads usage + quota status on init and defaults the range to 7', async () => {
    const { usage } = setup();
    const f = TestBed.createComponent(AdminUsageComponent);
    await settle(f);
    expect(f.componentInstance.range()).toBe(7);
    expect(usage).toHaveBeenCalledWith(7);
  });

  it('changing the range re-queries usage', async () => {
    const { usage } = setup();
    const f = TestBed.createComponent(AdminUsageComponent);
    await settle(f);
    f.componentInstance.setRange(30);
    await settle(f);
    expect(usage).toHaveBeenCalledWith(30);
  });

  it('budgetPct is used_today / effective_ceiling', async () => {
    setup();
    const f = TestBed.createComponent(AdminUsageComponent);
    await settle(f);
    expect(f.componentInstance.budgetPct()).toBe(10); // 95000 / 950000
  });

  it('revertDays counts days to elevated_until while elevated', async () => {
    setup();
    const f = TestBed.createComponent(AdminUsageComponent);
    await settle(f);
    expect(f.componentInstance.revertDays()).toBeGreaterThan(0);
  });

  it('reports elevated=false once effective equals default', async () => {
    setup({ effective_ceiling: 9500, elevated_limit: 950000, default_limit: 9500, elevated_until: '2020-01-01T00:00:00+00:00', used_today: 100 });
    const f = TestBed.createComponent(AdminUsageComponent);
    await settle(f);
    expect(f.componentInstance.isElevated()).toBe(false);
  });

  it('the latest range wins when an earlier slow request resolves after (resource drops the stale load)', async () => {
    const { usage } = setup();
    const f = TestBed.createComponent(AdminUsageComponent);
    await settle(f); // initial 7-day load

    let resolve30!: (v: unknown) => void;
    const p30 = new Promise<unknown>((r) => { resolve30 = r; });
    usage.mockReset();
    usage
      .mockReturnValueOnce(p30) // 30d — slow
      .mockResolvedValueOnce([{ day: 'd14', yt_units: 14, tw_calls: 0 }]); // 14d — fast

    f.componentInstance.setRange(30);
    f.detectChanges();
    TestBed.flushEffects(); // 30d loader fires (pending)
    f.componentInstance.setRange(14);
    await settle(f); // 14d loader fires + resolves, supersedes 30d

    expect(f.componentInstance.daily()).toEqual([{ day: 'd14', yt_units: 14, tw_calls: 0 }]);

    resolve30([{ day: 'd30', yt_units: 30, tw_calls: 0 }]); // stale 30d resolves last
    await settle(f);
    expect(f.componentInstance.daily()).toEqual([{ day: 'd14', yt_units: 14, tw_calls: 0 }]);
  });
});
