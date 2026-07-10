import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SpinnerComponent } from '../../shared/spinner/spinner.component';
import { AdminCreatorService } from '../../core/admin/admin-creator.service';
import { CreatorsService } from '../../core/creators/creators.service';
import {
  AddCreatorInput,
  AddedCreator,
  OfflineCreator,
  PlatformSyncStatus,
} from '../../core/admin/admin-creator.types';

const LABEL = 'text-[10px] uppercase tracking-wider mb-1 block';
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
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, SpinnerComponent],
  template: `
    <div data-testid="admin-creators" class="flex flex-col gap-6">
      <!-- Add form -->
      <form
        [formGroup]="form"
        (ngSubmit)="onSubmit()"
        class="sf-card p-4 flex flex-col gap-3"
        data-testid="admin-add-form"
      >
        <h2 class="text-sm font-bold uppercase tracking-wider" style="color: var(--color-text);">Add creator</h2>

        <div>
          <label class="${LABEL}" style="color: var(--color-text-muted);">Name</label>
          <input formControlName="name" class="sf-input" data-testid="add-name" />
        </div>

        <div>
          <label class="${LABEL}" style="color: var(--color-text-muted);">Genre</label>
          <select formControlName="genre" class="sf-input" data-testid="add-genre">
            <option value="" disabled>Select a genre…</option>
            @for (g of genreOptions(); track g) {
              <option [value]="g">{{ g }}</option>
            }
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="${LABEL}" style="color: var(--color-text-muted);">YouTube handle</label>
            <input formControlName="youtube" placeholder="@handle" class="sf-input" data-testid="add-youtube" />
          </div>
          <div>
            <label class="${LABEL}" style="color: var(--color-text-muted);">Twitch handle</label>
            <input formControlName="twitch" placeholder="handle" class="sf-input" data-testid="add-twitch" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 opacity-40">
          @for (p of unsupportedPlatforms; track p) {
            <div>
              <label class="${LABEL}" style="color: var(--color-text-muted);">{{ p }}</label>
              <input disabled placeholder="Coming soon" class="sf-input" />
            </div>
          }
        </div>

        <div>
          <label class="${LABEL}" style="color: var(--color-text-muted);">Bio (optional)</label>
          <textarea formControlName="bio" rows="2" class="sf-input"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="${LABEL}" style="color: var(--color-text-muted);">Language (optional)</label>
            <select formControlName="language" class="sf-input" data-testid="add-language">
              <option value="">Any / unspecified</option>
              @for (l of languageOptions(); track l.code) {
                <option [value]="l.code">{{ l.name }}</option>
              }
            </select>
          </div>
          <div>
            <label class="${LABEL}" style="color: var(--color-text-muted);">Color (optional)</label>
            <input formControlName="color" placeholder="#8b5cf6" class="sf-input" />
          </div>
        </div>

        @if (error()) {
          <p class="text-sm" style="color: var(--color-sf-red);" data-testid="add-error">{{ error() }}</p>
        }
        @if (success()) {
          <p class="text-sm" style="color: var(--color-sf-green);" data-testid="add-success">{{ success() }}</p>
        }

        <div class="flex justify-end">
          <button type="submit" [disabled]="busy()" class="sf-btn sf-btn-primary" data-testid="add-submit">
            {{ busy() ? 'Adding…' : 'Add creator' }}
          </button>
        </div>
      </form>

      <!-- Added creators -->
      <section class="sf-card overflow-hidden">
        <header class="flex items-center justify-between px-4 py-3">
          <h2 class="text-sm font-bold uppercase tracking-wider" style="color: var(--color-text);">Added creators</h2>
          <button
            type="button"
            (click)="loadList()"
            [disabled]="listLoading()"
            class="sf-btn sf-btn-ghost text-xs"
            data-testid="added-refresh"
          >{{ listLoading() ? 'Refreshing…' : 'Refresh' }}</button>
        </header>

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
                </tr>
              }
            </tbody>
          </table>
          @if (anyResolving()) {
            <p class="text-xs px-4 py-2" style="color: var(--color-text-muted);" data-testid="added-syncing">
              Syncing new creators… this list updates automatically. Full stats & CPI land at the nightly refresh.
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
    </div>
  `,
})
export class AdminCreatorsComponent {
  private fb = inject(FormBuilder);
  private svc = inject(AdminCreatorService);
  private creators = inject(CreatorsService);

  protected readonly unsupportedPlatforms = ['Instagram', 'TikTok', 'Kick', 'X'];

  // Genres the backend will accept = distinct genre_submodes.genre. submodesByGenre
  // is keyed on exactly that, so its keys are the canonical addable-genre list.
  readonly genreOptions = computed(() => Object.keys(this.creators.submodesByGenre()).sort());

  // Supported languages — the same list Discovery filters on, so a new creator's
  // language value always matches a filter option (freeform text would drift).
  readonly languageOptions = computed(() =>
    [...this.creators.languages()].sort((a, b) => a.name.localeCompare(b.name)));

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    genre: ['', Validators.required],
    youtube: [''],
    twitch: [''],
    bio: [''],
    language: [''],
    color: [''],
  });

  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly busy = signal(false);

  readonly added = signal<AddedCreator[]>([]);
  readonly offline = signal<OfflineCreator[]>([]);
  readonly listLoading = signal(false);
  readonly listError = signal<string | null>(null);
  // False until the first loadList() settles — lets the lists show a real loading
  // state on first paint instead of flashing their empty states. Stays true across
  // later refreshes/polls (those keep the existing data + the "Refreshing…" button).
  readonly loaded = signal(false);

  // Poll while creators are still resolving — id-resolution + GFI land within ~a
  // minute. Bounded so it can't spin forever if something stalls; 'synced'/CPI
  // only arrive at the nightly refresh, so we deliberately don't wait for them.
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private pollAttempts = 0;
  private readonly POLL_MS = 5000;
  private readonly MAX_POLLS = 36; // ~3 min ceiling

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
    void this.loadList();
  }

  async onSubmit(): Promise<void> {
    this.error.set(null);
    this.success.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Enter a name and pick a genre.');
      return;
    }
    const v = this.form.getRawValue();
    const youtube = v.youtube.trim();
    const twitch = v.twitch.trim();
    if (!youtube && !twitch) {
      this.error.set('Add at least one platform handle (YouTube or Twitch).');
      return;
    }
    const input: AddCreatorInput = {
      name: v.name.trim(),
      genre: v.genre,
      platforms: { ...(youtube ? { youtube } : {}), ...(twitch ? { twitch } : {}) },
      ...(v.bio.trim() ? { bio: v.bio.trim() } : {}),
      ...(v.language.trim() ? { language: v.language.trim() } : {}),
      ...(v.color.trim() ? { color: v.color.trim() } : {}),
    };

    this.busy.set(true);
    try {
      const { created } = await this.svc.addCreators([input]);
      this.success.set(`Added ${created.map((c) => c.name).join(', ')}.`);
      this.form.reset();
      await this.loadList();
    } catch (err) {
      this.error.set(this.errorMessage(err, 'Add failed'));
    } finally {
      this.busy.set(false);
    }
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
      this.listError.set(this.errorMessage(err, 'Failed to load creators'));
    } finally {
      this.listLoading.set(false);
      this.loaded.set(true);
    }
  }

  /** A creator is still settling while any platform is 'resolving' or its GFI is
   *  missing. 'resolved'/'synced'/'offline' + GFI present = settled. */
  anyResolving(list: AddedCreator[] = this.added()): boolean {
    return list.some((c) => c.youtube === 'resolving' || c.twitch === 'resolving' || !c.gfi);
  }

  private syncPolling(): void {
    if (this.anyResolving() && this.pollAttempts < this.MAX_POLLS) {
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
      this.listError.set(this.errorMessage(err, 'Re-sync failed'));
    } finally {
      this.resyncingKey.set(null);
    }
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
