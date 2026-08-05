import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { SpinnerComponent } from '../../shared/spinner/spinner.component';
import { AdminCreatorService } from '../../core/admin/admin-creator.service';
import { AddedCreator, OfflineCreator, PlatformSyncStatus } from '../../core/admin/admin-creator.types';
import { edgeErrorMessage } from '../../core/api/edge-error';

const TH = 'text-left px-3 py-2 text-[10px] uppercase tracking-wider font-medium';

const STATUS_LABELS: Record<PlatformSyncStatus, string> = {
  resolving: 'Resolving…', resolved: 'Resolved', synced: 'Synced', offline: 'Offline',
};
const STATUS_FG: Record<PlatformSyncStatus, string> = {
  resolving: 'var(--color-sf-gold)', resolved: 'var(--color-sf-blue)',
  synced: 'var(--color-sf-green)', offline: 'var(--color-sf-red)',
};
const STATUS_BG: Record<PlatformSyncStatus, string> = {
  resolving: 'color-mix(in srgb, var(--color-sf-gold) 15%, transparent)',
  resolved: 'color-mix(in srgb, var(--color-sf-blue) 15%, transparent)',
  synced: 'color-mix(in srgb, var(--color-sf-green) 15%, transparent)',
  offline: 'color-mix(in srgb, var(--color-sf-red) 15%, transparent)',
};

/** Friendly, admin-facing status + tooltip for an offline creator, mapped from the
 *  raw `offline_reason` the refresh pipeline stored (e.g. `bootstrap_no_channel`).
 *  Exported for testing. */
export interface OfflineStatus {
  label: string;
  tip: string;
}

const OFFLINE_STATUS: Record<string, OfflineStatus> = {
  bootstrap_no_channel: {
    label: 'Handle didn’t resolve',
    tip: 'We couldn’t find a channel for this handle — it’s likely mistyped, renamed, or the channel was deleted. Re-sync retries the lookup, but if the handle is wrong it will keep failing.',
  },
  channels_list_empty_2x: {
    label: 'Channel went dark',
    tip: 'This YouTube channel resolved before but now returns no data twice in a row — likely deleted, made private, or terminated. Re-sync re-checks in case it’s back.',
  },
  get_users_empty_2x: {
    label: 'Channel went dark',
    tip: 'This Twitch channel returned no data twice in a row — likely renamed, deleted, or banned. Re-sync re-checks in case it’s back.',
  },
};

const OFFLINE_STATUS_FALLBACK: OfflineStatus = {
  label: 'Offline',
  tip: 'This creator’s platform data couldn’t be refreshed. Re-sync re-checks the platform.',
};

export function offlineStatusFor(reason: string | null): OfflineStatus {
  return (reason ? OFFLINE_STATUS[reason] : undefined) ?? OFFLINE_STATUS_FALLBACK;
}

@Component({
  selector: 'app-admin-creators',
  standalone: true,
  imports: [DatePipe, DecimalPipe, SpinnerComponent],
  template: `
    <div data-testid="admin-creators" class="flex flex-col gap-6">
      <!-- Added creators -->
      <section class="sf-card overflow-hidden">
        <header class="flex items-center justify-between px-4 py-3">
          <h2 class="text-sm font-bold uppercase tracking-wider" style="color: var(--color-text);">Added creators</h2>
          <div class="flex items-center gap-2">
            @if (anyUnsettled()) {
              <button
                type="button"
                (click)="syncUnsynced()"
                [disabled]="syncBusy()"
                class="sf-btn sf-btn-primary text-xs"
                data-testid="sync-unsynced"
              >{{ syncBusy() ? 'Syncing…' : 'Sync unsynced' }}</button>
            }
            <button
              type="button"
              (click)="loadList()"
              [disabled]="listLoading()"
              class="sf-btn sf-btn-ghost text-xs"
              data-testid="added-refresh"
            >{{ listLoading() ? 'Refreshing…' : 'Refresh' }}</button>
          </div>
        </header>

        @if (notice(); as n) {
          <p class="text-xs px-4 pb-2" [style.color]="n.tone === 'ok' ? 'var(--color-sf-green)' : 'var(--color-sf-gold)'" data-testid="creators-notice">{{ n.text }}</p>
        }

        @if (!loaded() && listLoading()) {
          <div class="px-4 pb-4" data-testid="added-loading"><app-spinner label="Loading creators…" /></div>
        } @else if (listError()) {
          <p class="text-sm px-4 pb-3" style="color: var(--color-sf-red);">{{ listError() }}</p>
        } @else if (added().length === 0) {
          <p class="text-sm px-4 pb-3" style="color: var(--color-text-muted);">No creators added yet.</p>
        } @else {
          <table class="w-full text-sm">
            <thead>
              <tr style="color: var(--color-text-muted); background: var(--color-bg-3);">
                <th class="${TH}">Name</th>
                <th class="${TH}">Genre</th>
                <th class="${TH}">YouTube</th>
                <th class="${TH}">Twitch</th>
                <th class="${TH}">GFI</th>
                <th class="${TH}">CPI</th>
                <th class="${TH}">Added</th>
                <th class="${TH}"></th>
              </tr>
            </thead>
            <tbody>
              @for (c of added(); track c.id) {
                <tr data-testid="admin-added-row" style="color: var(--color-text); border-top: 1px solid var(--color-border);">
                  <td class="px-3 py-2 font-medium">{{ c.name }}</td>
                  <td class="px-3 py-2">{{ c.genre }}</td>
                  <td class="px-3 py-2">
                    @if (c.youtube) {
                      <span class="sf-chip" [style.background]="statusBg(c.youtube)" [style.color]="statusFg(c.youtube)">{{ statusLabel(c.youtube) }}</span>
                    } @else { <span style="color: var(--color-text-muted);">—</span> }
                  </td>
                  <td class="px-3 py-2">
                    @if (c.twitch) {
                      <span class="sf-chip" [style.background]="statusBg(c.twitch)" [style.color]="statusFg(c.twitch)">{{ statusLabel(c.twitch) }}</span>
                    } @else { <span style="color: var(--color-text-muted);">—</span> }
                  </td>
                  <td class="px-3 py-2">{{ c.gfi ? '✓' : '—' }}</td>
                  <td class="px-3 py-2">{{ c.cpi !== null ? (c.cpi | number:'1.0-0') : '—' }}</td>
                  <td class="px-3 py-2 text-xs" style="color: var(--color-text-muted);">{{ c.addedAt | date:'short' }}</td>
                  <td class="px-3 py-2 text-right">
                    @if (!c.youtube || !c.twitch) {
                      <button
                        type="button"
                        (click)="openAddPlatform(c)"
                        class="sf-btn sf-btn-ghost text-xs"
                        data-testid="add-platform"
                      >Add platform</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (anyUnsettled()) {
            <p class="text-xs px-4 py-2" style="color: var(--color-text-muted);" data-testid="added-syncing">
              Syncing new creators… id + stats land within ~a minute; Twitch CPI needs a first live capture.
            </p>
          }
        }
      </section>

      <!-- Offline / needs attention. Re-sync clears the offline flag + re-fires the kick. -->
      <section class="sf-card overflow-hidden">
        <header class="px-4 py-3">
          <h2 class="text-sm font-bold uppercase tracking-wider" style="color: var(--color-text);">Offline / needs attention</h2>
        </header>
        @if (!loaded() && listLoading()) {
          <div class="px-4 pb-4" data-testid="offline-loading"><app-spinner label="Checking for offline creators…" /></div>
        } @else if (offline().length > 0) {
          <p class="text-xs px-4 pb-2" style="color: var(--color-text-muted);">Re-sync clears the offline flag and re-checks the platform. A still-broken creator reappears after the next refresh.</p>
          <table class="w-full text-sm">
            <thead>
              <tr style="color: var(--color-text-muted); background: var(--color-bg-3);">
                <th class="${TH}">Name</th>
                <th class="${TH}">Platform</th>
                <th class="${TH}">Offline since</th>
                <th class="${TH}">Status</th>
                <th class="${TH}"></th>
              </tr>
            </thead>
            <tbody>
              @for (o of offline(); track o.platform + o.id) {
                <tr data-testid="admin-offline-row" style="color: var(--color-text); border-top: 1px solid var(--color-border);">
                  <td class="px-3 py-2 font-medium">{{ o.name ?? '—' }}</td>
                  <td class="px-3 py-2">{{ o.platform }}</td>
                  <td class="px-3 py-2 text-xs" style="color: var(--color-text-muted);">{{ o.offlineAt ? (o.offlineAt | date:'short') : '—' }}</td>
                  <td class="px-3 py-2">
                    <span
                      class="sf-chip cursor-help"
                      style="background: color-mix(in srgb, var(--color-sf-gold) 15%, transparent); color: var(--color-sf-gold);"
                      [title]="offlineStatus(o.reason).tip"
                      data-testid="offline-status"
                    >{{ offlineStatus(o.reason).label }}</span>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <button
                      type="button"
                      (click)="onResync(o)"
                      [disabled]="isResyncing(o)"
                      class="sf-btn sf-btn-ghost text-xs"
                      data-testid="admin-resync"
                    >{{ isResyncing(o) ? 'Re-syncing…' : 'Re-sync' }}</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="text-sm px-4 pb-4" style="color: var(--color-text-muted);">No creators need attention right now.</p>
        }
      </section>

      <!-- Add-platform dialog: attaches the missing YouTube/Twitch row to an
           already-added creator (same centered-overlay pattern as the discovery
           add/link dialog). -->
      @if (platformDialogFor(); as pc) {
        <div
          class="fixed inset-0 z-50 flex items-start justify-center p-6 overflow-auto sf-fade-in"
          style="background: var(--color-overlay);"
          (click)="closePlatformDialog()"
        >
          <div
            class="sf-card max-w-md w-full p-6 flex flex-col gap-3 mt-12 sf-modal-in"
            (click)="$event.stopPropagation()"
            data-testid="add-platform-dialog"
          >
            <h2 class="text-sm font-bold uppercase tracking-wider" style="color: var(--color-text);">Add platform — {{ pc.name }}</h2>
            <div>
              <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">Platform</label>
              <select
                [value]="dialogPlatform()"
                (change)="dialogPlatform.set($any($event.target).value)"
                class="sf-select"
                data-testid="add-platform-select"
              >
                @if (missingPlatforms(pc).length > 1) {
                  <option value="">Select a platform…</option>
                }
                @for (p of missingPlatforms(pc); track p) {
                  <option [value]="p">{{ p === 'youtube' ? 'YouTube' : 'Twitch' }}</option>
                }
              </select>
            </div>
            <div>
              <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">Handle</label>
              <input
                [value]="dialogHandle()"
                (input)="dialogHandle.set($any($event.target).value)"
                placeholder="handle"
                class="sf-input"
                data-testid="add-platform-handle"
              />
            </div>
            @if (dialogError()) {
              <p class="text-sm" style="color: var(--color-sf-red);" data-testid="add-platform-error">{{ dialogError() }}</p>
            }
            <div class="flex justify-end gap-2 mt-2">
              <button type="button" (click)="closePlatformDialog()" class="sf-btn sf-btn-ghost" data-testid="add-platform-cancel">Cancel</button>
              <button
                type="button"
                (click)="submitPlatform()"
                [disabled]="dialogBusy()"
                class="sf-btn sf-btn-primary"
                data-testid="add-platform-submit"
              >{{ dialogBusy() ? 'Attaching…' : 'Attach' }}</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminCreatorsComponent {
  private svc = inject(AdminCreatorService);

  readonly added = signal<AddedCreator[]>([]);
  readonly offline = signal<OfflineCreator[]>([]);
  readonly listLoading = signal(false);
  readonly listError = signal<string | null>(null);
  // False until the first loadList() settles — lets the lists show a real loading
  // state on first paint instead of flashing their empty states. Stays true across
  // later refreshes/polls (those keep the existing data + the "Refreshing…" button).
  readonly loaded = signal(false);

  // Poll while creators are still unsettled — id-resolution, stats, and GFI land
  // within ~a minute via the targeted sync kicks (see anyUnsettled). Bounded so
  // it can't spin forever if something stalls.
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private pollAttempts = 0;
  private readonly POLL_MS = 5000;
  private readonly MAX_POLLS = 36; // ~3 min ceiling

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
    void this.loadList();
  }

  async loadList(): Promise<void> {
    this.listLoading.set(true);
    this.listError.set(null);
    try {
      const { added, offline } = await this.svc.listCreators();
      this.added.set(added);
      this.offline.set(offline);
      this.syncPolling();
    } catch (err) {
      this.listError.set(edgeErrorMessage(err, 'Failed to load creators'));
    } finally {
      this.listLoading.set(false);
      this.loaded.set(true);
    }
  }

  /** A creator is still settling while any platform hasn't reached a terminal
   *  state ('synced'/'offline') or its Genre Fit Index (GFI) is missing.
   *  Targeted syncs land stats within ~a minute, so polling rides
   *  resolved → synced too (it used to stop at 'resolved', leaving
   *  freshly-synced rows visually stale until reload). */
  anyUnsettled(list: AddedCreator[] = this.added()): boolean {
    const settling = (s: PlatformSyncStatus | null) => s === 'resolving' || s === 'resolved';
    return list.some((c) => settling(c.youtube) || settling(c.twitch) || !c.gfi);
  }

  readonly syncBusy = signal(false);
  readonly notice = signal<{ text: string; tone: 'ok' | 'warn' } | null>(null);

  async syncUnsynced(): Promise<void> {
    if (this.syncBusy()) return;
    this.syncBusy.set(true);
    this.notice.set(null);
    try {
      const r = await this.svc.syncUnsynced();
      this.notice.set({
        text: `Sync dispatched – YouTube: ${r.youtube}, GFI: ${r.gfi}, Twitch: ${r.twitch}, rates: ${r.rates}. Stats land within ~a minute.`,
        tone: 'ok',
      });
      await this.loadList();
    } catch (err) {
      this.notice.set({ text: edgeErrorMessage(err, 'Sync failed'), tone: 'warn' });
    } finally {
      this.syncBusy.set(false);
    }
  }

  private syncPolling(): void {
    if (this.anyUnsettled() && this.pollAttempts < this.MAX_POLLS) {
      this.pollHandle ??= setInterval(() => {
        this.pollAttempts++;
        void this.loadList();
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
    // lifetime — otherwise ~3 cumulative minutes of polling would permanently
    // refuse to re-arm and this list would stop updating.
    this.pollAttempts = 0;
  }

  protected statusLabel(s: PlatformSyncStatus): string { return STATUS_LABELS[s]; }
  protected statusBg(s: PlatformSyncStatus): string { return STATUS_BG[s]; }
  protected statusFg(s: PlatformSyncStatus): string { return STATUS_FG[s]; }

  // Which offline row (by `${id}:${platform}`) is mid-resync — for the button's busy state.
  readonly resyncingKey = signal<string | null>(null);
  protected isResyncing(o: OfflineCreator): boolean { return this.resyncingKey() === `${o.id}:${o.platform}`; }

  /** Friendly status + tooltip for an offline row, from its raw offline_reason. */
  protected readonly offlineStatus = offlineStatusFor;

  /** Re-sync one offline (creator, platform): clears the offline flag + re-fires the
   *  platform kick server-side, then reloads. A cleared row drops off this list; a
   *  still-broken one reappears after the next refresh. */
  async onResync(o: OfflineCreator): Promise<void> {
    this.resyncingKey.set(`${o.id}:${o.platform}`);
    this.listError.set(null);
    try {
      await this.svc.resyncCreator(o.id, o.platform);
      await this.loadList();
    } catch (err) {
      this.listError.set(edgeErrorMessage(err, 'Re-sync failed'));
    } finally {
      this.resyncingKey.set(null);
    }
  }

  // Add-platform dialog: attach a missing platform (YouTube or Twitch) to an
  // already-added creator. Opened per-row; `openAddPlatform` captures the row
  // as-is, so the dialog's platform choices don't shift under the admin if a
  // background poll reloads the list while it's open.
  readonly platformDialogFor = signal<AddedCreator | null>(null);
  readonly dialogPlatform = signal<'youtube' | 'twitch' | ''>('');
  readonly dialogHandle = signal('');
  readonly dialogError = signal<string | null>(null);
  readonly dialogBusy = signal(false);

  protected missingPlatforms(c: AddedCreator): Array<'youtube' | 'twitch'> {
    const missing: Array<'youtube' | 'twitch'> = [];
    if (!c.youtube) missing.push('youtube');
    if (!c.twitch) missing.push('twitch');
    return missing;
  }

  openAddPlatform(c: AddedCreator): void {
    const missing = this.missingPlatforms(c);
    this.platformDialogFor.set(c);
    // Only one platform can be missing in the common case — preselect it so
    // the admin doesn't have to pick from a one-item list.
    this.dialogPlatform.set(missing.length === 1 ? missing[0] : '');
    this.dialogHandle.set('');
    this.dialogError.set(null);
  }

  closePlatformDialog(): void {
    this.platformDialogFor.set(null);
  }

  /** Attach the dialog's platform+handle to the creator it was opened for.
   *  Any 2xx (including a same-handle heal re-attach) counts as success —
   *  only a thrown error (409 conflict, etc.) surfaces inline. */
  async submitPlatform(): Promise<void> {
    const c = this.platformDialogFor();
    const platform = this.dialogPlatform();
    const handle = this.dialogHandle().trim().replace(/^@/, '');
    if (!c || !platform || !handle) {
      this.dialogError.set('Select a platform and enter a handle.');
      return;
    }
    this.dialogBusy.set(true);
    this.dialogError.set(null);
    try {
      const res = await this.svc.attachPlatform({ creatorId: c.id, platform, handle });
      const failed = Object.entries(res.kicks ?? {}).filter(([, s]) => s === 'failed').map(([k]) => k);
      if (failed.length) {
        this.notice.set({ text: `Background sync failed (${failed.join(', ')}) – will self-heal overnight, or press Sync unsynced.`, tone: 'warn' });
      }
      this.closePlatformDialog();
      await this.loadList();
    } catch (err) {
      this.dialogError.set(edgeErrorMessage(err, 'Attach failed'));
    } finally {
      this.dialogBusy.set(false);
    }
  }
}
