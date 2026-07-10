import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminCreatorsComponent, offlineStatusFor } from './admin-creators.component';
import { AdminCreatorService } from '../../core/admin/admin-creator.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { AddedCreator } from '../../core/admin/admin-creator.types';

function setup(
  addCreators = vi.fn().mockResolvedValue({ created: [{ id: 1, name: 'A', platforms: ['YouTube'] }] }),
  listCreators = vi.fn().mockResolvedValue({ added: [], offline: [] }),
) {
  const resyncCreator = vi.fn().mockResolvedValue({ resynced: { creatorId: 9, platform: 'YouTube' } });
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AdminCreatorsComponent],
    providers: [
      { provide: AdminCreatorService, useValue: { addCreators, listCreators, resyncCreator } },
      { provide: CreatorsService, useValue: { submodesByGenre: () => ({ Gaming: [], Music: [] }), languages: () => ['German', 'English'] } },
    ],
  });
  return { addCreators, listCreators, resyncCreator };
}

describe('AdminCreatorsComponent add form', () => {
  it('genre options come from submodesByGenre keys (sorted)', () => {
    setup();
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    expect(fixture.componentInstance.genreOptions()).toEqual(['Gaming', 'Music']);
  });

  it('language options come from CreatorsService.languages (sorted)', () => {
    setup();
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    expect(fixture.componentInstance.languageOptions()).toEqual(['English', 'German']);
  });

  it('blocks submit with no platform handle and does not call the service', async () => {
    const { addCreators } = setup();
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    const c = fixture.componentInstance;
    c.form.patchValue({ name: 'A', genre: 'Gaming', youtube: '', twitch: '' });
    await c.onSubmit();
    expect(addCreators).not.toHaveBeenCalled();
    expect(c.error()).toBe('Add at least one platform handle (YouTube or Twitch).');
  });

  it('submits a normalized AddCreatorInput, shows success, refreshes list, resets form', async () => {
    const { addCreators, listCreators } = setup();
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    const c = fixture.componentInstance;
    c.form.patchValue({ name: '  A  ', genre: 'Gaming', youtube: ' @foo ', twitch: '', bio: ' hi ' });
    await c.onSubmit();
    expect(addCreators).toHaveBeenCalledWith([{ name: 'A', genre: 'Gaming', platforms: { youtube: '@foo' }, bio: 'hi' }]);
    expect(c.success()).toContain('Added');
    expect(listCreators.mock.calls.length).toBeGreaterThanOrEqual(2); // constructor load + post-add refresh
    expect(c.form.getRawValue().name).toBe(''); // form reset to blanks, not null
  });

  it('surfaces the service error message', async () => {
    const { addCreators } = setup(vi.fn().mockRejectedValue(new Error('dup')));
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    const c = fixture.componentInstance;
    c.form.patchValue({ name: 'A', genre: 'Gaming', youtube: 'foo' });
    await c.onSubmit();
    expect(c.error()).toBe('dup');
    expect(addCreators).toHaveBeenCalled();
  });
});

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
    setup(undefined, deferred);
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
