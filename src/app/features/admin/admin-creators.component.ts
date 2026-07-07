import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminCreatorService } from '../../core/admin/admin-creator.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { AddCreatorInput, AddedCreator, OfflineCreator } from '../../core/admin/admin-creator.types';

const LABEL = 'text-[10px] uppercase tracking-wider mb-1 block';

@Component({
  selector: 'app-admin-creators',
  standalone: true,
  imports: [ReactiveFormsModule],
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
            <input formControlName="language" class="sf-input" />
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

  constructor() {
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
    } catch (err) {
      this.listError.set(this.errorMessage(err, 'Failed to load creators'));
    } finally {
      this.listLoading.set(false);
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
