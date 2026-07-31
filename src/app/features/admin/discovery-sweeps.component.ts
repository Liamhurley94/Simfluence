import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { SpinnerComponent } from '../../shared/spinner/spinner.component';
import { AdminDiscoveryService } from '../../core/admin/admin-discovery.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { DiscoveryRun, RunStatus } from '../../core/admin/admin-discovery.types';
import { edgeErrorMessage } from '../../core/api/edge-error';

const TH = 'text-left px-3 py-2 text-[10px] uppercase tracking-wider font-medium';
const LABEL = 'text-[10px] uppercase tracking-wider mb-1 block';

const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  queued: 'Queued', running: 'Running', paused_quota: 'Paused (quota)',
  done: 'Done', failed: 'Failed', cancelled: 'Cancelled',
};
const RUN_STATUS_FG: Record<RunStatus, string> = {
  queued: 'var(--color-text-muted)', running: 'var(--color-sf-blue)',
  paused_quota: 'var(--color-sf-gold)', done: 'var(--color-sf-green)',
  failed: 'var(--color-sf-red)', cancelled: 'var(--color-text-muted)',
};
const RUN_STATUS_BG: Record<RunStatus, string> = {
  queued: 'transparent',
  running: 'color-mix(in srgb, var(--color-sf-blue) 15%, transparent)',
  paused_quota: 'color-mix(in srgb, var(--color-sf-gold) 15%, transparent)',
  done: 'color-mix(in srgb, var(--color-sf-green) 15%, transparent)',
  failed: 'color-mix(in srgb, var(--color-sf-red) 15%, transparent)',
  cancelled: 'transparent',
};

const PAUSED_QUOTA_TIP = 'Paused (quota) — resumes after the Pacific-day rollover';

// Runs that still tick forward on their own within the 5s poll cadence.
// paused_quota resumes on an hourly server-side cron, not a 5s cadence, so
// polling for it would just be wasted requests — it's deliberately excluded.
const ACTIVE_RUN_STATUSES: RunStatus[] = ['queued', 'running'];
const CANCELLABLE_RUN_STATUSES: RunStatus[] = ['queued', 'running', 'paused_quota'];

/**
 * Sweeps sub-view of the Add-creators tab. A sweep runs every enabled seed
 * query for a genre (or all genres, or one sub-mode) server-side over time,
 * unlike Search's one-shot preset run — so this view is a start form plus a
 * live-ish table of runs rather than a results grid.
 *
 * Query count (and therefore the real unit cost) isn't known until the
 * backend resolves scope → seed queries, so the start row only shows a
 * floor estimate; the row's real `query_total` appears once the run exists.
 */
@Component({
  selector: 'app-discovery-sweeps',
  standalone: true,
  imports: [DatePipe, DecimalPipe, SpinnerComponent],
  template: `
    <div data-testid="discovery-sweeps" class="flex flex-col gap-4">
      <div class="sf-card p-4 flex flex-col gap-2">
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <label class="${LABEL}" style="color: var(--color-text-muted);">Genre</label>
            <select
              [value]="genre()"
              (change)="onGenre($any($event.target).value)"
              class="sf-select"
              style="min-width: 170px;"
              data-testid="sweep-genre"
            >
              <option value="">All genres</option>
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
              data-testid="sweep-submode"
            >
              <option value="">Whole genre</option>
              @for (sm of subModeOptions(); track sm.subMode) {
                <option [value]="sm.subMode">{{ sm.subMode }}{{ sm.hasKeywords ? '' : ' (beta)' }}</option>
              }
            </select>
          </div>
          <div>
            <label class="${LABEL}" style="color: var(--color-text-muted);">Min subs</label>
            <input
              type="number"
              min="1"
              [value]="minSubs() ?? ''"
              (input)="onMinSubs($any($event.target).value)"
              placeholder="5,000"
              class="sf-input"
              style="width: 110px;"
              data-testid="sweep-minsubs"
            />
          </div>
          <button
            type="button"
            (click)="startSweep()"
            [disabled]="starting()"
            class="sf-btn sf-btn-primary text-xs"
            data-testid="sweep-start"
          >{{ starting() ? 'Starting…' : 'Start sweep' }}</button>
        </div>
        <p class="text-xs" style="color: var(--color-text-muted);">
          ~100 units per query minimum — scope carefully. The real query count shows on the run below once it starts.
        </p>
        @if (startError()) {
          <p class="text-sm" style="color: var(--color-sf-red);" data-testid="sweep-start-error">{{ startError() }}</p>
        }
      </div>

      @if (runsError()) {
        <p class="text-sm" style="color: var(--color-sf-red);" data-testid="sweep-runs-error">{{ runsError() }}</p>
      }

      @if (!runsLoaded() && runsLoading()) {
        <div class="sf-card p-4" data-testid="sweep-runs-loading"><app-spinner label="Loading sweep runs…" /></div>
      } @else if (runs().length === 0) {
        <p class="text-sm" style="color: var(--color-text-muted);">No sweeps run yet.</p>
      } @else {
        <div class="sf-card overflow-hidden" data-testid="sweep-runs">
          <table class="w-full text-sm">
            <thead>
              <tr style="color: var(--color-text-muted); background: var(--color-bg-3);">
                <th class="${TH}">Scope</th>
                <th class="${TH}">Progress</th>
                <th class="${TH}">Found</th>
                <th class="${TH}">Skipped</th>
                <th class="${TH}">Units</th>
                <th class="${TH}">Status</th>
                <th class="${TH}">Started</th>
                <th class="${TH}"></th>
              </tr>
            </thead>
            <tbody>
              @for (r of runs(); track r.id) {
                <tr data-testid="sweep-run-row" style="color: var(--color-text); border-top: 1px solid var(--color-border);">
                  <td class="px-3 py-2 font-medium">{{ scopeLabel(r) }}</td>
                  <td class="px-3 py-2" style="min-width: 140px;">
                    <div class="text-xs mb-1" style="color: var(--color-text-muted);" data-testid="sweep-progress-text">{{ r.query_done }}/{{ r.query_total }}</div>
                    <div class="h-1.5 rounded-sm overflow-hidden" style="background: var(--color-bg-3);">
                      <div class="h-full" style="background: var(--color-sf-blue);" [style.width.%]="progressPct(r)" data-testid="sweep-progress-bar"></div>
                    </div>
                  </td>
                  <td class="px-3 py-2">{{ r.channels_found | number }}</td>
                  <td class="px-3 py-2">{{ r.skipped_known | number }}</td>
                  <td class="px-3 py-2">{{ r.units_spent | number }}</td>
                  <td class="px-3 py-2">
                    <span
                      class="sf-chip"
                      [class.cursor-help]="!!statusTitle(r)"
                      [style.background]="statusBg(r.status)"
                      [style.color]="statusFg(r.status)"
                      [title]="statusTitle(r)"
                      data-testid="sweep-status"
                    >{{ statusLabel(r.status) }}</span>
                  </td>
                  <td class="px-3 py-2 text-xs" style="color: var(--color-text-muted);">{{ r.created_at | date:'short' }}</td>
                  <td class="px-3 py-2 text-right">
                    @if (isCancellable(r)) {
                      <button
                        type="button"
                        (click)="cancel(r.id)"
                        [disabled]="cancelingId() === r.id"
                        class="sf-btn sf-btn-ghost text-xs"
                        data-testid="sweep-cancel"
                      >{{ cancelingId() === r.id ? 'Cancelling…' : 'Cancel' }}</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class DiscoverySweepsComponent {
  private svc = inject(AdminDiscoveryService);
  private creators = inject(CreatorsService);

  protected readonly genreOptions = computed(() => Object.keys(this.creators.submodesByGenre()).sort());
  protected readonly subModeOptions = computed(() => {
    const g = this.genre();
    return g ? (this.creators.submodesByGenre()[g] ?? []) : [];
  });

  readonly genre = signal('');
  readonly subMode = signal('');
  readonly minSubs = signal<number | null>(null);

  readonly starting = signal(false);
  readonly startError = signal<string | null>(null);

  readonly runs = signal<DiscoveryRun[]>([]);
  readonly runsLoading = signal(false);
  // False until the first loadRuns() settles — lets the table show a real
  // loading state on first paint instead of flashing the empty state. Stays
  // true across later refreshes/polls (those keep the existing rows).
  readonly runsLoaded = signal(false);
  readonly runsError = signal<string | null>(null);
  readonly cancelingId = signal<string | null>(null);

  // Poll while any run is queued/running — same bounded-interval pattern as
  // admin-creators.component.ts. Bounded so it can't spin forever if a run
  // stalls server-side.
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private pollAttempts = 0;
  private readonly POLL_MS = 5000;
  private readonly MAX_POLLS = 120; // ~10 min ceiling per polling episode

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
    void this.loadRuns();
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

  async startSweep(): Promise<void> {
    if (this.starting()) return;
    this.starting.set(true);
    this.startError.set(null);
    try {
      await this.svc.startSweep({
        genre: this.genre() || undefined,
        subMode: this.subMode() || undefined,
        minSubscribers: this.minSubs() ?? undefined,
      });
      await this.loadRuns();
    } catch (err) {
      this.startError.set(edgeErrorMessage(err, 'Failed to start sweep'));
    } finally {
      this.starting.set(false);
    }
  }

  async loadRuns(): Promise<void> {
    this.runsLoading.set(true);
    this.runsError.set(null);
    try {
      this.runs.set(await this.svc.listRuns());
      this.syncPolling();
    } catch (err) {
      this.runsError.set(edgeErrorMessage(err, 'Failed to load sweep runs'));
    } finally {
      this.runsLoading.set(false);
      this.runsLoaded.set(true);
    }
  }

  async cancel(runId: string): Promise<void> {
    this.cancelingId.set(runId);
    this.runsError.set(null);
    try {
      await this.svc.cancelRun(runId);
      await this.loadRuns();
    } catch (err) {
      this.runsError.set(edgeErrorMessage(err, 'Failed to cancel run'));
    } finally {
      this.cancelingId.set(null);
    }
  }

  // Public (not protected) — exercised directly by unit tests for the
  // scope/progress math, same convention as anyResolving() in admin-creators.
  scopeLabel(run: DiscoveryRun): string {
    if (!run.genre) return 'All genres';
    return run.sub_mode ? `${run.genre} · ${run.sub_mode}` : run.genre;
  }

  progressPct(run: DiscoveryRun): number {
    // Clamped: the backend freezes query_total at run creation, so mid-sweep
    // query additions can push query_done past it.
    return run.query_total > 0 ? Math.min(100, (run.query_done / run.query_total) * 100) : 0;
  }

  protected isCancellable(run: DiscoveryRun): boolean {
    return CANCELLABLE_RUN_STATUSES.includes(run.status);
  }

  protected statusLabel(s: RunStatus): string { return RUN_STATUS_LABEL[s]; }
  protected statusFg(s: RunStatus): string { return RUN_STATUS_FG[s]; }
  protected statusBg(s: RunStatus): string { return RUN_STATUS_BG[s]; }

  protected statusTitle(run: DiscoveryRun): string | null {
    if (run.status === 'failed') return run.error;
    if (run.status === 'paused_quota') return PAUSED_QUOTA_TIP;
    return null;
  }

  private syncPolling(): void {
    const active = this.runs().some((r) => ACTIVE_RUN_STATUSES.includes(r.status));
    if (active && this.pollAttempts < this.MAX_POLLS) {
      this.pollHandle ??= setInterval(() => {
        this.pollAttempts++;
        void this.loadRuns();
      }, this.POLL_MS);
    } else {
      this.stopPolling();
    }
  }

  private stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    // Reset so MAX_POLLS bounds each polling episode, not the component's
    // lifetime — otherwise ~10 cumulative minutes of polling would permanently
    // refuse to re-arm and progress would silently stop updating.
    this.pollAttempts = 0;
  }
}
