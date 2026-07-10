import { Component, computed, inject, signal, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AdminDiscoveryService } from '../../core/admin/admin-discovery.service';
import { AdminCreatorService } from '../../core/admin/admin-creator.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { CandidateStatus, DiscoveredChannel } from '../../core/admin/admin-discovery.types';
import { AddCreatorInput } from '../../core/admin/admin-creator.types';
import { DiscoveryDrawerComponent } from './discovery-drawer.component';
import { DiscoveryAddDialogComponent, seedFrom } from './discovery-add-dialog.component';
import { SpinnerComponent } from '../../shared/spinner/spinner.component';

const TH = 'text-left px-3 py-2 text-[10px] uppercase tracking-wider font-medium';
const PAGE_SIZE = 50;

type StatusFilter = 'all' | CandidateStatus;

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

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'new', label: 'New' }, { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'rejected', label: 'Rejected' }, { key: 'added', label: 'Added' },
];

/**
 * Review-queue sub-view of the Add-creators tab — every candidate ever
 * fetched (search or sweep), filterable by status/genre and paginated
 * server-side. Unlike the search view (which mutates its in-memory result
 * list to reflect an action), every mutation here re-fetches the current
 * page: the queue's whole job is showing accurate server state + totals for
 * pagination, and a candidate whose status just changed often no longer
 * belongs on the current filtered page anyway. Emits `changed` after any
 * mutation (row action, bulk action, or add) so the shell can refresh its
 * badge counts.
 */
@Component({
  selector: 'app-discovery-queue',
  standalone: true,
  imports: [DecimalPipe, DatePipe, DiscoveryDrawerComponent, DiscoveryAddDialogComponent, SpinnerComponent],
  template: `
    <div data-testid="discovery-queue" class="flex flex-col gap-4">
      <div class="sf-card p-4 flex flex-wrap items-end gap-3">
        <div class="flex gap-1">
          @for (o of statusOptions; track o.key) {
            <button
              type="button"
              (click)="onStatusFilter(o.key)"
              class="sf-btn text-xs"
              [class.sf-btn-primary]="statusFilter() === o.key"
              [class.sf-btn-ghost]="statusFilter() !== o.key"
              [attr.data-testid]="'queue-filter-' + o.key"
            >{{ o.label }}</button>
          }
        </div>
        <div>
          <select
            [value]="genreFilter()"
            (change)="onGenreFilter($any($event.target).value)"
            class="sf-select"
            style="min-width: 170px;"
            data-testid="queue-genre-filter"
          >
            <option value="">All genres</option>
            @for (g of genreOptions(); track g) {
              <option [value]="g">{{ g }}</option>
            }
          </select>
        </div>
      </div>

      @if (loading() && rows().length === 0) {
        <div class="sf-card p-6"><app-spinner label="Loading queue…" /></div>
      } @else if (error()) {
        <p class="sf-card p-4 text-sm" style="color: var(--color-sf-red);" data-testid="queue-error">{{ error() }}</p>
      } @else {
        @if (selected().size > 0) {
          <div class="sf-card p-3 flex items-center gap-3" data-testid="queue-bulk-bar">
            <span class="text-xs" style="color: var(--color-text-muted);">{{ selected().size }} selected</span>
            <button type="button" (click)="bulkAdd()" [disabled]="busy()" class="sf-btn sf-btn-primary text-xs" data-testid="queue-bulk-add">✚ Add…</button>
            <button type="button" (click)="bulkSetStatus('shortlisted')" [disabled]="busy()" class="sf-btn sf-btn-ghost text-xs" data-testid="queue-bulk-shortlist">☆ Shortlist</button>
            <button type="button" (click)="bulkSetStatus('rejected')" [disabled]="busy()" class="sf-btn sf-btn-ghost text-xs" data-testid="queue-bulk-reject">✕ Reject</button>
          </div>
        }

        @if (warning()) {
          <p class="text-xs" style="color: var(--color-sf-gold);" data-testid="queue-bulk-add-warning">{{ warning() }}</p>
        }

        @if (rows().length === 0) {
          <p class="text-sm" style="color: var(--color-text-muted);">No candidates in the queue for this filter.</p>
        } @else {
          <div class="sf-card overflow-hidden" data-testid="queue-table">
            <table class="w-full text-sm">
              <thead>
                <tr style="color: var(--color-text-muted); background: var(--color-bg-3);">
                  <th class="${TH}"></th>
                  <th class="${TH}">Name</th>
                  <th class="${TH}">Handle</th>
                  <th class="${TH}">Subs</th>
                  <th class="${TH}">Avg views</th>
                  <th class="${TH}">Eng %</th>
                  <th class="${TH}">Sponsored %</th>
                  <th class="${TH}">Language</th>
                  <th class="${TH}">Status</th>
                  <th class="${TH}">Fetched</th>
                  <th class="${TH}"></th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.channel_id) {
                  <tr
                    (click)="openDrawer(row)"
                    class="cursor-pointer"
                    style="border-top: 1px solid var(--color-border); color: var(--color-text);"
                    data-testid="queue-row"
                  >
                    <td class="px-3 py-2" (click)="$event.stopPropagation()">
                      <input
                        type="checkbox"
                        [checked]="selected().has(row.channel_id)"
                        (change)="toggleSelect(row.channel_id)"
                        data-testid="queue-row-select"
                      />
                    </td>
                    <td class="px-3 py-2 font-medium">{{ row.name }}</td>
                    <td class="px-3 py-2">{{ row.handle ? '@' + row.handle : '—' }}</td>
                    <td class="px-3 py-2">{{ row.subscriber_count | number }}</td>
                    <td class="px-3 py-2">{{ row.avg_views | number }}</td>
                    <td class="px-3 py-2">{{ row.engagement_rate | number:'1.0-1' }}%</td>
                    <td class="px-3 py-2">{{ row.sponsor_freq_pct | number:'1.0-0' }}%</td>
                    <td class="px-3 py-2">{{ row.language || '—' }}</td>
                    <td class="px-3 py-2">
                      <span class="sf-chip" [style.background]="statusBg(row.status)" [style.color]="statusFg(row.status)" data-testid="queue-row-status">{{ statusLabel(row.status) }}</span>
                    </td>
                    <td class="px-3 py-2 text-xs" style="color: var(--color-text-muted);">{{ row.fetched_at | date }}</td>
                    <td class="px-3 py-2 text-right" (click)="$event.stopPropagation()">
                      @if (row.status === 'new' || row.status === 'shortlisted') {
                        <div class="flex justify-end gap-1">
                          <button type="button" (click)="openAdd(row)" [disabled]="busy()" class="sf-btn sf-btn-primary text-xs" data-testid="queue-row-add">✚ Add</button>
                          <button type="button" (click)="applyStatus(row, 'shortlisted')" [disabled]="busy()" class="sf-btn sf-btn-ghost text-xs" data-testid="queue-row-shortlist">☆ Shortlist</button>
                          <button type="button" (click)="applyStatus(row, 'rejected')" [disabled]="busy()" class="sf-btn sf-btn-ghost text-xs" data-testid="queue-row-reject">✕ Reject</button>
                        </div>
                      } @else if (row.status === 'rejected') {
                        <button type="button" (click)="applyStatus(row, 'new')" [disabled]="busy()" class="sf-btn sf-btn-ghost text-xs" data-testid="queue-row-restore">↺ Restore</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <div class="flex items-center gap-3">
          <button type="button" (click)="prev()" [disabled]="page() === 0" class="sf-btn sf-btn-ghost text-xs" data-testid="queue-prev">← Prev</button>
          <span class="text-xs" style="color: var(--color-text-muted);">Page {{ page() + 1 }} of {{ totalPages() }}</span>
          <button type="button" (click)="next()" [disabled]="page() + 1 >= totalPages()" class="sf-btn sf-btn-ghost text-xs" data-testid="queue-next">Next →</button>
        </div>
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
export class DiscoveryQueueComponent {
  private svc = inject(AdminDiscoveryService);
  private creatorSvc = inject(AdminCreatorService);
  private creators = inject(CreatorsService);

  readonly changed = output<void>();

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly genreOptions = computed(() => Object.keys(this.creators.submodesByGenre()).sort());

  readonly statusFilter = signal<StatusFilter>('all');
  readonly genreFilter = signal('');
  readonly page = signal(0);
  readonly total = signal(0);
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  readonly rows = signal<DiscoveredChannel[]>([]);
  readonly selected = signal<Set<string>>(new Set());

  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly warning = signal<string | null>(null);

  readonly drawerCandidate = signal<DiscoveredChannel | null>(null);
  readonly dialogCandidate = signal<DiscoveredChannel | null>(null);
  readonly dialogMode = signal<'add' | 'link'>('add');

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.warning.set(null);
    try {
      const filter: { status?: CandidateStatus; genre?: string } = {};
      const sf = this.statusFilter();
      if (sf !== 'all') filter.status = sf;
      if (this.genreFilter()) filter.genre = this.genreFilter();
      const { rows, total } = await this.svc.listQueue(filter, this.page(), PAGE_SIZE);
      this.rows.set(rows);
      this.total.set(total);
    } catch (err) {
      this.error.set(this.errorMessage(err, 'Failed to load queue'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Reload + drop the current selection — every mutation path (bulk action,
   *  per-row action, add) routes through this: the selection is scoped to
   *  whatever's on screen, and that's about to change underneath it. */
  private async reload(): Promise<void> {
    this.selected.set(new Set());
    await this.load();
  }

  onStatusFilter(s: StatusFilter): Promise<void> {
    this.statusFilter.set(s);
    this.page.set(0);
    return this.reload();
  }

  onGenreFilter(g: string): Promise<void> {
    this.genreFilter.set(g);
    this.page.set(0);
    return this.reload();
  }

  prev(): Promise<void> {
    if (this.page() === 0) return Promise.resolve();
    this.page.update((p) => p - 1);
    return this.reload();
  }

  next(): Promise<void> {
    if (this.page() + 1 >= this.totalPages()) return Promise.resolve();
    this.page.update((p) => p + 1);
    return this.reload();
  }

  toggleSelect(channelId: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      if (next.has(channelId)) next.delete(channelId); else next.add(channelId);
      return next;
    });
  }

  async applyStatus(row: DiscoveredChannel, status: Extract<CandidateStatus, 'shortlisted' | 'rejected' | 'new'>): Promise<void> {
    this.error.set(null);
    try {
      await this.svc.setStatus([row.channel_id], status);
      await this.reload();
      this.changed.emit();
    } catch (err) {
      this.error.set(this.errorMessage(err, 'Update failed'));
    }
  }

  async bulkSetStatus(status: 'shortlisted' | 'rejected'): Promise<void> {
    const ids = [...this.selected()];
    if (!ids.length) return;
    this.error.set(null);
    this.busy.set(true);
    try {
      await this.svc.setStatus(ids, status);
      await this.reload();
      this.changed.emit();
    } catch (err) {
      this.error.set(this.errorMessage(err, 'Update failed'));
    } finally {
      this.busy.set(false);
    }
  }

  /** Dialog-less bulk add: each selected row's own genre/language/bio feeds
   *  one addCreators(batch) call (no per-row editing UI — that's what the
   *  single-row Add dialog is for). The backend rejects an unknown genre for
   *  the whole batch, so a row with no genre would take every other selected
   *  row down with it — skip those up front and say so, rather than let one
   *  bad row silently fail the rest. */
  async bulkAdd(): Promise<void> {
    const selectedRows = this.rows().filter((r) => this.selected().has(r.channel_id));
    if (!selectedRows.length) return;
    this.error.set(null);
    const skipped = selectedRows.filter((r) => !r.genre);
    const eligible = selectedRows.filter((r) => !!r.genre);
    if (!eligible.length) {
      this.warning.set(`Skipped — no genre set: ${skipped.map((r) => r.name).join(', ')}`);
      return;
    }
    const batch: AddCreatorInput[] = eligible.map((r) => this.toAddInput(r));
    this.busy.set(true);
    try {
      await this.creatorSvc.addCreators(batch);
      await this.reload();
      if (skipped.length) this.warning.set(`Skipped — no genre set: ${skipped.map((r) => r.name).join(', ')}`);
      this.changed.emit();
    } catch (err) {
      this.error.set(this.errorMessage(err, 'Add failed'));
    } finally {
      this.busy.set(false);
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

  /** Shortlist/reject close the drawer before firing — the candidate object
   *  the drawer holds is about to be stale (reload() re-fetches from the
   *  server rather than patching it in place), so there's nothing current
   *  left to show. */
  onDrawerAct(act: 'add' | 'shortlist' | 'reject' | 'link'): void {
    const row = this.drawerCandidate();
    if (!row) return;
    switch (act) {
      case 'add': this.openAdd(row); break;
      case 'link': this.openLink(row); break;
      case 'shortlist':
        this.drawerCandidate.set(null);
        void this.applyStatus(row, 'shortlisted');
        break;
      case 'reject':
        this.drawerCandidate.set(null);
        void this.applyStatus(row, 'rejected');
        break;
    }
  }

  async onDialogDone(): Promise<void> {
    this.dialogCandidate.set(null);
    await this.reload();
    this.changed.emit();
  }

  protected statusLabel(s: CandidateStatus): string { return STATUS_LABEL[s]; }
  protected statusFg(s: CandidateStatus): string { return STATUS_FG[s]; }
  protected statusBg(s: CandidateStatus): string { return STATUS_BG[s]; }

  /** Same field mapping as the single-row Add dialog (discovery-add-dialog.component.ts),
   *  minus the fields only a form can supply (twitch handle, color). */
  private toAddInput(row: DiscoveredChannel): AddCreatorInput {
    return {
      name: row.name,
      genre: row.genre,
      platforms: { youtube: row.handle || row.channel_id },
      ...(row.bio ? { bio: row.bio } : {}),
      ...(row.language ? { language: row.language } : {}),
      statsSeed: seedFrom(row),
    };
  }

  /** Prefer the edge fn's JSON `{ error }` (HttpErrorResponse.error.error) over the
   *  generic HttpClient message; fall back to the raw Error message or a default. */
  private errorMessage(err: unknown, fallback: string): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const inner = (err as { error?: unknown }).error;
      if (inner && typeof inner === 'object' && 'error' in inner) {
        const msg = (inner as { error?: unknown }).error;
        if (typeof msg === 'string') return msg;
      }
    }
    return err instanceof Error ? err.message : fallback;
  }
}
