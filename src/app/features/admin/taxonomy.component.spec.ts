import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaxonomyComponent } from './taxonomy.component';
import { TaxonomyService } from '../../core/admin/admin-taxonomy.service';
import { TaxonomyGenre } from '../../core/admin/admin-taxonomy.types';
import { CreatorsService } from '../../core/creators/creators.service';

function mkGenres(): TaxonomyGenre[] {
  return [
    {
      genre: 'Gaming & Esports',
      subModes: [
        { subMode: 'Survival', sortOrder: 0, phrases: ['minecraft survival'], keywords: ['survival', 'minecraft'] },
        { subMode: 'Speedruns', sortOrder: 1, phrases: [], keywords: [] },
      ],
    },
    {
      genre: 'Automotive',
      subModes: [
        { subMode: 'Car Reviews', sortOrder: 0, phrases: [], keywords: [] },
      ],
    },
  ];
}

let fixture: ComponentFixture<TaxonomyComponent>;

function setup(overrides: {
  list?: ReturnType<typeof vi.fn>;
  createSubMode?: ReturnType<typeof vi.fn>;
  setPhrases?: ReturnType<typeof vi.fn>;
  setKeywords?: ReturnType<typeof vi.fn>;
  refreshRankings?: ReturnType<typeof vi.fn>;
  rankingProgress?: ReturnType<typeof vi.fn>;
  creatorCount?: ReturnType<typeof vi.fn>;
  loadFilterOptions?: ReturnType<typeof vi.fn>;
} = {}) {
  const list = overrides.list ?? vi.fn().mockResolvedValue(mkGenres());
  const createSubMode = overrides.createSubMode ?? vi.fn().mockResolvedValue({ ok: true });
  const setPhrases = overrides.setPhrases ?? vi.fn().mockResolvedValue({ ok: true, count: 0 });
  const setKeywords = overrides.setKeywords ?? vi.fn().mockResolvedValue({ ok: true, count: 0 });
  const refreshRankings = overrides.refreshRankings ?? vi.fn().mockResolvedValue({ ok: true });
  const rankingProgress = overrides.rankingProgress ?? vi.fn().mockResolvedValue(0);
  const creatorCount = overrides.creatorCount ?? vi.fn().mockResolvedValue(0);
  const loadFilterOptions = overrides.loadFilterOptions ?? vi.fn().mockResolvedValue(undefined);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [TaxonomyComponent],
    providers: [
      {
        provide: TaxonomyService,
        useValue: { list, createSubMode, setPhrases, setKeywords, refreshRankings, rankingProgress, creatorCount },
      },
      { provide: CreatorsService, useValue: { loadFilterOptions } },
    ],
  });
  fixture = TestBed.createComponent(TaxonomyComponent);
  fixture.detectChanges();
  return fixture.componentInstance;
}

/** Waits out the constructor's loadGenres()/loadCreatorCount() fire-and-forget
 *  calls (zoneless: whenStable() waits out the pending promise chain, same
 *  helper shape as discovery-sweeps.component.spec.ts's create()). Only
 *  needed by tests that assert on genres()/totalCreators() having actually
 *  landed — the brief's four mandated tests don't depend on load timing
 *  (they either don't touch that state or overwrite it immediately). */
async function settle(): Promise<void> {
  await fixture.whenStable();
  fixture.detectChanges();
}

// Fake timers for the whole file — recompute() arms a setInterval for the
// progress poll; faking time everywhere guarantees it can't fire against a
// stale mock after a test ends (same reasoning as discovery-sweeps.component.spec.ts).
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('TaxonomyComponent — save phrases and keywords independently', () => {
  it('saves phrases and keywords independently', async () => {
    const setPhrases = vi.fn().mockResolvedValue({ ok: true, count: 2 });
    const setKeywords = vi.fn().mockResolvedValue({ ok: true, count: 3 });
    const c = setup({ setPhrases, setKeywords });
    c.selectSubMode('Gaming & Esports', 'Survival');

    c.phrasesDraft.set('minecraft survival\nrust gameplay');
    await c.savePhrases();
    expect(setPhrases).toHaveBeenCalledWith('Gaming & Esports', 'Survival', ['minecraft survival', 'rust gameplay']);
    expect(setKeywords).not.toHaveBeenCalled();

    c.keywordsDraft.set('survival\nminecraft\nvalheim');
    await c.saveKeywords();
    expect(setKeywords).toHaveBeenCalledWith('Gaming & Esports', 'Survival', ['survival', 'minecraft', 'valheim']);
  });

  it('drops blank lines and trims each entry before sending', async () => {
    const setPhrases = vi.fn().mockResolvedValue({ ok: true, count: 2 });
    const c = setup({ setPhrases });
    c.selectSubMode('Gaming & Esports', 'Survival');
    c.phrasesDraft.set('  minecraft survival  \n\n  rust gameplay\n   \n');
    await c.savePhrases();
    expect(setPhrases).toHaveBeenCalledWith('Gaming & Esports', 'Survival', ['minecraft survival', 'rust gameplay']);
  });

  it('surfaces a save failure inline', async () => {
    const setPhrases = vi.fn().mockRejectedValue({ error: { error: 'Unknown sub-genre' } });
    const c = setup({ setPhrases });
    c.selectSubMode('Gaming & Esports', 'Survival');
    c.phrasesDraft.set('rust gameplay');

    await c.savePhrases();
    fixture.detectChanges();

    expect(c.phrasesError()).toBe('Unknown sub-genre');
    const el = fixture.nativeElement.querySelector('[data-testid="taxonomy-phrases-error"]');
    expect(el.textContent).toContain('Unknown sub-genre');
  });
});

describe('TaxonomyComponent — ranking staleness', () => {
  it('shows the staleness notice only after saving keywords', async () => {
    const c = setup();
    c.selectSubMode('Gaming & Esports', 'Survival');
    expect(c.rankingsStale()).toBe(false);
    c.keywordsDraft.set('survival');
    await c.saveKeywords();
    expect(c.rankingsStale()).toBe(true);
  });

  it('clears the staleness notice once a recompute is triggered', async () => {
    const refreshRankings = vi.fn().mockResolvedValue({ ok: true });
    const c = setup({ refreshRankings });
    c.selectSubMode('Gaming & Esports', 'Survival');
    c.keywordsDraft.set('survival');
    await c.saveKeywords();
    await c.recompute();
    expect(refreshRankings).toHaveBeenCalledWith('Gaming & Esports', 'Survival');
    expect(c.rankingsStale()).toBe(false);
  });

  it('renders the stale notice and Recompute button in the DOM after a keyword save', async () => {
    const c = setup();
    c.selectSubMode('Gaming & Esports', 'Survival');
    c.keywordsDraft.set('survival');
    await c.saveKeywords();
    fixture.detectChanges();
    const notice = fixture.nativeElement.querySelector('[data-testid="taxonomy-stale-notice"]');
    expect(notice.textContent).toContain("won't change until they're recomputed");
    const btn = fixture.nativeElement.querySelector('[data-testid="taxonomy-recompute-btn"]');
    expect(btn.textContent.trim()).toBe('Recompute rankings now');
  });

  it('switching to a different sub-genre clears a stale flag left by the previous one', async () => {
    const c = setup();
    c.selectSubMode('Gaming & Esports', 'Survival');
    c.keywordsDraft.set('survival');
    await c.saveKeywords();
    expect(c.rankingsStale()).toBe(true);

    c.selectSubMode('Gaming & Esports', 'Speedruns');
    expect(c.rankingsStale()).toBe(false);
  });
});

describe('TaxonomyComponent — recompute progress polling', () => {
  it('polls rankingProgress every 5s against the total creator count, and stops once it catches up', async () => {
    const rankingProgress = vi.fn()
      .mockResolvedValueOnce(20)   // initial read right after refreshRankings
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(100); // reaches target — polling stops
    const creatorCount = vi.fn().mockResolvedValue(100);
    const c = setup({ rankingProgress, creatorCount });
    await settle(); // let totalCreators() land before recompute() reads it
    c.selectSubMode('Gaming & Esports', 'Survival');

    await c.recompute();
    expect(c.rankingProgressCount()).toBe(20);
    expect(rankingProgress).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(rankingProgress).toHaveBeenCalledTimes(2);
    expect(c.rankingProgressCount()).toBe(60);

    await vi.advanceTimersByTimeAsync(5000);
    expect(rankingProgress).toHaveBeenCalledTimes(3);
    expect(c.rankingProgressCount()).toBe(100);

    // Progress caught up to the target — no further polling.
    await vi.advanceTimersByTimeAsync(5000);
    expect(rankingProgress).toHaveBeenCalledTimes(3);
  });

  it('shows progress for an existing sub-genre where every row already exists – the freshly-recomputed count starts at 0, not the total', async () => {
    // Regression for the defect this fix addresses: an upsert overwrites rows in
    // place, so for an existing sub-genre creator_genre_scores is already at the
    // target count before a recompute even starts. Scoping rankingProgress to rows
    // recomputed since dispatch (the `since` argument) means the first read comes
    // back low even though the *total* row count was already 100 – so the bar has
    // something to animate instead of reading "done" on the very first poll.
    const rankingProgress = vi.fn()
      .mockResolvedValueOnce(0)    // nothing freshly recomputed yet, despite all 100 rows already existing
      .mockResolvedValueOnce(45)
      .mockResolvedValueOnce(100); // reaches target
    const creatorCount = vi.fn().mockResolvedValue(100);
    const c = setup({ rankingProgress, creatorCount });
    await settle();
    c.selectSubMode('Gaming & Esports', 'Survival');

    await c.recompute();
    expect(rankingProgress).toHaveBeenNthCalledWith(1, 'Gaming & Esports', 'Survival', expect.any(String));
    expect(c.rankingProgressCount()).toBe(0);
    expect(c.polling()).toBe(true); // did not read "done" on the first check

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="taxonomy-progress"]')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(5000);
    expect(rankingProgress).toHaveBeenNthCalledWith(2, 'Gaming & Esports', 'Survival', expect.any(String));
    expect(c.rankingProgressCount()).toBe(45);
    expect(c.polling()).toBe(true);

    await vi.advanceTimersByTimeAsync(5000);
    expect(c.rankingProgressCount()).toBe(100);
    expect(c.polling()).toBe(false); // caught up – polling stops
  });

  it('MAX_POLLS bounds a polling episode', async () => {
    const rankingProgress = vi.fn().mockResolvedValue(5); // never reaches the target
    const creatorCount = vi.fn().mockResolvedValue(100);
    const c = setup({ rankingProgress, creatorCount });
    await settle();
    c.selectSubMode('Gaming & Esports', 'Survival');
    await c.recompute();

    const internals = c as unknown as { pollAttempts: number; MAX_POLLS: number };
    internals.pollAttempts = internals.MAX_POLLS - 1;

    await vi.advanceTimersByTimeAsync(5000); // final tick: ceiling hit, polling stops
    const callsAtStop = rankingProgress.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(rankingProgress.mock.calls.length).toBe(callsAtStop); // interval disarmed
  });

  it('a rankingProgress failure right after a successful refresh surfaces the error and never leaves the progress bar stuck on', async () => {
    const refreshRankings = vi.fn().mockResolvedValue({ ok: true });
    const rankingProgress = vi.fn().mockRejectedValue({ error: { error: 'progress read failed' } });
    const c = setup({ refreshRankings, rankingProgress });
    c.selectSubMode('Gaming & Esports', 'Survival');

    await c.recompute();

    expect(c.recomputeError()).toBe('progress read failed');
    expect(c.polling()).toBe(false);
  });

  it('surfaces a recompute-kick failure inline and does not start polling', async () => {
    const refreshRankings = vi.fn().mockRejectedValue({ error: { error: 'refresh-creator-gfi unreachable' } });
    const rankingProgress = vi.fn();
    const c = setup({ refreshRankings, rankingProgress });
    c.selectSubMode('Gaming & Esports', 'Survival');

    await c.recompute();

    expect(c.recomputeError()).toBe('refresh-creator-gfi unreachable');
    expect(rankingProgress).not.toHaveBeenCalled();
    expect(c.polling()).toBe(false);
  });
});

describe('TaxonomyComponent — create sub-genre', () => {
  it('rejects a blank or duplicate new sub-genre name before calling the backend', async () => {
    const createSubMode = vi.fn();
    const c = setup({ createSubMode });
    c.selectGenre('Gaming & Esports');   // fixture already contains 'Survival'
    c.newSubModeName.set('   ');
    await c.createSubMode();
    expect(createSubMode).not.toHaveBeenCalled();
    c.newSubModeName.set('Survival');
    await c.createSubMode();
    expect(createSubMode).not.toHaveBeenCalled();
    expect(c.createError()).toContain('already exists');
  });

  it('duplicate rejection is case-insensitive', async () => {
    const createSubMode = vi.fn();
    const c = setup({ createSubMode });
    await settle();
    c.selectGenre('Gaming & Esports');
    c.newSubModeName.set('SURVIVAL');
    await c.createSubMode();
    expect(createSubMode).not.toHaveBeenCalled();
    expect(c.createError()).toContain('already exists');
  });

  it('a valid name shows a confirm step instead of calling the backend immediately', async () => {
    const createSubMode = vi.fn().mockResolvedValue({ ok: true });
    const c = setup({ createSubMode });
    await settle();
    c.selectGenre('Gaming & Esports');
    c.newSubModeName.set('Roguelikes');

    await c.createSubMode();

    expect(createSubMode).not.toHaveBeenCalled();
    expect(c.confirmingCreate()).toBe(true);
  });

  it('confirming creates the sub-genre, reloads, and selects it', async () => {
    const createSubMode = vi.fn().mockResolvedValue({ ok: true });
    const loadFilterOptions = vi.fn().mockResolvedValue(undefined);
    const list = vi.fn()
      .mockResolvedValueOnce(mkGenres())
      .mockResolvedValueOnce([
        ...mkGenres().filter((g) => g.genre !== 'Gaming & Esports'),
        {
          genre: 'Gaming & Esports',
          subModes: [
            ...mkGenres()[0].subModes,
            { subMode: 'Roguelikes', sortOrder: 2, phrases: [], keywords: [] },
          ],
        },
      ]);
    const c = setup({ createSubMode, list, loadFilterOptions });
    await settle();
    c.selectGenre('Gaming & Esports');
    c.newSubModeName.set('Roguelikes');
    await c.createSubMode();

    await c.confirmCreateSubMode();

    expect(createSubMode).toHaveBeenCalledWith('Gaming & Esports', 'Roguelikes');
    expect(c.confirmingCreate()).toBe(false);
    expect(c.selectedSubMode()).toBe('Roguelikes');
    expect(c.newSubModeName()).toBe('');
    // Search/Sweeps read the taxonomy off CreatorsService's cached signals –
    // without this refresh a new sub-genre needs a page reload to show up there.
    expect(loadFilterOptions).toHaveBeenCalled();
  });

  it('collapses inner double-spaces the same way the server does, so the post-create select finds the row', async () => {
    const createSubMode = vi.fn().mockResolvedValue({ ok: true });
    const list = vi.fn()
      .mockResolvedValueOnce(mkGenres())
      .mockResolvedValueOnce([
        ...mkGenres().filter((g) => g.genre !== 'Gaming & Esports'),
        {
          genre: 'Gaming & Esports',
          subModes: [
            ...mkGenres()[0].subModes,
            { subMode: 'Pack Openings', sortOrder: 2, phrases: [], keywords: [] },
          ],
        },
      ]);
    const c = setup({ createSubMode, list });
    await settle();
    c.selectGenre('Gaming & Esports');
    c.newSubModeName.set('Pack  Openings'); // double space
    await c.createSubMode();

    await c.confirmCreateSubMode();

    expect(createSubMode).toHaveBeenCalledWith('Gaming & Esports', 'Pack Openings');
    expect(c.selectedSubMode()).toBe('Pack Openings');
  });

  it('cancelling the confirm step never calls the backend', async () => {
    const createSubMode = vi.fn();
    const c = setup({ createSubMode });
    await settle();
    c.selectGenre('Gaming & Esports');
    c.newSubModeName.set('Roguelikes');
    await c.createSubMode();
    expect(c.confirmingCreate()).toBe(true);

    c.cancelCreateSubMode();

    expect(c.confirmingCreate()).toBe(false);
    expect(createSubMode).not.toHaveBeenCalled();
  });

  it('surfaces a 409 race from the backend inline', async () => {
    const createSubMode = vi.fn().mockRejectedValue({ error: { error: 'Sub-genre already exists' } });
    const c = setup({ createSubMode });
    await settle();
    c.selectGenre('Gaming & Esports');
    c.newSubModeName.set('Roguelikes');
    await c.createSubMode();

    await c.confirmCreateSubMode();

    expect(c.createError()).toBe('Sub-genre already exists');
    expect(c.confirmingCreate()).toBe(false);
  });
});

describe('TaxonomyComponent — rendering', () => {
  it('renders distinct help text for phrases (YouTube search) vs keywords (bio fit)', async () => {
    const c = setup();
    await settle(); // genres() must be loaded — the edit panel only renders once selectedSubModeData() resolves
    c.selectSubMode('Gaming & Esports', 'Survival');
    fixture.detectChanges();
    const phrasesHelp = fixture.nativeElement.querySelector('[data-testid="taxonomy-phrases-help"]').textContent;
    const keywordsHelp = fixture.nativeElement.querySelector('[data-testid="taxonomy-keywords-help"]').textContent;
    expect(phrasesHelp).toContain('YouTube');
    expect(keywordsHelp).toContain('bio');
    expect(phrasesHelp).not.toBe(keywordsHelp);
  });

  it('flags a sub-genre with no keywords as "(beta)" and not one that has keywords', async () => {
    const c = setup();
    await settle();
    c.selectGenre('Gaming & Esports');
    fixture.detectChanges();
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="taxonomy-submode-row"]'));
    expect(rows[0].textContent).toContain('Survival');
    expect(rows[0].querySelector('[data-testid="taxonomy-submode-beta"]')).toBeNull();
    expect(rows[1].textContent).toContain('Speedruns');
    expect(rows[1].querySelector('[data-testid="taxonomy-submode-beta"]')).not.toBeNull();
  });

  it('selecting a sub-genre prefills the drafts from its saved phrases/keywords', async () => {
    const c = setup();
    await settle(); // genres() must be loaded before selectSubMode looks the pair up
    c.selectSubMode('Gaming & Esports', 'Survival');
    expect(c.phrasesDraft()).toBe('minecraft survival');
    expect(c.keywordsDraft()).toBe('survival\nminecraft');
  });

  it('surfaces a list-load failure inline', async () => {
    const list = vi.fn().mockRejectedValue({ error: { error: 'taxonomy load failed' } });
    const c = setup({ list });
    await settle();
    expect(c.loadError()).toBe('taxonomy load failed');
  });
});
