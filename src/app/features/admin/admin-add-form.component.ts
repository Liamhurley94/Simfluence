import { Component, computed, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminCreatorService } from '../../core/admin/admin-creator.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { AddCreatorInput } from '../../core/admin/admin-creator.types';
import { edgeErrorMessage } from '../../core/api/edge-error';

const LABEL = 'text-[10px] uppercase tracking-wider mb-1 block';

/** The manual add-creator form (Twitch-only creators / known handles). Lives in
 *  the "Add creators" tab's Manual sub-view; extracted unchanged from the old
 *  Creators-tab form. Emits (added) so hosts can refresh whatever they show. */
@Component({
  selector: 'app-admin-add-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
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
      @if (warning()) {
        <p class="text-sm" style="color: var(--color-sf-gold);" data-testid="add-warning">{{ warning() }}</p>
      }

      <div class="flex justify-end">
        <button type="submit" [disabled]="busy()" class="sf-btn sf-btn-primary" data-testid="add-submit">
          {{ busy() ? 'Adding…' : 'Add creator' }}
        </button>
      </div>
    </form>
  `,
})
export class AdminAddFormComponent {
  private fb = inject(FormBuilder);
  private svc = inject(AdminCreatorService);
  private creators = inject(CreatorsService);

  readonly added = output<void>();

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
  readonly warning = signal<string | null>(null);
  readonly busy = signal(false);

  async onSubmit(): Promise<void> {
    this.error.set(null);
    this.success.set(null);
    this.warning.set(null);
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
      const res = await this.svc.addCreators([input]);
      this.success.set(`Added ${res.created.map((c) => c.name).join(', ')}.`);
      const failed = Object.entries(res.kicks ?? {}).filter(([, s]) => s === 'failed').map(([k]) => k);
      this.warning.set(failed.length
        ? `Background sync failed (${failed.join(', ')}) – stats will self-heal overnight, or use Sync unsynced on the Creators tab.`
        : null);
      this.form.reset();
      this.added.emit();
    } catch (err) {
      this.error.set(edgeErrorMessage(err, 'Add failed'));
    } finally {
      this.busy.set(false);
    }
  }
}
