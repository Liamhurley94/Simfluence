import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { DiscoverySearchComponent } from './discovery-search.component';
import { AdminDiscoveryService } from '../../core/admin/admin-discovery.service';
import { AdminCreatorService } from '../../core/admin/admin-creator.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { DiscoveredChannel, SearchResult } from '../../core/admin/admin-discovery.types';

function mkCandidate(overrides: Partial<DiscoveredChannel> = {}): DiscoveredChannel {
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

function mkResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    candidates: [mkCandidate()],
    alreadyInRoster: [{ channelId: 'UC999', name: 'Existing Creator' }],
    alreadyStaged: [mkCandidate({ channel_id: 'UC777', name: 'StagedChannel', status: 'shortlisted' })],
    unitsSpent: 103,
    ...overrides,
  };
}

function setup(overrides: { search?: ReturnType<typeof vi.fn>; setStatus?: ReturnType<typeof vi.fn> } = {}) {
  const search = overrides.search ?? vi.fn().mockResolvedValue(mkResult());
  const setStatus = overrides.setStatus ?? vi.fn().mockResolvedValue(undefined);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DiscoverySearchComponent],
    providers: [
      { provide: AdminDiscoveryService, useValue: { search, setStatus } },
      {
        provide: CreatorsService,
        useValue: {
          submodesByGenre: () => ({
            Gaming: [{ subMode: 'Speedruns', hasKeywords: true }, { subMode: "Let's Plays", hasKeywords: false }],
            'Tech & Gadgets': [{ subMode: 'Reviews', hasKeywords: true }],
          }),
          languages: () => [{ code: 'en', name: 'English' }],
        },
      },
      // Only exercised if a test opens the add/link dialog — mocked so that
      // path never needs a real HttpClient.
      {
        provide: AdminCreatorService,
        useValue: {
          addCreators: vi.fn().mockResolvedValue({ created: [] }),
          attachPlatform: vi.fn().mockResolvedValue({ attached: {} }),
        },
      },
    ],
  });
  return { search, setStatus };
}

function create() {
  const fixture = TestBed.createComponent(DiscoverySearchComponent);
  fixture.detectChanges();
  return fixture;
}

describe('DiscoverySearchComponent — controls', () => {
  it('sub-mode select is disabled until a genre is picked', () => {
    setup();
    const fixture = create();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('[data-testid="discovery-search-submode"]');
    expect(select.disabled).toBe(true);

    fixture.componentInstance.onGenre('Gaming');
    fixture.detectChanges();
    expect(select.disabled).toBe(false);
  });

  it('resets an out-of-scope sub-mode when the genre changes', () => {
    setup();
    const fixture = create();
    const c = fixture.componentInstance;
    c.onGenre('Gaming');
    c.subMode.set('Speedruns');
    c.onGenre('Tech & Gadgets');
    expect(c.subMode()).toBe('');
  });

  it('Search is disabled without free text and without a full genre+subMode pair', () => {
    setup();
    const fixture = create();
    const c = fixture.componentInstance;
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="discovery-search-submit"]');
    expect(btn.disabled).toBe(true);

    c.onGenre('Gaming');
    fixture.detectChanges();
    expect(btn.disabled).toBe(true); // genre only, no sub-mode yet

    c.subMode.set('Speedruns');
    fixture.detectChanges();
    expect(btn.disabled).toBe(false);
  });

  it('free text alone is enough to enable Search, regardless of genre/subMode', () => {
    setup();
    const fixture = create();
    const c = fixture.componentInstance;
    c.query.set('minecraft creators');
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="discovery-search-submit"]');
    expect(btn.disabled).toBe(false);
  });
});

describe('DiscoverySearchComponent — submit', () => {
  it('free text wins: calls svc.search with only {query}, ignoring a selected genre/subMode', async () => {
    const { search } = setup();
    const fixture = create();
    const c = fixture.componentInstance;
    c.onGenre('Gaming');
    c.subMode.set('Speedruns');
    c.query.set('minecraft creators');
    await c.search();
    expect(search).toHaveBeenCalledWith({ query: 'minecraft creators' });
  });

  it('no free text: calls svc.search with {genre, subMode}', async () => {
    const { search } = setup();
    const fixture = create();
    const c = fixture.componentInstance;
    c.onGenre('Gaming');
    c.subMode.set('Speedruns');
    await c.search();
    expect(search).toHaveBeenCalledWith({ genre: 'Gaming', subMode: 'Speedruns' });
  });

  it('passes minSubscribers when set and omits it when blank or invalid', async () => {
    const { search } = setup();
    const fixture = create();
    const c = fixture.componentInstance;
    c.query.set('x');

    c.onMinSubs('500000');
    await c.search();
    expect(search).toHaveBeenLastCalledWith({ query: 'x', minSubscribers: 500000 });

    c.onMinSubs('');                   // blank → omit (backend defaults 5,000)
    await c.search();
    expect(search).toHaveBeenLastCalledWith({ query: 'x', minSubscribers: undefined });

    c.onMinSubs('0');                  // 0 is falsy server-side — treat as unset
    await c.search();
    expect(search).toHaveBeenLastCalledWith({ query: 'x', minSubscribers: undefined });
  });

  it('re-syncs the min-subs box to the parsed value on blur and shows the infotip', () => {
    setup();
    const fixture = create();
    const c = fixture.componentInstance;

    const box = { value: '0' } as HTMLInputElement;
    c.onMinSubs('0');
    c.onMinSubsBlur(box);
    expect(box.value).toBe('');        // 0 → unset → box clears (placeholder shows the 5,000 default)

    box.value = '12.7';
    c.onMinSubs('12.7');
    c.onMinSubsBlur(box);
    expect(box.value).toBe('12');      // floored value shown honestly

    box.value = '500000';
    c.onMinSubs('500000');
    c.onMinSubsBlur(box);
    expect(box.value).toBe('500000');  // valid value survives blur

    const tip = fixture.nativeElement.querySelector('[data-testid="discovery-search-minsubs-tip"]') as HTMLElement;
    expect(tip?.title).toContain('5,000');
  });

  it('shows "Searching…" on the submit button while busy', async () => {
    let resolve!: (v: SearchResult) => void;
    const search = vi.fn().mockImplementation(() => new Promise((r) => { resolve = r; }));
    setup({ search });
    const fixture = create();
    const c = fixture.componentInstance;
    c.query.set('x');
    const pending = c.search();
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="discovery-search-submit"]');
    expect(btn.textContent?.trim()).toBe('Searching…');
    resolve(mkResult());
    await pending;
  });

  it('emits staged after a completed search (candidates already upserted server-side)', async () => {
    setup();
    const fixture = create();
    const c = fixture.componentInstance;
    let emitted = 0;
    c.staged.subscribe(() => emitted++);
    c.query.set('x');
    await c.search();
    expect(emitted).toBe(1);
  });

  it('ticks elapsedSec while a search is in flight and resets on the next search', async () => {
    vi.useFakeTimers();
    try {
      let resolveSearch!: (r: SearchResult) => void;
      const search = vi.fn().mockReturnValue(new Promise<SearchResult>((res) => { resolveSearch = res; }));
      setup({ search });
      const fixture = create();
      const component = fixture.componentInstance;
      component.query.set('minecraft');

      const pending = component.search();
      vi.advanceTimersByTime(3000);
      expect(component.elapsedSec()).toBe(3);

      resolveSearch({ candidates: [], alreadyInRoster: [], alreadyStaged: [], unitsSpent: 0 });
      await pending;
      vi.advanceTimersByTime(5000);
      expect(component.elapsedSec()).toBe(3);   // timer stopped at completion
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('DiscoverySearchComponent — errors', () => {
  it('renders the 404 "no preset queries" message inline instead of throwing', async () => {
    setup({ search: vi.fn().mockRejectedValue({ error: { error: 'No preset queries for this sub-mode yet — use a free-text query' } }) });
    const fixture = create();
    const c = fixture.componentInstance;
    c.onGenre('Gaming');
    c.subMode.set('Speedruns');
    await expect(c.search()).resolves.toBeUndefined();
    fixture.detectChanges();
    expect(c.error()).toBe('No preset queries for this sub-mode yet — use a free-text query');
    const el = fixture.nativeElement.querySelector('[data-testid="discovery-search-error"]');
    expect(el.textContent).toContain('No preset queries');
  });

  it('renders the 429 quota-exhausted message inline instead of throwing', async () => {
    setup({ search: vi.fn().mockRejectedValue({ error: { error: 'YouTube quota exhausted for today (used 9500/9500)' } }) });
    const fixture = create();
    const c = fixture.componentInstance;
    c.query.set('minecraft');
    await expect(c.search()).resolves.toBeUndefined();
    fixture.detectChanges();
    expect(c.error()).toBe('YouTube quota exhausted for today (used 9500/9500)');
    const el = fixture.nativeElement.querySelector('[data-testid="discovery-search-error"]');
    expect(el.textContent).toContain('YouTube quota exhausted');
  });
});

describe('DiscoverySearchComponent — summary + results table', () => {
  it('renders the summary line with skip counts from the mocked result', async () => {
    setup();
    const fixture = create();
    const c = fixture.componentInstance;
    c.query.set('minecraft');
    await c.search();
    fixture.detectChanges();
    const summary = fixture.nativeElement.querySelector('[data-testid="discovery-search-summary"]').textContent;
    expect(summary).toContain('1 new candidates');
    expect(summary).toContain('1 already in roster');
    expect(summary).toContain('1 already staged');
    expect(summary).toContain('103 units');
  });

  it('renders alreadyInRoster rows with muted "already in roster" text and no actions', async () => {
    setup();
    const fixture = create();
    const c = fixture.componentInstance;
    c.query.set('x');
    await c.search();
    fixture.detectChanges();
    const row: HTMLElement = fixture.nativeElement.querySelector('[data-testid="discovery-roster-row"]');
    expect(row.textContent).toContain('Existing Creator');
    expect(row.textContent).toContain('already in roster');
    expect(row.querySelector('button')).toBeNull();
  });

  it('shows a name-match chip when match_type is name_hint', async () => {
    setup({ search: vi.fn().mockResolvedValue(mkResult({
      candidates: [mkCandidate({ match_type: 'name_hint', matched_creator_id: 42 })],
    })) });
    const fixture = create();
    const c = fixture.componentInstance;
    c.query.set('x');
    await c.search();
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector('[data-testid="result-name-match"]');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('name match');
  });

  it('an alreadyStaged row with a non-new status renders a status chip instead of row actions', async () => {
    setup();
    const fixture = create();
    const c = fixture.componentInstance;
    c.query.set('x');
    await c.search();
    fixture.detectChanges();
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="discovery-result-row"]'));
    const stagedRow = rows.find((r) => r.textContent?.includes('StagedChannel'))!;
    expect(stagedRow).toBeTruthy();
    expect(stagedRow.querySelector('[data-testid="result-status"]')?.textContent).toContain('Shortlisted');
    expect(stagedRow.querySelector('[data-testid="result-add"]')).toBeNull();
  });

  it('an alreadyStaged row still in "new" status renders row actions, like a fresh candidate', async () => {
    setup({ search: vi.fn().mockResolvedValue(mkResult({
      alreadyStaged: [mkCandidate({ channel_id: 'UC555', name: 'StillNew', status: 'new' })],
    })) });
    const fixture = create();
    const c = fixture.componentInstance;
    c.query.set('x');
    await c.search();
    fixture.detectChanges();
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="discovery-result-row"]'));
    const stillNewRow = rows.find((r) => r.textContent?.includes('StillNew'))!;
    expect(stillNewRow.querySelector('[data-testid="result-add"]')).toBeTruthy();
    expect(stillNewRow.querySelector('[data-testid="result-status"]')).toBeNull();
  });

  it('the same channel_id in both candidates and alreadyStaged renders exactly one actionable row', async () => {
    // The merge dedups defensively even though the parallel backend's shared
    // merge already returns disjoint arrays — track keys would still collide
    // (NG0955) without it.
    setup({ search: vi.fn().mockResolvedValue(mkResult({
      candidates: [mkCandidate({ channel_id: 'UC123', name: 'DoubleReported', status: 'new' })],
      alreadyStaged: [mkCandidate({ channel_id: 'UC123', name: 'DoubleReported', status: 'shortlisted' })],
    })) });
    const fixture = create();
    const c = fixture.componentInstance;
    c.query.set('x');
    await c.search();
    fixture.detectChanges();
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="discovery-result-row"]'));
    expect(rows.length).toBe(1);
    // The candidates entry wins: row actions, not the staged status chip.
    expect(rows[0].querySelector('[data-testid="result-add"]')).toBeTruthy();
    expect(rows[0].querySelector('[data-testid="result-status"]')).toBeNull();
  });
});

describe('DiscoverySearchComponent — row actions', () => {
  it('Shortlist calls setStatus and updates the row locally without refetching', async () => {
    const { search, setStatus } = setup({ search: vi.fn().mockResolvedValue(mkResult({ alreadyStaged: [] })) });
    const fixture = create();
    const c = fixture.componentInstance;
    c.query.set('x');
    await c.search();
    fixture.detectChanges();

    const row = c.resultRows()[0];
    await c.applyStatus(row, 'shortlisted');
    fixture.detectChanges();

    expect(setStatus).toHaveBeenCalledWith(['UC123'], 'shortlisted');
    expect(search).toHaveBeenCalledTimes(1);
    expect(c.resultRows()[0].status).toBe('shortlisted');
    const chip = fixture.nativeElement.querySelector('[data-testid="result-status"]');
    expect(chip.textContent).toContain('Shortlisted');
  });

  it('Reject calls setStatus and updates the row locally', async () => {
    const { setStatus } = setup({ search: vi.fn().mockResolvedValue(mkResult({ alreadyStaged: [] })) });
    const fixture = create();
    const c = fixture.componentInstance;
    c.query.set('x');
    await c.search();
    await c.applyStatus(c.resultRows()[0], 'rejected');
    expect(setStatus).toHaveBeenCalledWith(['UC123'], 'rejected');
    expect(c.resultRows()[0].status).toBe('rejected');
  });

  it('surfaces a setStatus failure inline instead of throwing', async () => {
    const setStatus = vi.fn().mockRejectedValue({ error: { error: 'Update failed: row locked' } });
    setup({ search: vi.fn().mockResolvedValue(mkResult({ alreadyStaged: [] })), setStatus });
    const fixture = create();
    const c = fixture.componentInstance;
    c.query.set('x');
    await c.search();
    await expect(c.applyStatus(c.resultRows()[0], 'rejected')).resolves.toBeUndefined();
    expect(c.error()).toBe('Update failed: row locked');
  });

  it('Add opens the dialog in add mode with the candidate', async () => {
    const { setStatus } = setup({ search: vi.fn().mockResolvedValue(mkResult({ alreadyStaged: [] })) });
    const fixture = create();
    const c = fixture.componentInstance;
    c.query.set('x');
    await c.search();
    fixture.detectChanges();

    c.openAdd(c.resultRows()[0]);
    fixture.detectChanges();

    expect(c.dialogCandidate()?.channel_id).toBe('UC123');
    expect(c.dialogMode()).toBe('add');
    expect(c.drawerCandidate()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="discovery-add-dialog"]')).toBeTruthy();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('dialog done marks the row added locally and emits staged', async () => {
    setup({ search: vi.fn().mockResolvedValue(mkResult({ alreadyStaged: [] })) });
    const fixture = create();
    const c = fixture.componentInstance;
    c.query.set('x');
    await c.search();
    let emitted = 0;
    c.staged.subscribe(() => emitted++);

    c.openAdd(c.resultRows()[0]);
    c.onDialogDone();

    expect(c.resultRows()[0].status).toBe('added');
    expect(c.dialogCandidate()).toBeNull();
    expect(emitted).toBe(1);
  });
});

describe('DiscoverySearchComponent — drawer', () => {
  it('row click opens the drawer with that candidate', async () => {
    setup({ search: vi.fn().mockResolvedValue(mkResult({ alreadyStaged: [] })) });
    const fixture = create();
    const c = fixture.componentInstance;
    c.query.set('x');
    await c.search();
    fixture.detectChanges();

    const row: HTMLElement = fixture.nativeElement.querySelector('[data-testid="discovery-result-row"]');
    row.click();
    fixture.detectChanges();

    expect(c.drawerCandidate()?.channel_id).toBe('UC123');
    expect(fixture.nativeElement.querySelector('[data-testid="discovery-drawer"]')).toBeTruthy();
  });

  it("drawer's shortlist/reject acts delegate to applyStatus and keep the drawer open", () => {
    setup({ search: vi.fn().mockResolvedValue(mkResult({ alreadyStaged: [] })) });
    const fixture = create();
    const c = fixture.componentInstance;
    const candidate = mkCandidate();
    c.openDrawer(candidate);
    const spy = vi.spyOn(c, 'applyStatus').mockResolvedValue(undefined);

    c.onDrawerAct('shortlist');
    expect(spy).toHaveBeenCalledWith(candidate, 'shortlisted');
    expect(c.drawerCandidate()).not.toBeNull();

    c.onDrawerAct('reject');
    expect(spy).toHaveBeenCalledWith(candidate, 'rejected');
    expect(c.drawerCandidate()).not.toBeNull();
  });

  it("drawer's add act closes the drawer and opens the dialog in 'add' mode", () => {
    setup();
    const fixture = create();
    const c = fixture.componentInstance;
    const candidate = mkCandidate();
    c.openDrawer(candidate);

    c.onDrawerAct('add');

    expect(c.drawerCandidate()).toBeNull();
    expect(c.dialogCandidate()?.channel_id).toBe(candidate.channel_id);
    expect(c.dialogMode()).toBe('add');
  });

  it("drawer's link act closes the drawer and opens the dialog in 'link' mode", () => {
    setup();
    const fixture = create();
    const c = fixture.componentInstance;
    const candidate = mkCandidate({ matched_creator_id: 42, match_type: 'exact' });
    c.openDrawer(candidate);

    c.onDrawerAct('link');

    expect(c.drawerCandidate()).toBeNull();
    expect(c.dialogCandidate()?.channel_id).toBe(candidate.channel_id);
    expect(c.dialogMode()).toBe('link');
  });
});

describe('DiscoverySearchComponent country/language filters', () => {
  it('passes country and language through to the search call', async () => {
    const search = vi.fn().mockResolvedValue(mkResult());
    setup({ search });
    const c = TestBed.createComponent(DiscoverySearchComponent).componentInstance;
    c.query.set('gameplay ao vivo');
    c.country.set('BR');
    c.language.set('pt');
    await c.search();
    expect(search).toHaveBeenCalledWith({ query: 'gameplay ao vivo', minSubscribers: undefined, country: 'BR', language: 'pt' });
  });

  it('omits country and language when left on Any', async () => {
    const search = vi.fn().mockResolvedValue(mkResult());
    setup({ search });
    const c = TestBed.createComponent(DiscoverySearchComponent).componentInstance;
    c.query.set('gameplay');
    await c.search();
    expect(search).toHaveBeenCalledWith({ query: 'gameplay', minSubscribers: undefined, country: undefined, language: undefined });
  });
});
