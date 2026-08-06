import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminCreatorsComponent, offlineStatusFor } from './admin-creators.component';
import { AdminCreatorService } from '../../core/admin/admin-creator.service';
import { AddedCreator } from '../../core/admin/admin-creator.types';

function setup(
  listCreators = vi.fn().mockResolvedValue({ added: [], offline: [] }),
  attachPlatform = vi.fn().mockResolvedValue({ attached: { creatorId: 1, platform: 'twitch' } }),
) {
  const resyncCreator = vi.fn().mockResolvedValue({ resynced: { creatorId: 9, platform: 'YouTube' } });
  const syncUnsynced = vi.fn().mockResolvedValue({ youtube: 0, gfi: 0, twitch: 0, rates: 0 });
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AdminCreatorsComponent],
    providers: [
      { provide: AdminCreatorService, useValue: { listCreators, resyncCreator, attachPlatform, syncUnsynced } },
    ],
  });
  return { listCreators, resyncCreator, attachPlatform, syncUnsynced };
}

const mkAdded = (over: Partial<AddedCreator> = {}): AddedCreator => ({
  id: 1, name: 'A', genre: 'Gaming', platforms: ['YouTube'], addedAt: '2026-07-07T00:00:00Z',
  youtube: 'resolved', twitch: null, gfi: true, cpi: 42, ...over,
});

describe('AdminCreatorsComponent added list', () => {
  it('anyUnsettled: true while resolving, resolved, or GFI missing; false once terminal', () => {
    setup();
    const c = TestBed.createComponent(AdminCreatorsComponent).componentInstance;
    expect(c.anyUnsettled([mkAdded({ youtube: 'resolving' })])).toBe(true);
    expect(c.anyUnsettled([mkAdded({ youtube: 'resolved', gfi: true })])).toBe(true);
    expect(c.anyUnsettled([mkAdded({ youtube: 'synced', gfi: false })])).toBe(true);
    expect(c.anyUnsettled([mkAdded({ youtube: 'synced', gfi: true })])).toBe(false);
    expect(c.anyUnsettled([mkAdded({ youtube: 'offline', gfi: true })])).toBe(false);
    expect(c.anyUnsettled([mkAdded({ youtube: 'synced', twitch: 'resolved', gfi: true })])).toBe(true);
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

describe('AdminCreatorsComponent sync unsynced', () => {
  it('shows the button only while something is unsettled', async () => {
    const { listCreators } = setup();
    listCreators.mockResolvedValue({ added: [mkAdded({ youtube: 'resolved' })], offline: [] });
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    await fixture.componentInstance.loadList();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="sync-unsynced"]')).toBeTruthy();

    listCreators.mockResolvedValue({ added: [mkAdded({ youtube: 'synced', gfi: true })], offline: [] });
    await fixture.componentInstance.loadList();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="sync-unsynced"]')).toBeNull();
  });

  it('dispatches the sync RPC and shows the summary notice', async () => {
    const { listCreators, syncUnsynced } = setup();
    listCreators.mockResolvedValue({ added: [mkAdded({ youtube: 'resolved', gfi: false })], offline: [] });
    syncUnsynced.mockResolvedValue({ youtube: 1, gfi: 2, twitch: 0, rates: 0 });
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    await fixture.componentInstance.loadList();
    await fixture.componentInstance.syncUnsynced();
    fixture.detectChanges();
    expect(syncUnsynced).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('YouTube: 1');
    expect(fixture.nativeElement.textContent).toContain('GFI: 2');
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
    expect(offlineStatusFor('invalid_handle_format').label).toBe('Handle has invalid characters');
    expect(offlineStatusFor('invalid_handle_format').tip).toContain('lowercase');
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

describe('AdminCreatorsComponent — add platform', () => {
  it('hides the button when both platforms are present, shows it when either is missing', async () => {
    const { listCreators } = setup();
    listCreators.mockResolvedValue({
      added: [
        mkAdded({ id: 1, youtube: 'synced', twitch: 'synced' }),
        mkAdded({ id: 2, youtube: 'synced', twitch: null }),
      ],
      offline: [],
    });
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    await fixture.componentInstance.loadList();
    fixture.detectChanges();
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="admin-added-row"]'));
    expect(rows[0].querySelector('[data-testid="add-platform"]')).toBeNull();
    expect(rows[1].querySelector('[data-testid="add-platform"]')).not.toBeNull();
  });

  it('openAddPlatform preselects the sole missing platform', async () => {
    const { listCreators } = setup();
    listCreators.mockResolvedValue({ added: [mkAdded({ id: 5, youtube: 'synced', twitch: null })], offline: [] });
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    const c = fixture.componentInstance;
    await c.loadList();

    c.openAddPlatform(c.added()[0]);

    expect(c.platformDialogFor()).toEqual(c.added()[0]);
    expect(c.dialogPlatform()).toBe('twitch');
  });

  it('submits attachPlatform with creatorId + platform + bare handle (strips a leading @), then reloads and closes', async () => {
    const { listCreators, attachPlatform } = setup();
    listCreators.mockResolvedValue({ added: [mkAdded({ id: 5, youtube: 'synced', twitch: null })], offline: [] });
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    const c = fixture.componentInstance;
    await c.loadList();
    listCreators.mockClear();

    c.openAddPlatform(c.added()[0]);
    c.dialogHandle.set('@somehandle');
    await c.submitPlatform();

    expect(attachPlatform).toHaveBeenCalledWith({ creatorId: 5, platform: 'twitch', handle: 'somehandle' });
    expect(c.platformDialogFor()).toBeNull(); // dialog closed
    expect(listCreators).toHaveBeenCalledTimes(1); // reloaded after success
  });

  it('surfaces an attach failure inline via errorMessage() and leaves the dialog open', async () => {
    const attachPlatform = vi.fn().mockRejectedValue({ error: { error: 'handle already attached elsewhere' } });
    const listCreators = vi.fn().mockResolvedValue({ added: [mkAdded({ id: 5, youtube: 'synced', twitch: null })], offline: [] });
    setup(listCreators, attachPlatform);
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    const c = fixture.componentInstance;
    await c.loadList();

    c.openAddPlatform(c.added()[0]);
    c.dialogHandle.set('somehandle');
    await c.submitPlatform();

    expect(c.dialogError()).toBe('handle already attached elsewhere');
    expect(c.platformDialogFor()).not.toBeNull(); // dialog stays open on failure
  });
});

describe('AdminCreatorsComponent — polling', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('MAX_POLLS bounds each polling episode, not the component lifetime: a fresh resolving list re-arms polling after the ceiling', async () => {
    const listCreators = vi.fn().mockResolvedValue({ added: [mkAdded({ youtube: 'resolving' })], offline: [] });
    setup(listCreators);
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    await fixture.componentInstance.loadList();
    listCreators.mockClear();

    // Jump to one tick before the ceiling instead of ticking MAX_POLLS times.
    const internals = fixture.componentInstance as unknown as { pollAttempts: number; MAX_POLLS: number };
    internals.pollAttempts = internals.MAX_POLLS - 1;

    await vi.advanceTimersByTimeAsync(5000); // final tick: ceiling hit → polling stops
    const callsAtStop = listCreators.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(listCreators.mock.calls.length).toBe(callsAtStop); // interval disarmed

    // A fresh reload with the still-resolving list must re-arm polling
    // (regression: a lifetime-cumulative pollAttempts kept this disarmed forever).
    await fixture.componentInstance.loadList();
    const callsAfterReload = listCreators.mock.calls.length;
    expect(callsAfterReload).toBe(callsAtStop + 1); // the reload itself
    await vi.advanceTimersByTimeAsync(5000);
    expect(listCreators.mock.calls.length).toBe(callsAfterReload + 1); // polling ticked again
  });
});

describe('AdminCreatorsComponent attach-dialog Twitch handle validation', () => {
  it('rejects an invalid-format Twitch handle before calling attach', async () => {
    const { attachPlatform } = setup();
    const c = TestBed.createComponent(AdminCreatorsComponent).componentInstance;
    c.platformDialogFor.set(mkAdded({ twitch: null }));
    c.dialogPlatform.set('twitch');
    c.dialogHandle.set('@bmsjoël');
    await c.submitPlatform();
    expect(attachPlatform).not.toHaveBeenCalled();
    expect(c.dialogError()).toContain('letters, numbers');
  });
});
