import { Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Campaign, NewCampaign } from '../../core/campaigns/campaign.types';

@Component({
  selector: 'app-campaign-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div
      class="fixed inset-0 z-40 flex items-center justify-center p-6"
      style="background: rgba(0,0,0,0.65);"
      (click)="cancel.emit()"
      data-testid="campaign-form-backdrop"
    >
      <form
        [formGroup]="form"
        (ngSubmit)="onSubmit()"
        (click)="$event.stopPropagation()"
        class="max-w-lg w-full p-6 rounded-lg flex flex-col gap-3"
        style="background: var(--color-bg-2); border: 1px solid var(--color-border-strong);"
        data-testid="campaign-form"
      >
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-lg font-bold" style="color: var(--color-text);">
            {{ editing() ? 'Edit campaign' : 'New campaign' }}
          </h2>
          <button
            type="button"
            (click)="cancel.emit()"
            class="text-xs"
            style="color: var(--color-text-muted);"
            data-testid="campaign-form-close"
          >
            ✕
          </button>
        </div>

        <div>
          <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">
            Campaign name *
          </label>
          <input
            type="text"
            formControlName="name"
            placeholder="e.g. Nestlé Gaming Q3 2026"
            class="w-full px-3 py-2 rounded text-sm"
            style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
            data-testid="campaign-name"
          />
        </div>

        <div>
          <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">
            Client
          </label>
          <input
            type="text"
            formControlName="client"
            placeholder="e.g. Nestlé"
            class="w-full px-3 py-2 rounded text-sm"
            style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
            data-testid="campaign-client"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">
              Genre
            </label>
            <input
              type="text"
              formControlName="genre"
              class="w-full px-3 py-2 rounded text-sm"
              style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
              data-testid="campaign-genre"
            />
          </div>
          <div>
            <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">
              Budget (USD) *
            </label>
            <input
              type="number"
              min="0"
              formControlName="budget"
              class="w-full px-3 py-2 rounded text-sm"
              style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
              data-testid="campaign-budget"
            />
          </div>
        </div>

        <div>
          <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">
            Go-live date
          </label>
          <input
            type="date"
            formControlName="goLiveDate"
            class="w-full px-3 py-2 rounded text-sm"
            style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
            data-testid="campaign-golive"
          />
        </div>

        <div>
          <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">
            Notes
          </label>
          <textarea
            formControlName="notes"
            rows="3"
            placeholder="Campaign objectives, region, format…"
            class="w-full px-3 py-2 rounded text-sm"
            style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
            data-testid="campaign-notes"
          ></textarea>
        </div>

        @if (form.invalid && form.touched) {
          <div class="text-xs" style="color: var(--color-sf-red);" data-testid="campaign-form-error">
            Campaign name + budget (greater than zero) are required.
          </div>
        }

        <div class="flex gap-2 mt-2">
          <button
            type="button"
            (click)="cancel.emit()"
            class="flex-1 py-2 rounded text-sm"
            style="background: transparent; border: 1px solid var(--color-border); color: var(--color-text);"
            data-testid="campaign-form-cancel"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="flex-1 py-2 rounded text-sm font-semibold"
            style="background: var(--color-sf-blue); color: white;"
            data-testid="campaign-form-save"
          >
            {{ editing() ? 'Save changes' : 'Save campaign' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class CampaignFormComponent {
  private fb = inject(FormBuilder);

  readonly editing = input<Campaign | null>(null);
  /** Defaults applied when opening in "new" mode (e.g. pre-filled from Simulator). */
  readonly defaults = input<Partial<NewCampaign> | null>(null);

  readonly save = output<NewCampaign>();
  readonly cancel = output<void>();

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    client: [''],
    genre: [''],
    budget: [0, [Validators.required, Validators.min(1)]],
    goLiveDate: [''],
    notes: [''],
  });

  constructor() {
    effect(() => {
      const existing = this.editing();
      const seed = this.defaults();
      if (existing) {
        this.form.reset({
          name: existing.name,
          client: existing.client,
          genre: existing.genre,
          budget: existing.budget,
          goLiveDate: existing.goLiveDate ?? '',
          notes: existing.notes,
        });
      } else if (seed) {
        this.form.reset({
          name: seed.name ?? '',
          client: seed.client ?? '',
          genre: seed.genre ?? '',
          budget: seed.budget ?? 0,
          goLiveDate: seed.goLiveDate ?? '',
          notes: seed.notes ?? '',
        });
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const existing = this.editing();
    const defaults = this.defaults();

    this.save.emit({
      name: raw.name.trim(),
      client: raw.client.trim(),
      genre: raw.genre.trim(),
      budget: Number(raw.budget),
      goLiveDate: raw.goLiveDate ? raw.goLiveDate : null,
      notes: raw.notes.trim(),
      creatorIds: existing?.creatorIds ?? defaults?.creatorIds ?? [],
      forecast: existing?.forecast ?? defaults?.forecast ?? null,
    });
  }
}
