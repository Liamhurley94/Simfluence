import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { DiscoveryQueueComponent } from './discovery-queue.component';
import { AdminDiscoveryService } from '../../core/admin/admin-discovery.service';
import { AdminCreatorService } from '../../core/admin/admin-creator.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { DiscoveredChannel } from '../../core/admin/admin-discovery.types';

function mkRow(overrides: Partial<DiscoveredChannel> = {}): DiscoveredChannel {
  return {
    channel_id: 'UC123',
    name: 'TechLead',
    handle: 'techlead',
    bio: 'Ex-Google tech lead. Videos on software careers.',
    country: 'US',
    language: 'en',
    video_count: 210,
    thumbnail_url: 'https://example.com/a.jpg',
    subscriber_count: 1_200_000,
    avg_views: 240_000,
    engagement_rate: 20,
    sponsor_freq_pct: 4,
    uploads_playlist_id: 'UU123',
    recent_videos: [],
    found_by_query: 'tech review',
    run_id: null,
    genre: 'Tech & Gadgets',
    sub_mode: 'Reviews',
    fetched_at: '2026-07-10T00:00:00Z',
    status: 'new',
    matched_creator_id: null,
    match_type: null,
    ...overrides,
  };
}

function setup(overrides: {
  listQueue?: ReturnType<typeof vi.fn>;
  setStatus?: ReturnType<typeof vi.fn>;
  addCreators?: ReturnType<typeof vi.fn>;
} = {}) {
  const listQueue = overrides.listQueue ?? vi.fn().mockResolvedValue({ rows: [mkRow()], total: 1 });
  const setStatus = overrides.setStatus ?? vi.fn().mockResolvedValue(undefined);
  const addCreators = overrides.addCreators ?? vi.fn().mockResolvedValue({ created: [] });

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DiscoveryQueueComponent],
    providers: [
      { provide: AdminDiscoveryService, useValue: { listQueue, setStatus } },
      { provide: AdminCreatorService, useValue: { addCreators, attachPlatform: vi.fn().mockResolvedValue({ attached: {} }) } },
      {
        provide: CreatorsService,
        useValue: {
          submodesByGenre: () => ({
            Gaming: [{ subMode: 'Speedruns', hasKeywords: true }],
            'Tech & Gadgets': [{ subMode: 'Reviews', hasKeywords: true }],
          }),
          languages: () => [{ code: 'en', name: 'English' }],
        },
      },
    ],
  });
  return { listQueue, setStatus, addCreators };
}

/** Create the fixture and let the constructor's initial load() settle
 *  (zoneless: whenStable() waits out the pending promise chain). */
async function create(): Promise<ComponentFixture<DiscoveryQueueComponent>> {
  const fixture = TestBed.createComponent(DiscoveryQueueComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('DiscoveryQueueComponent — initial load', () => {
  it('loads page 0 with no filters on init', async () => {
    const { listQueue } = setup();
    await create();
    expect(listQueue).toHaveBeenCalledWith({}, 0, 50);
  });

  it('renders one row per queue entry with its status chip', async () => {
    setup({ listQueue: vi.fn().mockResolvedValue({ rows: [mkRow(), mkRow({ channel_id: 'UC2', name: 'Second', status: 'shortlisted' })], total: 2 }) });
    const fixture = await create();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="queue-row"]');
    expect(rows.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Shortlisted');
  });

  it('surfaces a load failure inline', async () => {
    setup({ listQueue: vi.fn().mockRejectedValue({ error: { error: 'query failed' } }) });
    const fixture = await create();
    expect(fixture.componentInstance.error()).toBe('query failed');
    expect(fixture.nativeElement.querySelector('[data-testid="queue-error"]')).toBeTruthy();
  });
});

describe('DiscoveryQueueComponent — filters', () => {
  it('status chip click filters by status and resets page to 0', async () => {
    const { listQueue } = setup({ listQueue: vi.fn().mockResolvedValue({ rows: [mkRow()], total: 120 }) });
    const fixture = await create();
    const c = fixture.componentInstance;

    await c.next(); // move off page 0 first
    expect(c.page()).toBe(1);

    await c.onStatusFilter('shortlisted');
    expect(c.page()).toBe(0);
    expect(listQueue).toHaveBeenLastCalledWith({ status: 'shortlisted' }, 0, 50);
  });

  it('genre filter change resets page to 0', async () => {
    const { listQueue } = setup({ listQueue: vi.fn().mockResolvedValue({ rows: [mkRow()], total: 120 }) });
    const fixture = await create();
    const c = fixture.componentInstance;

    await c.next();
    expect(c.page()).toBe(1);

    await c.onGenreFilter('Gaming');
    expect(c.page()).toBe(0);
    expect(listQueue).toHaveBeenLastCalledWith({ genre: 'Gaming' }, 0, 50);
  });

  it('"all" status filter omits the status field entirely', async () => {
    const { listQueue } = setup();
    const fixture = await create();
    await fixture.componentInstance.onStatusFilter('all');
    expect(listQueue).toHaveBeenLastCalledWith({}, 0, 50);
  });
});

describe('DiscoveryQueueComponent — pagination', () => {
  it('Prev is disabled on page 0; Next is disabled once every row has been seen', async () => {
    setup({ listQueue: vi.fn().mockResolvedValue({ rows: [mkRow()], total: 10 }) }); // 10 rows, pageSize 50 -> 1 page
    const fixture = await create();
    const prev: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="queue-prev"]');
    const next: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="queue-next"]');
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Page 1 of 1');
  });

  it('Next advances the page and re-queries with the next range', async () => {
    const { listQueue } = setup({ listQueue: vi.fn().mockResolvedValue({ rows: [mkRow()], total: 120 }) });
    const fixture = await create();
    await fixture.componentInstance.next();
    expect(listQueue).toHaveBeenLastCalledWith({}, 1, 50);
    expect(fixture.componentInstance.page()).toBe(1);
  });

  it('Prev does nothing on page 0 (no extra load)', async () => {
    const { listQueue } = setup();
    const fixture = await create();
    listQueue.mockClear();
    await fixture.componentInstance.prev();
    expect(listQueue).not.toHaveBeenCalled();
  });
});

describe('DiscoveryQueueComponent — selection', () => {
  it('toggles a channel id in and out of the selection set', async () => {
    setup();
    const fixture = await create();
    const c = fixture.componentInstance;
    expect(c.selected().has('UC123')).toBe(false);
    c.toggleSelect('UC123');
    expect(c.selected().has('UC123')).toBe(true);
    c.toggleSelect('UC123');
    expect(c.selected().has('UC123')).toBe(false);
  });

  it('the bulk bar only renders once a row is selected', async () => {
    setup();
    const fixture = await create();
    const c = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('[data-testid="queue-bulk-bar"]')).toBeNull();
    c.toggleSelect('UC123');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="queue-bulk-bar"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="queue-bulk-bar"]').textContent).toContain('1 selected');
  });

  it('a reload (filter/page change or mutation) clears the selection', async () => {
    setup();
    const fixture = await create();
    const c = fixture.componentInstance;
    c.toggleSelect('UC123');
    expect(c.selected().size).toBe(1);
    await c.onGenreFilter('Gaming');
    expect(c.selected().size).toBe(0);
  });
});

describe('DiscoveryQueueComponent — bulk actions', () => {
  it('bulk reject calls setStatus with all selected ids, reloads, and emits changed', async () => {
    const { listQueue, setStatus } = setup({
      listQueue: vi.fn().mockResolvedValue({
        rows: [mkRow({ channel_id: 'UC1' }), mkRow({ channel_id: 'UC2' }), mkRow({ channel_id: 'UC3' })],
        total: 3,
      }),
    });
    const fixture = await create();
    const c = fixture.componentInstance;
    let emitted = 0;
    c.changed.subscribe(() => emitted++);

    c.toggleSelect('UC1');
    c.toggleSelect('UC2');
    listQueue.mockClear();

    await c.bulkSetStatus('rejected');

    expect(setStatus).toHaveBeenCalledWith(['UC1', 'UC2'], 'rejected');
    expect(listQueue).toHaveBeenCalledTimes(1); // reload happened
    expect(c.selected().size).toBe(0);
    expect(emitted).toBe(1);
  });

  it('bulk shortlist calls setStatus with all selected ids', async () => {
    const { setStatus } = setup({
      listQueue: vi.fn().mockResolvedValue({ rows: [mkRow({ channel_id: 'UC1' }), mkRow({ channel_id: 'UC2' })], total: 2 }),
    });
    const fixture = await create();
    const c = fixture.componentInstance;
    c.toggleSelect('UC1');
    c.toggleSelect('UC2');
    await c.bulkSetStatus('shortlisted');
    expect(setStatus).toHaveBeenCalledWith(['UC1', 'UC2'], 'shortlisted');
  });

  it('does nothing when no rows are selected', async () => {
    const { setStatus } = setup();
    const fixture = await create();
    await fixture.componentInstance.bulkSetStatus('rejected');
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('surfaces a bulk setStatus failure inline and keeps the selection', async () => {
    const setStatus = vi.fn().mockRejectedValue({ error: { error: 'row locked' } });
    setup({ listQueue: vi.fn().mockResolvedValue({ rows: [mkRow({ channel_id: 'UC1' })], total: 1 }), setStatus });
    const fixture = await create();
    const c = fixture.componentInstance;
    c.toggleSelect('UC1');
    await c.bulkSetStatus('rejected');
    expect(c.error()).toBe('row locked');
    expect(c.selected().has('UC1')).toBe(true); // not cleared on failure
  });
});

describe('DiscoveryQueueComponent — bulk add', () => {
  it('skips rows with an empty genre: only eligible rows go in the addCreators batch, and a warning names the skipped ones', async () => {
    const rows = [
      mkRow({ channel_id: 'UC1', name: 'HasGenre', genre: 'Gaming', handle: 'hasgenre' }),
      mkRow({ channel_id: 'UC2', name: 'NoGenre', genre: '' }),
    ];
    const { addCreators } = setup({ listQueue: vi.fn().mockResolvedValue({ rows, total: 2 }) });
    const fixture = await create();
    const c = fixture.componentInstance;
    let emitted = 0;
    c.changed.subscribe(() => emitted++);

    c.toggleSelect('UC1');
    c.toggleSelect('UC2');
    await c.bulkAdd();
    fixture.detectChanges();

    expect(addCreators).toHaveBeenCalledTimes(1);
    const [batch] = addCreators.mock.calls[0];
    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({ name: 'HasGenre', genre: 'Gaming', platforms: { youtube: 'hasgenre' } });
    expect(batch[0].statsSeed).toBeTruthy();

    const warning = fixture.nativeElement.querySelector('[data-testid="queue-bulk-add-warning"]');
    expect(warning).toBeTruthy();
    expect(warning.textContent).toContain('NoGenre');
    expect(warning.textContent).not.toContain('HasGenre');
    expect(emitted).toBe(1);
  });

  it('falls back to channel_id for platforms.youtube when the row has no handle', async () => {
    const rows = [mkRow({ channel_id: 'UC9', name: 'NoHandle', genre: 'Gaming', handle: '' })];
    const { addCreators } = setup({ listQueue: vi.fn().mockResolvedValue({ rows, total: 1 }) });
    const fixture = await create();
    const c = fixture.componentInstance;
    c.toggleSelect('UC9');
    await c.bulkAdd();
    expect(addCreators.mock.calls[0][0][0].platforms.youtube).toBe('UC9');
  });

  it('when every selected row lacks a genre, addCreators is never called and a warning still shows', async () => {
    const rows = [mkRow({ channel_id: 'UC1', name: 'A', genre: '' }), mkRow({ channel_id: 'UC2', name: 'B', genre: '' })];
    const { addCreators } = setup({ listQueue: vi.fn().mockResolvedValue({ rows, total: 2 }) });
    const fixture = await create();
    const c = fixture.componentInstance;
    c.toggleSelect('UC1');
    c.toggleSelect('UC2');
    await c.bulkAdd();
    fixture.detectChanges();
    expect(addCreators).not.toHaveBeenCalled();
    const warning = fixture.nativeElement.querySelector('[data-testid="queue-bulk-add-warning"]');
    expect(warning.textContent).toContain('A');
    expect(warning.textContent).toContain('B');
  });
});

describe('DiscoveryQueueComponent — per-row actions', () => {
  it('shortlist/reject buttons show for new and shortlisted rows; clicking one calls setStatus for that row only', async () => {
    const { setStatus } = setup({
      listQueue: vi.fn().mockResolvedValue({
        rows: [mkRow({ channel_id: 'UC1', status: 'new' }), mkRow({ channel_id: 'UC2', status: 'shortlisted' })],
        total: 2,
      }),
    });
    const fixture = await create();
    const addBtns = fixture.nativeElement.querySelectorAll('[data-testid="queue-row-add"]');
    const shortlistBtns: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('[data-testid="queue-row-shortlist"]');
    expect(addBtns.length).toBe(2);
    expect(shortlistBtns.length).toBe(2);

    shortlistBtns[0].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(setStatus).toHaveBeenCalledWith(['UC1'], 'shortlisted');
  });

  it('rejected rows show a Restore button instead of shortlist/reject', async () => {
    setup({ listQueue: vi.fn().mockResolvedValue({ rows: [mkRow({ channel_id: 'UC1', status: 'rejected' })], total: 1 }) });
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('[data-testid="queue-row-restore"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="queue-row-shortlist"]')).toBeNull();
  });

  it('clicking Restore calls setStatus(new) for that row', async () => {
    const { setStatus } = setup({ listQueue: vi.fn().mockResolvedValue({ rows: [mkRow({ channel_id: 'UC1', status: 'rejected' })], total: 1 }) });
    const fixture = await create();
    const restore: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="queue-row-restore"]');
    restore.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(setStatus).toHaveBeenCalledWith(['UC1'], 'new');
  });

  it('added rows show only the status chip — no action buttons', async () => {
    setup({ listQueue: vi.fn().mockResolvedValue({ rows: [mkRow({ channel_id: 'UC1', status: 'added' })], total: 1 }) });
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('[data-testid="queue-row-add"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="queue-row-shortlist"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="queue-row-restore"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="queue-row-status"]').textContent).toContain('Added');
  });
});

describe('DiscoveryQueueComponent — drawer', () => {
  it('row click opens the drawer for that candidate', async () => {
    setup();
    const fixture = await create();
    const c = fixture.componentInstance;
    const row: HTMLElement = fixture.nativeElement.querySelector('[data-testid="queue-row"]');
    row.click();
    fixture.detectChanges();
    expect(c.drawerCandidate()?.channel_id).toBe('UC123');
    expect(fixture.nativeElement.querySelector('[data-testid="discovery-drawer"]')).toBeTruthy();
  });

  it('checkbox clicks do not open the drawer', async () => {
    setup();
    const fixture = await create();
    const c = fixture.componentInstance;
    const checkbox: HTMLElement = fixture.nativeElement.querySelector('[data-testid="queue-row-select"]');
    checkbox.click();
    fixture.detectChanges();
    expect(c.drawerCandidate()).toBeNull();
    expect(c.selected().has('UC123')).toBe(true);
  });

  it("drawer's shortlist act closes the drawer and applies the status", async () => {
    const { setStatus } = setup();
    const fixture = await create();
    const c = fixture.componentInstance;
    c.openDrawer(c.rows()[0]);
    c.onDrawerAct('shortlist');
    expect(c.drawerCandidate()).toBeNull();
    await fixture.whenStable();
    expect(setStatus).toHaveBeenCalledWith(['UC123'], 'shortlisted');
  });

  it("drawer's add act closes the drawer and opens the add dialog instead", async () => {
    setup();
    const fixture = await create();
    const c = fixture.componentInstance;
    c.openDrawer(c.rows()[0]);
    c.onDrawerAct('add');
    expect(c.drawerCandidate()).toBeNull();
    expect(c.dialogCandidate()?.channel_id).toBe('UC123');
    expect(c.dialogMode()).toBe('add');
  });
});
