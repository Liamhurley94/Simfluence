import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AdminCreatorsComponent, offlineStatusFor } from './admin-creators.component';
import { AdminCreatorService } from '../../core/admin/admin-creator.service';
import { AddedCreator } from '../../core/admin/admin-creator.types';

function setup(
  listCreators = vi.fn().mockResolvedValue({ added: [], offline: [] }),
) {
  const resyncCreator = vi.fn().mockResolvedValue({ resynced: { creatorId: 9, platform: 'YouTube' } });
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AdminCreatorsComponent],
    providers: [
      { provide: AdminCreatorService, useValue: { listCreators, resyncCreator } },
    ],
  });
  return { listCreators, resyncCreator };
}

const mkAdded = (over: Partial<AddedCreator> = {}): AddedCreator => ({
  id: 1, name: 'A', genre: 'Gaming', platforms: ['YouTube'], addedAt: '2026-07-07T00:00:00Z',
  youtube: 'resolved', twitch: null, gfi: true, cpi: 42, ...over,
});

describe('AdminCreatorsComponent added list', () => {
  it('anyResolving: true while resolving or GFI missing, false once settled', () => {
    setup();
    const c = TestBed.createComponent(AdminCreatorsComponent).componentInstance;
    expect(c.anyResolving([mkAdded({ youtube: 'resolving' })])).toBe(true);
    expect(c.anyResolving([mkAdded({ youtube: 'resolved', gfi: false })])).toBe(true);
    expect(c.anyResolving([mkAdded({ youtube: 'resolved', gfi: true })])).toBe(false);
    expect(c.anyResolving([mkAdded({ youtube: 'synced', gfi: true })])).toBe(false);
    expect(c.anyResolving([mkAdded({ youtube: 'offline', gfi: true })])).toBe(false);
  });

  it('renders one row per added creator with a status label', async () => {
    const { listCreators } = setup();
    listCreators.mockResolvedValue({ added: [mkAdded(), mkAdded({ id: 2, name: 'B' })], offline: [] });
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    await fixture.componentInstance.loadList();
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="admin-added-row"]');
    expect(rows.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Resolved');
  });
});

describe('AdminCreatorsComponent loading states', () => {
  it('shows a spinner on first load (not the empty state), then resolves', async () => {
    let resolve!: (v: { added: unknown[]; offline: unknown[] }) => void;
    const deferred = vi.fn().mockImplementation(
      () => new Promise((r) => { resolve = r as (v: { added: unknown[]; offline: unknown[] }) => void; }),
    );
    setup(deferred);
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    fixture.detectChanges();

    // First load in flight: spinner shown, empty-state hidden.
    expect(fixture.nativeElement.querySelector('[data-testid="added-loading"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('No creators added yet');

    resolve({ added: [], offline: [] });
    await fixture.whenStable();
    fixture.detectChanges();

    // Loaded + empty: spinner gone, empty-state shown.
    expect(fixture.nativeElement.querySelector('[data-testid="added-loading"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No creators added yet');
  });
});

describe('offlineStatusFor', () => {
  it('maps known reasons to friendly labels + tooltips', () => {
    expect(offlineStatusFor('bootstrap_no_channel').label).toContain('resolve');
    expect(offlineStatusFor('channels_list_empty_2x').label).toBe('Channel went dark');
    expect(offlineStatusFor('get_users_empty_2x').label).toBe('Channel went dark');
    expect(offlineStatusFor('bootstrap_no_channel').tip.length).toBeGreaterThan(20);
  });

  it('falls back to a generic status for unknown/null reasons', () => {
    expect(offlineStatusFor(null).label).toBe('Offline');
    expect(offlineStatusFor('brand_new_reason').label).toBe('Offline');
  });
});

describe('AdminCreatorsComponent offline list', () => {
  const mkOffline = () => ({
    added: [],
    offline: [{ id: 9, name: 'Gone', platform: 'YouTube', offlineAt: '2026-07-01T00:00:00Z', reason: 'channel not found' }],
  });

  it('shows a friendly status chip with a tooltip instead of the raw reason', async () => {
    const { listCreators } = setup();
    listCreators.mockResolvedValue({
      added: [],
      offline: [{ id: 9, name: 'Gone', platform: 'YouTube', offlineAt: '2026-07-01T00:00:00Z', reason: 'bootstrap_no_channel' }],
    });
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    await fixture.componentInstance.loadList();
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector('[data-testid="offline-status"]');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('resolve'); // friendly label, not the raw code
    expect(fixture.nativeElement.textContent).not.toContain('bootstrap_no_channel');
    expect(chip.getAttribute('title')).toContain('handle'); // tooltip explains it
  });

  it('renders offline creators with a re-sync button', async () => {
    const { listCreators } = setup();
    listCreators.mockResolvedValue(mkOffline());
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    await fixture.componentInstance.loadList();
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="admin-offline-row"]');
    expect(rows.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Gone');
    expect(fixture.nativeElement.querySelector('[data-testid="admin-resync"]')).not.toBeNull();
  });

  it('onResync calls resyncCreator(id, platform) and reloads the list', async () => {
    const { listCreators, resyncCreator } = setup();
    listCreators.mockResolvedValue(mkOffline());
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    const c = fixture.componentInstance;
    await c.loadList();
    const before = listCreators.mock.calls.length;
    await c.onResync({ id: 9, name: 'Gone', platform: 'YouTube', offlineAt: null, reason: null });
    expect(resyncCreator).toHaveBeenCalledWith(9, 'YouTube');
    expect(listCreators.mock.calls.length).toBe(before + 1); // reloaded after resync
  });
});
