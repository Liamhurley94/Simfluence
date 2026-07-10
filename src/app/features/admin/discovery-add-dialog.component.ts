import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AdminCreatorService } from '../../core/admin/admin-creator.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { AddCreatorInput } from '../../core/admin/admin-creator.types';
import { DiscoveredChannel, StatsSeed } from '../../core/admin/admin-discovery.types';

const LABEL = 'text-[10px] uppercase tracking-wider mb-1 block';

/** Pure mapping from a just-fetched discovery candidate to the seed shape
 *  `admin-add-creator`/`admin-attach-platform` use to birth a youtube_creators
 *  row already fully synced — no extra YouTube quota, no waiting on a kick.
 *  Exported for reuse (bulk add, Task 6) and unit testing. */
export function seedFrom(c: DiscoveredChannel): StatsSeed {
  return {
    channelId: c.channel_id, uploadsPlaylistId: c.uploads_playlist_id,
    subscriberCount: c.subscriber_count, totalViews: 0, videoCount: c.video_count,
    avgViews: c.avg_views, engagementRate: c.engagement_rate,
    sponsorFreqPct: c.sponsor_freq_pct, recentVideos: c.recent_videos,
  };
}

/**
 * Add or link a discovery candidate (centered modal — same overlay pattern as
 * EnterpriseDetailComponent). `add` births a new roster creator seeded with
 * the candidate's stats; `link` attaches YouTube as a second platform on an
 * existing creator (id prefilled from an automatic name match, or typed in
 * manually when there's none). Both paths carry `statsSeed` so the new
 * platform row is born synced instead of waiting on a refresh kick.
 */
@Component({
  selector: 'app-discovery-add-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-start justify-center p-6 overflow-auto sf-fade-in"
      style="background: var(--color-overlay);"
      (click)="cancelled.emit()"
    >
      <form
        [formGroup]="form"
        (ngSubmit)="onSubmit()"
        class="sf-card max-w-md w-full p-6 flex flex-col gap-3 mt-12 sf-modal-in"
        (click)="$event.stopPropagation()"
        data-testid="discovery-add-dialog"
      >
        <h2 class="text-sm font-bold uppercase tracking-wider" style="color: var(--color-text);">
          {{ mode() === 'add' ? 'Add candidate' : 'Link to existing creator' }}
        </h2>

        @if (mode() === 'add') {
          <div>
            <label class="${LABEL}" style="color: var(--color-text-muted);">Name</label>
            <input formControlName="name" class="sf-input" data-testid="dialog-name" />
          </div>
          <div>
            <label class="${LABEL}" style="color: var(--color-text-muted);">Genre</label>
            <select formControlName="genre" class="sf-select" data-testid="dialog-genre">
              <option value="" disabled>Select a genre…</option>
              @for (g of genreOptions(); track g) {
                <option [value]="g">{{ g }}</option>
              }
            </select>
          </div>
          @if (candidate().sub_mode) {
            <div>
              <label class="${LABEL}" style="color: var(--color-text-muted);">Sub-mode</label>
              <input formControlName="subMode" class="sf-input" data-testid="dialog-submode" />
              <p class="text-xs mt-1" style="color: var(--color-text-muted);">
                Detected from the search that found this channel — not saved; sub-mode isn't part of the add-creator API yet.
              </p>
            </div>
          }
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="${LABEL}" style="color: var(--color-text-muted);">Language (optional)</label>
              <select formControlName="language" class="sf-select" data-testid="dialog-language">
                <option value="">Any / unspecified</option>
                @for (l of languageOptions(); track l.code) {
                  <option [value]="l.code">{{ l.name }}</option>
                }
              </select>
            </div>
            <div>
              <label class="${LABEL}" style="color: var(--color-text-muted);">Twitch handle (optional)</label>
              <input formControlName="twitch" placeholder="handle" class="sf-input" data-testid="dialog-twitch" />
            </div>
          </div>
          <div>
            <label class="${LABEL}" style="color: var(--color-text-muted);">Bio</label>
            <textarea formControlName="bio" rows="2" class="sf-input" data-testid="dialog-bio"></textarea>
          </div>
          <div>
            <label class="${LABEL}" style="color: var(--color-text-muted);">Color (optional)</label>
            <input formControlName="color" placeholder="#8b5cf6" class="sf-input" data-testid="dialog-color" />
          </div>
        } @else {
          <div>
            <label class="${LABEL}" style="color: var(--color-text-muted);">Creator ID</label>
            <input formControlName="creatorId" type="number" class="sf-input" data-testid="dialog-creator-id" />
            <p class="text-xs mt-1" style="color: var(--color-text-muted);">
              @if (candidate().matched_creator_id) {
                Prefilled from an automatic name match — verify before linking.
              } @else {
                No automatic match — enter the roster creator's id to link YouTube to it.
              }
            </p>
          </div>
        }

        @if (error()) {
          <p class="text-sm" style="color: var(--color-sf-red);" data-testid="dialog-error">{{ error() }}</p>
        }

        <div class="flex justify-end gap-2 mt-2">
          <button type="button" (click)="cancelled.emit()" class="sf-btn sf-btn-ghost" data-testid="dialog-cancel">Cancel</button>
          <button type="submit" [disabled]="busy()" class="sf-btn sf-btn-primary" data-testid="dialog-submit">
            {{ busy() ? 'Working…' : (mode() === 'add' ? 'Add creator' : 'Link creator') }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class DiscoveryAddDialogComponent {
  private fb = inject(FormBuilder);
  private svc = inject(AdminCreatorService);
  private creators = inject(CreatorsService);

  readonly candidate = input.required<DiscoveredChannel>();
  readonly mode = input.required<'add' | 'link'>();
  readonly done = output<void>();
  readonly cancelled = output<void>();

  readonly genreOptions = computed(() => Object.keys(this.creators.submodesByGenre()).sort());
  readonly languageOptions = computed(() =>
    [...this.creators.languages()].sort((a, b) => a.name.localeCompare(b.name)));

  readonly form = this.fb.nonNullable.group({
    name: '',
    genre: '',
    // Display-only provenance: shows the sub-mode the candidate was found
    // under, but it is NOT submitted — admin-add-creator has no sub_mode
    // field (the backend deliberately writes '' on insert). Disabled so the
    // admin can't edit a value that would be silently discarded.
    subMode: { value: '', disabled: true },
    language: '',
    bio: '',
    twitch: '',
    color: '',
    creatorId: this.fb.control<number | null>(null),
  });

  readonly error = signal<string | null>(null);
  readonly busy = signal(false);

  constructor() {
    // Prefill once the required inputs land (effects run after Angular applies
    // the initial input bindings, so `candidate()` is safe to read here).
    effect(() => {
      const c = this.candidate();
      this.form.patchValue({
        name: c.name,
        genre: c.genre,
        subMode: c.sub_mode,
        language: c.language ?? '',
        bio: c.bio,
        creatorId: c.matched_creator_id,
      });
    });
  }

  async onSubmit(): Promise<void> {
    this.error.set(null);
    const v = this.form.getRawValue();
    const c = this.candidate();

    if (this.mode() === 'add') {
      if (!v.name.trim() || !v.genre) {
        this.error.set('Enter a name and pick a genre.');
        return;
      }
      const twitch = v.twitch.trim();
      const input: AddCreatorInput = {
        name: v.name.trim(),
        genre: v.genre,
        platforms: { youtube: this.youtubeHandle(c), ...(twitch ? { twitch } : {}) },
        ...(v.bio.trim() ? { bio: v.bio.trim() } : {}),
        ...(v.language ? { language: v.language } : {}),
        ...(v.color.trim() ? { color: v.color.trim() } : {}),
        statsSeed: seedFrom(c),
      };
      this.busy.set(true);
      try {
        await this.svc.addCreators([input]);
        this.done.emit();
      } catch (err) {
        this.error.set(this.errorMessage(err, 'Add failed'));
      } finally {
        this.busy.set(false);
      }
    } else {
      if (!v.creatorId) {
        this.error.set('Enter a creator ID to link to.');
        return;
      }
      this.busy.set(true);
      try {
        await this.svc.attachPlatform({
          creatorId: v.creatorId,
          platform: 'youtube',
          handle: this.youtubeHandle(c),
          statsSeed: seedFrom(c),
        });
        this.done.emit();
      } catch (err) {
        this.error.set(this.errorMessage(err, 'Link failed'));
      } finally {
        this.busy.set(false);
      }
    }
  }

  /** YouTube handles are stored bare (no leading @); channel_id is the
   *  guaranteed fallback for the rare candidate with no public handle. */
  private youtubeHandle(c: DiscoveredChannel): string {
    return c.handle || c.channel_id;
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
