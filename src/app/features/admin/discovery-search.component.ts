import { Component, DestroyRef, computed, inject, signal, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AdminDiscoveryService } from '../../core/admin/admin-discovery.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { CandidateStatus, DiscoveredChannel, SearchResult } from '../../core/admin/admin-discovery.types';
import { DiscoveryDrawerComponent } from './discovery-drawer.component';
import { DiscoveryAddDialogComponent } from './discovery-add-dialog.component';
import { edgeErrorMessage } from '../../core/api/edge-error';

const TH = 'text-left px-3 py-2 text-[10px] uppercase tracking-wider font-medium';
const LABEL = 'text-[10px] uppercase tracking-wider mb-1 block';

type RosterRow = SearchResult['alreadyInRoster'][number];

// 'new' is never actually rendered (rows in that state show row actions
// instead of a chip) — included so the maps stay total functions.
const STATUS_LABEL: Record<CandidateStatus, string> = {
  new: 'New', shortlisted: 'Shortlisted', rejected: 'Rejected', added: 'Added',
};
const STATUS_FG: Record<CandidateStatus, string> = {
  new: 'var(--color-text-muted)', shortlisted: 'var(--color-sf-gold)',
  rejected: 'var(--color-sf-red)', added: 'var(--color-sf-green)',
};
const STATUS_BG: Record<CandidateStatus, string> = {
  new: 'transparent',
  shortlisted: 'color-mix(in srgb, var(--color-sf-gold) 15%, transparent)',
  rejected: 'color-mix(in srgb, var(--color-sf-red) 15%, transparent)',
  added: 'color-mix(in srgb, var(--color-sf-green) 15%, transparent)',
};

/**
 * Search sub-view of the Add-creators tab. Genre+sub-mode drives the
 * preset query bank; a free-text query bypasses it entirely and wins when
 * present (backend: admin-discover-creators mode 'search'). Candidates are
 * upserted into discovered_channels server-side on every search, so `staged`
 * fires after any completed search (not just after Add) — the shell's queue
 * badge count can only go up, never down, from this view.
 *
 * The results table merges three shapes from `SearchResult`: fresh
 * candidates and already-staged channels are both full `DiscoveredChannel`
 * rows and render identically — a still-'new' staged row is exactly as
 * actionable as a fresh one, so they share one array (`resultRows`) keyed
 * only off `status`. `alreadyInRoster` rows carry no stats (zero-quota dedup
 * lookup), so they get their own no-action row shape.
 */
@Component({
  selector: 'app-discovery-search',
  standalone: true,
  imports: [DecimalPipe, DiscoveryDrawerComponent, DiscoveryAddDialogComponent],
  template: `
    <div data-testid="discovery-search" class="flex flex-col gap-4">
      <div class="sf-card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label class="${LABEL}" style="color: var(--color-text-muted);">Genre</label>
          <select
            [value]="genre()"
            (change)="onGenre($any($event.target).value)"
            class="sf-select"
            style="min-width: 170px;"
            data-testid="discovery-search-genre"
          >
            <option value="">Select a genre…</option>
            @for (g of genreOptions(); track g) {
              <option [value]="g">{{ g }}</option>
            }
          </select>
        </div>
        <div>
          <label class="${LABEL}" style="color: var(--color-text-muted);">Sub-mode</label>
          <select
            [value]="subMode()"
            (change)="subMode.set($any($event.target).value)"
            [disabled]="!genre()"
            class="sf-select"
            style="min-width: 170px;"
            data-testid="discovery-search-submode"
          >
            <option value="">Select a sub-mode…</option>
            @for (sm of subModeOptions(); track sm.subMode) {
              <option [value]="sm.subMode">{{ sm.subMode }}{{ sm.hasKeywords ? '' : ' (beta)' }}</option>
            }
          </select>
        </div>
        <div class="flex-1" style="min-width: 220px;">
          <label class="${LABEL}" style="color: var(--color-text-muted);">Free-text query</label>
          <input
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            placeholder="…or free-text query"
            class="sf-input"
            data-testid="discovery-search-query"
          />
        </div>
        <div>
          <label class="${LABEL}" style="color: var(--color-text-muted);">Min subs <span class="cursor-help" title="Subscriber floor for new results. Blank = default 5,000. Minimum 1 — there's no 'no floor' setting." data-testid="discovery-search-minsubs-tip">ⓘ</span></label>
          <input
            type="number"
            min="1"
            [value]="minSubs() ?? ''"
            (input)="onMinSubs($any($event.target).value)"
            (blur)="onMinSubsBlur($any($event.target))"
            placeholder="5,000"
            class="sf-input"
            style="width: 110px;"
            data-testid="discovery-search-minsubs"
          />
        </div>
        <button
          type="button"
          (click)="search()"
          [disabled]="busy() || !canSearch()"
          class="sf-btn sf-btn-primary text-xs"
          data-testid="discovery-search-submit"
        >{{ busy() ? 'Searching…' : 'Search' }}</button>
      </div>

      @if (busy()) {
        <p class="text-xs" style="color: var(--color-text-muted);" data-testid="discovery-search-elapsed">
          Searching YouTube live — {{ elapsedSec() }}s elapsed. Multi-query genre searches usually take a few seconds.
        </p>
      }

      @if (error()) {
        <p class="text-sm" style="color: var(--color-sf-red);" data-testid="discovery-search-error">{{ error() }}</p>
      }

      @if (lastResult(); as r) {
        <p class="text-xs" style="color: var(--color-text-muted);" data-testid="discovery-search-summary">
          {{ r.candidates.length }} new candidates · {{ r.alreadyInRoster.length }} already in roster · {{ r.alreadyStaged.length }} already staged · {{ r.unitsSpent }} units
        </p>

        @if (resultRows().length > 0 || rosterRows().length > 0) {
          <div class="sf-card overflow-hidden" data-testid="discovery-results">
            <table class="w-full text-sm">
              <thead>
                <tr style="color: var(--color-text-muted); background: var(--color-bg-3);">
                  <th class="${TH}">Name</th>
                  <th class="${TH}">Handle</th>
                  <th class="${TH}">Subs</th>
                  <th class="${TH}">Avg views</th>
                  <th class="${TH}">Eng %</th>
                  <th class="${TH}">Sponsored %</th>
                  <th class="${TH}">Language</th>
                  <th class="${TH}"></th>
                </tr>
              </thead>
              <tbody>
                @for (row of resultRows(); track row.channel_id) {
                  <tr
                    (click)="openDrawer(row)"
                    class="cursor-pointer"
                    [style.color]="row.status === 'new' ? 'var(--color-text)' : 'var(--color-text-muted)'"
                    style="border-top: 1px solid var(--color-border);"
                    data-testid="discovery-result-row"
                  >
                    <td class="px-3 py-2 font-medium">
                      @if (row.status === 'new') { ✚ }
                      {{ row.name }}
                      @if (row.match_type === 'name_hint') {
                        <span
                          class="sf-chip ml-1"
                          style="background: color-mix(in srgb, var(--color-sf-gold) 15%, transparent); color: var(--color-sf-gold);"
                          data-testid="result-name-match"
                        >⚭ name match</span>
                      }
                    </td>
                    <td class="px-3 py-2">{{ row.handle ? '@' + row.handle : '—' }}</td>
                    <td class="px-3 py-2">{{ row.subscriber_count | number }}</td>
                    <td class="px-3 py-2">{{ row.avg_views | number }}</td>
                    <td class="px-3 py-2">{{ row.engagement_rate | number:'1.0-1' }}%</td>
                    <td class="px-3 py-2">{{ row.sponsor_freq_pct | number:'1.0-0' }}%</td>
                    <td class="px-3 py-2">{{ row.language || '—' }}</td>
                    <td class="px-3 py-2 text-right" (click)="$event.stopPropagation()">
                      @if (row.status === 'new') {
                        <div class="flex justify-end gap-1">
                          <button type="button" (click)="openAdd(row)" class="sf-btn sf-btn-primary text-xs" data-testid="result-add">✚ Add</button>
                          <button type="button" (click)="applyStatus(row, 'shortlisted')" class="sf-btn sf-btn-ghost text-xs" data-testid="result-shortlist">☆ Shortlist</button>
                          <button type="button" (click)="applyStatus(row, 'rejected')" class="sf-btn sf-btn-ghost text-xs" data-testid="result-reject">✕ Reject</button>
                        </div>
                      } @else {
                        <span class="sf-chip" [style.background]="statusBg(row.status)" [style.color]="statusFg(row.status)" data-testid="result-status">{{ statusLabel(row.status) }}</span>
                      }
                    </td>
                  </tr>
                }
                @for (rr of rosterRows(); track rr.channelId) {
                  <tr style="border-top: 1px solid var(--color-border); color: var(--color-text);" data-testid="discovery-roster-row">
                    <td class="px-3 py-2 font-medium">{{ rr.name }}</td>
                    <td class="px-3 py-2 text-xs" style="color: var(--color-text-muted);" colspan="7">✓ already in roster</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="text-sm" style="color: var(--color-text-muted);">No candidates found for this query.</p>
        }
      }
    </div>

    @if (drawerCandidate(); as c) {
      <app-discovery-drawer [candidate]="c" (closed)="drawerCandidate.set(null)" (act)="onDrawerAct($event)" />
    }
    @if (dialogCandidate(); as c) {
      <app-discovery-add-dialog [candidate]="c" [mode]="dialogMode()" (done)="onDialogDone()" (cancelled)="dialogCandidate.set(null)" />
    }
  `,
})
export class DiscoverySearchComponent {
  private svc = inject(AdminDiscoveryService);
  private creators = inject(CreatorsService);

  readonly staged = output<void>();

  protected readonly genreOptions = computed(() => Object.keys(this.creators.submodesByGenre()).sort());
  protected readonly subModeOptions = computed(() => {
    const g = this.genre();
    return g ? (this.creators.submodesByGenre()[g] ?? []) : [];
  });

  readonly genre = signal('');
  readonly subMode = signal('');
  readonly query = signal('');
  readonly minSubs = signal<number | null>(null);
  protected readonly canSearch = computed(() => !!this.query().trim() || (!!this.genre() && !!this.subMode()));

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  // Last completed search, for the summary line — a static snapshot, never
  // mutated by row actions (only resultRows/rosterRows are).
  readonly lastResult = signal<SearchResult | null>(null);
  readonly resultRows = signal<DiscoveredChannel[]>([]);
  readonly rosterRows = signal<RosterRow[]>([]);

  readonly drawerCandidate = signal<DiscoveredChannel | null>(null);
  readonly dialogCandidate = signal<DiscoveredChannel | null>(null);
  readonly dialogMode = signal<'add' | 'link'>('add');

  readonly elapsedSec = signal(0);
  private elapsedHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopElapsed());
  }

  private startElapsed(): void {
    this.stopElapsed();
    this.elapsedSec.set(0);
    this.elapsedHandle = setInterval(() => this.elapsedSec.update((s) => s + 1), 1000);
  }

  private stopElapsed(): void {
    if (this.elapsedHandle) {
      clearInterval(this.elapsedHandle);
      this.elapsedHandle = null;
    }
  }

  onGenre(g: string): void {
    this.genre.set(g);
    const valid = g ? (this.creators.submodesByGenre()[g] ?? []).some((s) => s.subMode === this.subMode()) : false;
    if (!valid) this.subMode.set('');
  }

  onMinSubs(raw: string): void {
    const n = Math.floor(Number(raw));
    this.minSubs.set(Number.isFinite(n) && n >= 1 ? n : null);
  }

  /** Blur re-sync: whatever survives in the box is what applies. Invalid
   *  input (0, negatives, junk) parses to null, so the box clears to blank
   *  and the placeholder shows the effective 5,000 default. */
  onMinSubsBlur(input: HTMLInputElement): void {
    input.value = this.minSubs()?.toString() ?? '';
  }

  async search(): Promise<void> {
    if (this.busy() || !this.canSearch()) return;
    this.busy.set(true);
    this.startElapsed();
    this.error.set(null);
    try {
      const q = this.query().trim();
      const minSubscribers = this.minSubs() ?? undefined;
      const result = q
        ? await this.svc.search({ query: q, minSubscribers })
        : await this.svc.search({ genre: this.genre(), subMode: this.subMode(), minSubscribers });
      this.lastResult.set(result);
      this.resultRows.set(this.mergeResultRows(result));
      this.rosterRows.set(result.alreadyInRoster);
      this.staged.emit();
    } catch (err) {
      this.error.set(edgeErrorMessage(err, 'Search failed'));
    } finally {
      this.stopElapsed();
      this.busy.set(false);
    }
  }

  async applyStatus(row: DiscoveredChannel, status: 'shortlisted' | 'rejected'): Promise<void> {
    this.error.set(null);
    try {
      await this.svc.setStatus([row.channel_id], status);
      this.updateRowStatus(row.channel_id, status);
    } catch (err) {
      this.error.set(edgeErrorMessage(err, 'Update failed'));
    }
  }

  openDrawer(row: DiscoveredChannel): void {
    this.drawerCandidate.set(row);
  }

  openAdd(row: DiscoveredChannel): void {
    this.drawerCandidate.set(null);
    this.dialogCandidate.set(row);
    this.dialogMode.set('add');
  }

  openLink(row: DiscoveredChannel): void {
    this.drawerCandidate.set(null);
    this.dialogCandidate.set(row);
    this.dialogMode.set('link');
  }

  onDrawerAct(act: 'add' | 'shortlist' | 'reject' | 'link'): void {
    const row = this.drawerCandidate();
    if (!row) return;
    switch (act) {
      case 'add': this.openAdd(row); break;
      case 'link': this.openLink(row); break;
      case 'shortlist': void this.applyStatus(row, 'shortlisted'); break;
      case 'reject': void this.applyStatus(row, 'rejected'); break;
    }
  }

  onDialogDone(): void {
    const row = this.dialogCandidate();
    if (row) this.updateRowStatus(row.channel_id, 'added');
    this.dialogCandidate.set(null);
    this.staged.emit();
  }

  protected statusLabel(s: CandidateStatus): string { return STATUS_LABEL[s]; }
  protected statusFg(s: CandidateStatus): string { return STATUS_FG[s]; }
  protected statusBg(s: CandidateStatus): string { return STATUS_BG[s]; }

  /** Merge candidates + alreadyStaged into one row list, unique by channel_id.
   *  The backend's shared keep-first merge across its parallel preset queries
   *  already makes candidates and alreadyStaged pairwise disjoint within one
   *  response, so this is belt-and-braces against NG0955 (duplicate track
   *  keys) — e.g. stale rows mixed in across separate searches. Keep only
   *  the first occurrence — candidates come first, so the actionable entry
   *  wins. */
  private mergeResultRows(result: SearchResult): DiscoveredChannel[] {
    const seen = new Set<string>();
    return [...result.candidates, ...result.alreadyStaged]
      .filter((r) => (seen.has(r.channel_id) ? false : (seen.add(r.channel_id), true)));
  }

  private updateRowStatus(channelId: string, status: CandidateStatus): void {
    this.resultRows.update((rows) => rows.map((r) => (r.channel_id === channelId ? { ...r, status } : r)));
    const d = this.drawerCandidate();
    if (d && d.channel_id === channelId) this.drawerCandidate.set({ ...d, status });
  }
}
