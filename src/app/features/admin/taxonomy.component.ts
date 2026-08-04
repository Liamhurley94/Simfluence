import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { SpinnerComponent } from '../../shared/spinner/spinner.component';
import { TaxonomyService } from '../../core/admin/admin-taxonomy.service';
import { TaxonomyGenre, TaxonomySubMode } from '../../core/admin/admin-taxonomy.types';
import { edgeErrorMessage } from '../../core/api/edge-error';
import { CreatorsService } from '../../core/creators/creators.service';

const LABEL = 'text-[10px] uppercase tracking-wider mb-1 block';

const PHRASES_HELP = 'What we ask YouTube, to find these creators. Full phrases work best, e.g. "elden ring gameplay".';
const KEYWORDS_HELP = 'Words we look for in a creator\'s bio, to judge how well they fit. Short works best, e.g. "rpg", "baldur".';
const STALE_NOTICE = 'Saved. Rankings for this sub-genre won\'t change until they\'re recomputed.';

/** One entry per line — trim only. Case, dedup and dropping fully-blank
 *  entries happen server-side (admin-manage-taxonomy normalises both lists),
 *  this just keeps stray blank lines out of the on-screen count. */
function parseLines(raw: string): string[] {
  return raw.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
}

/**
 * Taxonomy sub-view of the Add-creators tab (D9). Lets the owner create
 * sub-genres under an existing genre and author the two lists discovery
 * depends on: search phrases (sent to YouTube to *find* creators) and
 * ranking keywords (matched against a bio to *judge* fit). The two are
 * edited, saved and staled independently — never merge them (see
 * admin-taxonomy.types.ts).
 *
 * Genres are not created here (see the design doc's "Out, deliberately"
 * section) — only sub-genres under a genre the backend already knows.
 */
@Component({
  selector: 'app-taxonomy',
  standalone: true,
  imports: [SpinnerComponent],
  template: `
    <div data-testid="taxonomy" class="flex flex-col gap-4">
      @if (!loaded() && loading()) {
        <div class="sf-card p-4" data-testid="taxonomy-loading"><app-spinner label="Loading taxonomy…" /></div>
      } @else {
        @if (loadError()) {
          <p class="text-sm" style="color: var(--color-sf-red);" data-testid="taxonomy-load-error">{{ loadError() }}</p>
        }

        <div class="sf-card p-4 flex flex-col gap-2">
          <label class="${LABEL}" style="color: var(--color-text-muted);">Genre</label>
          <select
            [value]="selectedGenre()"
            (change)="selectGenre($any($event.target).value)"
            class="sf-select"
            style="max-width: 320px;"
            data-testid="taxonomy-genre-select"
          >
            <option value="" disabled>Select a genre…</option>
            @for (g of genreOptions(); track g) {
              <option [value]="g">{{ g }}</option>
            }
          </select>
        </div>

        @if (selectedGenre()) {
          <div class="sf-card overflow-hidden" data-testid="taxonomy-submode-list">
            <table class="w-full text-sm">
              <thead>
                <tr style="color: var(--color-text-muted); background: var(--color-bg-3);">
                  <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider font-medium">Sub-genre</th>
                  <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider font-medium">Phrases</th>
                  <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider font-medium">Keywords</th>
                </tr>
              </thead>
              <tbody>
                @for (sm of subModesForSelectedGenre(); track sm.subMode) {
                  <tr
                    (click)="selectSubMode(selectedGenre(), sm.subMode)"
                    class="cursor-pointer"
                    [style.background]="sm.subMode === selectedSubMode() ? 'var(--color-bg-3)' : 'transparent'"
                    style="color: var(--color-text); border-top: 1px solid var(--color-border);"
                    data-testid="taxonomy-submode-row"
                  >
                    <td class="px-3 py-2 font-medium">
                      {{ sm.subMode }}
                      @if (sm.keywords.length === 0) {
                        <span class="text-xs ml-1" style="color: var(--color-text-muted);" data-testid="taxonomy-submode-beta">(beta)</span>
                      }
                    </td>
                    <td class="px-3 py-2">{{ sm.phrases.length }}</td>
                    <td class="px-3 py-2">{{ sm.keywords.length }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="sf-card p-4 flex flex-col gap-2">
            <label class="${LABEL}" style="color: var(--color-text-muted);">New sub-genre</label>
            <div class="flex flex-wrap items-start gap-2">
              <input
                type="text"
                [value]="newSubModeName()"
                (input)="newSubModeName.set($any($event.target).value)"
                placeholder="e.g. Survival"
                class="sf-input"
                style="max-width: 240px;"
                data-testid="taxonomy-new-submode-input"
              />
              <button
                type="button"
                (click)="createSubMode()"
                class="sf-btn sf-btn-ghost text-xs"
                data-testid="taxonomy-new-submode-create"
              >Create</button>
            </div>
            <p class="text-xs" style="color: var(--color-text-muted);">
              The name can't be changed once created.
            </p>
            @if (createError()) {
              <p class="text-sm" style="color: var(--color-sf-red);" data-testid="taxonomy-new-submode-error">{{ createError() }}</p>
            }
            @if (confirmingCreate()) {
              <div class="sf-card p-3 flex flex-col gap-2" style="background: var(--color-bg-3);" data-testid="taxonomy-create-confirm">
                <p class="text-sm" style="color: var(--color-text);">
                  Create "{{ newSubModeName().trim() }}" under {{ selectedGenre() }}? This name cannot be changed later.
                </p>
                <div class="flex gap-2">
                  <button type="button" (click)="confirmCreateSubMode()" [disabled]="creating()" class="sf-btn sf-btn-primary text-xs" data-testid="taxonomy-create-confirm-yes">
                    {{ creating() ? 'Creating…' : 'Yes, create' }}
                  </button>
                  <button type="button" (click)="cancelCreateSubMode()" [disabled]="creating()" class="sf-btn sf-btn-ghost text-xs" data-testid="taxonomy-create-confirm-cancel">Cancel</button>
                </div>
              </div>
            }
          </div>
        }

        @if (selectedSubModeData(); as sm) {
          <div class="sf-card p-4 flex flex-col gap-4">
            <h3 class="text-sm font-bold uppercase tracking-wider" style="color: var(--color-text);">
              {{ selectedGenre() }} · {{ sm.subMode }}
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1">
                <label class="${LABEL}" style="color: var(--color-text-muted);">Search phrases</label>
                <p class="text-xs" style="color: var(--color-text-muted);" data-testid="taxonomy-phrases-help">{{ phrasesHelp }}</p>
                <textarea
                  [value]="phrasesDraft()"
                  (input)="phrasesDraft.set($any($event.target).value)"
                  rows="8"
                  class="sf-input"
                  style="font-family: monospace;"
                  data-testid="taxonomy-phrases-textarea"
                ></textarea>
                <button
                  type="button"
                  (click)="savePhrases()"
                  [disabled]="savingPhrases()"
                  class="sf-btn sf-btn-primary text-xs self-start"
                  data-testid="taxonomy-phrases-save"
                >{{ savingPhrases() ? 'Saving…' : 'Save phrases' }}</button>
                @if (phrasesError()) {
                  <p class="text-sm" style="color: var(--color-sf-red);" data-testid="taxonomy-phrases-error">{{ phrasesError() }}</p>
                }
              </div>

              <div class="flex flex-col gap-1">
                <label class="${LABEL}" style="color: var(--color-text-muted);">Ranking keywords</label>
                <p class="text-xs" style="color: var(--color-text-muted);" data-testid="taxonomy-keywords-help">{{ keywordsHelp }}</p>
                <textarea
                  [value]="keywordsDraft()"
                  (input)="keywordsDraft.set($any($event.target).value)"
                  rows="8"
                  class="sf-input"
                  style="font-family: monospace;"
                  data-testid="taxonomy-keywords-textarea"
                ></textarea>
                <button
                  type="button"
                  (click)="saveKeywords()"
                  [disabled]="savingKeywords()"
                  class="sf-btn sf-btn-primary text-xs self-start"
                  data-testid="taxonomy-keywords-save"
                >{{ savingKeywords() ? 'Saving…' : 'Save keywords' }}</button>
                @if (keywordsError()) {
                  <p class="text-sm" style="color: var(--color-sf-red);" data-testid="taxonomy-keywords-error">{{ keywordsError() }}</p>
                }
              </div>
            </div>

            @if (rankingsStale()) {
              <div class="flex flex-wrap items-center gap-3" data-testid="taxonomy-stale-notice">
                <p class="text-sm" style="color: var(--color-sf-gold);">{{ staleNotice }}</p>
                <button
                  type="button"
                  (click)="recompute()"
                  [disabled]="recomputing()"
                  class="sf-btn sf-btn-primary text-xs"
                  data-testid="taxonomy-recompute-btn"
                >{{ recomputing() ? 'Starting…' : 'Recompute rankings now' }}</button>
              </div>
            }
            @if (recomputeError()) {
              <p class="text-sm" style="color: var(--color-sf-red);" data-testid="taxonomy-recompute-error">{{ recomputeError() }}</p>
            }
            @if (polling()) {
              <div data-testid="taxonomy-progress">
                <div class="text-xs mb-1" style="color: var(--color-text-muted);" data-testid="taxonomy-progress-text">
                  {{ rankingProgressCount() }}/{{ totalCreators() }} creators re-ranked
                </div>
                <div class="h-1.5 rounded-sm overflow-hidden" style="background: var(--color-bg-3);">
                  <div class="h-full" style="background: var(--color-sf-blue);" [style.width.%]="progressPct()" data-testid="taxonomy-progress-bar"></div>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class TaxonomyComponent {
  private svc = inject(TaxonomyService);
  private creatorsSvc = inject(CreatorsService);

  protected readonly phrasesHelp = PHRASES_HELP;
  protected readonly keywordsHelp = KEYWORDS_HELP;
  protected readonly staleNotice = STALE_NOTICE;

  readonly genres = signal<TaxonomyGenre[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly totalCreators = signal(0);

  readonly selectedGenre = signal('');
  readonly selectedSubMode = signal('');

  readonly phrasesDraft = signal('');
  readonly keywordsDraft = signal('');
  readonly savingPhrases = signal(false);
  readonly savingKeywords = signal(false);
  readonly phrasesError = signal<string | null>(null);
  readonly keywordsError = signal<string | null>(null);

  readonly rankingsStale = signal(false);
  readonly recomputing = signal(false);
  readonly recomputeError = signal<string | null>(null);
  readonly rankingProgressCount = signal(0);
  readonly polling = signal(false);
  // Set right before dispatch – rankingProgress counts rows recomputed at/after
  // this instant, since an upsert overwrites in place and an existing sub-genre's
  // row count is already at target before the recompute even starts.
  private readonly recomputeSince = signal('');

  readonly newSubModeName = signal('');
  readonly createError = signal<string | null>(null);
  readonly confirmingCreate = signal(false);
  readonly creating = signal(false);

  protected readonly genreOptions = computed(() => this.genres().map((g) => g.genre));
  protected readonly subModesForSelectedGenre = computed<TaxonomySubMode[]>(() => {
    const genre = this.genres().find((g) => g.genre === this.selectedGenre());
    return genre?.subModes ?? [];
  });
  protected readonly selectedSubModeData = computed<TaxonomySubMode | null>(() =>
    this.subModesForSelectedGenre().find((sm) => sm.subMode === this.selectedSubMode()) ?? null);
  protected readonly progressPct = computed(() => {
    const target = this.totalCreators();
    return target > 0 ? Math.min(100, (this.rankingProgressCount() / target) * 100) : 0;
  });

  // Bounded polling — same shape as discovery-sweeps.component.ts.
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private pollAttempts = 0;
  private readonly POLL_MS = 5000;
  private readonly MAX_POLLS = 120; // ~10 min ceiling per polling episode

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
    void this.loadGenres();
    void this.loadCreatorCount();
  }

  async loadGenres(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.genres.set(await this.svc.list());
    } catch (err) {
      this.loadError.set(edgeErrorMessage(err, 'Failed to load taxonomy'));
    } finally {
      this.loading.set(false);
      this.loaded.set(true);
    }
  }

  private async loadCreatorCount(): Promise<void> {
    try {
      this.totalCreators.set(await this.svc.creatorCount());
    } catch {
      // Cosmetic — the progress bar's denominator just stays 0 (bar reads
      // 0% instead of a real percentage) until the next load; never blocks the screen.
    }
  }

  selectGenre(genre: string): void {
    this.selectedGenre.set(genre);
    this.selectedSubMode.set('');
    this.resetEditState();
    this.newSubModeName.set('');
    this.createError.set(null);
    this.confirmingCreate.set(false);
  }

  selectSubMode(genre: string, subMode: string): void {
    this.selectedGenre.set(genre);
    this.selectedSubMode.set(subMode);
    const sm = this.genres().find((g) => g.genre === genre)?.subModes.find((s) => s.subMode === subMode);
    this.phrasesDraft.set((sm?.phrases ?? []).join('\n'));
    this.keywordsDraft.set((sm?.keywords ?? []).join('\n'));
    this.resetEditState();
  }

  private resetEditState(): void {
    this.phrasesError.set(null);
    this.keywordsError.set(null);
    this.rankingsStale.set(false);
    this.recomputeError.set(null);
    this.rankingProgressCount.set(0);
    this.stopPolling();
  }

  async savePhrases(): Promise<void> {
    const genre = this.selectedGenre();
    const subMode = this.selectedSubMode();
    if (!genre || !subMode) return;
    const phrases = parseLines(this.phrasesDraft());
    this.savingPhrases.set(true);
    this.phrasesError.set(null);
    try {
      await this.svc.setPhrases(genre, subMode, phrases);
      this.patchSubMode(genre, subMode, { phrases });
    } catch (err) {
      this.phrasesError.set(edgeErrorMessage(err, 'Failed to save phrases'));
    } finally {
      this.savingPhrases.set(false);
    }
  }

  async saveKeywords(): Promise<void> {
    const genre = this.selectedGenre();
    const subMode = this.selectedSubMode();
    if (!genre || !subMode) return;
    const keywords = parseLines(this.keywordsDraft());
    this.savingKeywords.set(true);
    this.keywordsError.set(null);
    try {
      await this.svc.setKeywords(genre, subMode, keywords);
      this.patchSubMode(genre, subMode, { keywords });
      this.rankingsStale.set(true);
    } catch (err) {
      this.keywordsError.set(edgeErrorMessage(err, 'Failed to save keywords'));
    } finally {
      this.savingKeywords.set(false);
    }
  }

  /** Local cache patch so counts/badges update immediately without a round
   *  trip back through `list` — the edge fn's write already succeeded. */
  private patchSubMode(genre: string, subMode: string, patch: Partial<TaxonomySubMode>): void {
    this.genres.set(this.genres().map((g) => {
      if (g.genre !== genre) return g;
      return { ...g, subModes: g.subModes.map((sm) => (sm.subMode === subMode ? { ...sm, ...patch } : sm)) };
    }));
  }

  async recompute(): Promise<void> {
    const genre = this.selectedGenre();
    const subMode = this.selectedSubMode();
    if (!genre || !subMode) return;
    this.recomputing.set(true);
    this.recomputeError.set(null);
    // Captured before dispatch, not after – rows the run touches must land
    // at/after this instant, and the run can start before refreshRankings' own
    // await resolves.
    const since = new Date().toISOString();
    this.recomputeSince.set(since);
    try {
      await this.svc.refreshRankings(genre, subMode);
      this.rankingsStale.set(false);
      // Only flip polling() on once the first reading actually lands — if
      // rankingProgress throws here, the catch below must not leave a
      // progress bar frozen on screen alongside the error message.
      this.rankingProgressCount.set(await this.svc.rankingProgress(genre, subMode, since));
      this.polling.set(true);
      this.syncPolling(genre, subMode);
    } catch (err) {
      this.recomputeError.set(edgeErrorMessage(err, 'Failed to trigger recompute'));
      this.polling.set(false);
    } finally {
      this.recomputing.set(false);
    }
  }

  private syncPolling(genre: string, subMode: string): void {
    const done = this.rankingProgressCount() >= this.totalCreators();
    if (!done && this.pollAttempts < this.MAX_POLLS) {
      this.pollHandle ??= setInterval(() => {
        this.pollAttempts++;
        void this.pollTick(genre, subMode);
      }, this.POLL_MS);
    } else {
      this.stopPolling();
    }
  }

  private async pollTick(genre: string, subMode: string): Promise<void> {
    try {
      this.rankingProgressCount.set(await this.svc.rankingProgress(genre, subMode, this.recomputeSince()));
    } catch {
      // Transient PostgREST hiccup — leave the interval running, next tick retries.
    }
    this.syncPolling(genre, subMode);
  }

  private stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    // Reset so MAX_POLLS bounds each polling episode, not the component's
    // lifetime (same reasoning as discovery-sweeps.component.ts).
    this.pollAttempts = 0;
    this.polling.set(false);
  }

  async createSubMode(): Promise<void> {
    this.createError.set(null);
    const genre = this.selectedGenre();
    if (!genre) {
      this.createError.set('Pick a genre first.');
      return;
    }
    const name = this.newSubModeName().trim();
    if (!name) {
      this.createError.set('Enter a name for the new sub-genre.');
      return;
    }
    const dup = this.subModesForSelectedGenre().some((sm) => sm.subMode.toLowerCase() === name.toLowerCase());
    if (dup) {
      this.createError.set(`"${name}" already exists in ${genre}.`);
      return;
    }
    this.confirmingCreate.set(true);
  }

  cancelCreateSubMode(): void {
    this.confirmingCreate.set(false);
  }

  async confirmCreateSubMode(): Promise<void> {
    const genre = this.selectedGenre();
    // Collapse inner whitespace the same way the server's normaliseName does –
    // otherwise "Pack  Openings" (double space) creates "Pack Openings" and the
    // select below, keyed on the untouched name, finds nothing.
    const name = this.newSubModeName().trim().replace(/\s+/g, ' ');
    if (!genre || !name) return;
    this.creating.set(true);
    this.createError.set(null);
    try {
      await this.svc.createSubMode(genre, name);
      this.newSubModeName.set('');
      this.confirmingCreate.set(false);
      await this.loadGenres();
      this.selectSubMode(genre, name);
      // Other screens (Search, Sweeps) read the taxonomy off CreatorsService's
      // cached signals, loaded once at boot – without this refresh the new
      // sub-genre only shows up there after a full page reload.
      await this.creatorsSvc.loadFilterOptions();
    } catch (err) {
      this.createError.set(edgeErrorMessage(err, 'Failed to create sub-genre'));
      this.confirmingCreate.set(false);
    } finally {
      this.creating.set(false);
    }
  }
}
