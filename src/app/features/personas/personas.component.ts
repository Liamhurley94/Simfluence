import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { CampaignContextService } from '../../core/context/campaign-context.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { PersonasService } from '../../core/personas/personas.service';
import { SelectionService } from '../../core/selection/selection.service';
import { Persona } from '../../core/data/persona.types';

const AUTO_SELECT_COUNTS = [5, 10, 25, 50, 100, 250];

@Component({
  selector: 'app-personas',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold" style="color: var(--color-text);">Personas</h1>
      <div class="flex items-center gap-3">
        <label class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">
          Genre
        </label>
        <select
          [ngModel]="context.genre()"
          (ngModelChange)="context.genre.set($event)"
          class="px-3 py-2 rounded text-sm"
          style="background: var(--color-bg-2); border: 1px solid var(--color-border); color: var(--color-text);"
          data-testid="personas-genre"
        >
          @for (g of genres; track g) {
            <option [ngValue]="g">{{ g }}</option>
          }
        </select>
      </div>
    </div>

    @if (selected(); as p) {
      <div
        class="p-4 mb-4 rounded-lg flex items-center justify-between"
        style="background: rgba(255,212,0,0.08); border: 1px solid var(--color-sf-gold);"
        data-testid="recommendation-banner"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="text-3xl shrink-0">{{ p.icon }}</div>
          <div class="min-w-0">
            <div class="text-[10px] uppercase tracking-wider" style="color: var(--color-sf-gold);">
              Recommended persona
            </div>
            <div class="text-lg font-bold truncate" style="color: var(--color-text);">
              {{ p.name }}
            </div>
            <div class="text-xs" style="color: var(--color-text-muted);">{{ p.cta }}</div>
          </div>
        </div>
        <button
          type="button"
          (click)="simulate()"
          class="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider shrink-0 ml-4"
          style="background: var(--color-sf-gold); color: #000;"
          data-testid="simulate-this-campaign"
        >
          Simulate this campaign →
        </button>
      </div>
    }

    <div
      class="p-4 mb-6 rounded-lg flex items-center gap-3 flex-wrap"
      style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
      data-testid="auto-select-bar"
    >
      <div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">
        Auto-select shortlist
      </div>
      <select
        [ngModel]="autoCount()"
        (ngModelChange)="autoCount.set($event)"
        class="px-3 py-2 rounded text-sm"
        style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text);"
        data-testid="auto-select-count"
      >
        @for (c of counts; track c) {
          <option [ngValue]="c">{{ c }}</option>
        }
      </select>
      <button
        type="button"
        (click)="runAutoSelect()"
        class="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider"
        style="background: var(--color-sf-blue); color: white;"
        data-testid="auto-select-run"
      >
        ⚡ Auto-select {{ autoCount() }} creators
      </button>
      <div class="text-xs ml-auto" style="color: var(--color-text-muted);" data-testid="selection-count">
        {{ selection.count() }} currently selected
      </div>
    </div>

    @if (personas().length === 0) {
      <div
        class="p-12 rounded-lg text-center"
        style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
        data-testid="personas-empty"
      >
        <div class="text-sm font-semibold mb-2" style="color: var(--color-text);">
          No personas defined for this genre yet
        </div>
        <p class="text-xs" style="color: var(--color-text-muted);">
          Pick another genre above to see persona archetypes.
        </p>
      </div>
    } @else {
      <div
        class="grid gap-4"
        style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));"
        data-testid="personas-grid"
      >
        @for (p of personas(); track p.name) {
          <article
            class="p-5 rounded-lg cursor-pointer transition"
            [style.background]="'var(--color-bg-2)'"
            [style.border]="selectedName() === p.name ? '2px solid ' + p.color : '1px solid var(--color-border)'"
            (click)="select(p)"
            [attr.data-testid]="'persona-' + slug(p.name)"
          >
            <div class="flex items-start gap-3 mb-3">
              <div class="text-3xl shrink-0">{{ p.icon }}</div>
              <div class="min-w-0">
                <div class="font-bold text-base" [style.color]="p.color">{{ p.name }}</div>
                <div class="text-[10px] uppercase tracking-wider mt-0.5" style="color: var(--color-text-muted);">
                  {{ p.demo }}
                </div>
              </div>
            </div>

            <p class="text-xs mb-3 leading-relaxed" style="color: var(--color-text);">
              {{ p.desc }}
            </p>

            <div class="grid gap-2 mb-3">
              <div>
                <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                  Purchase behaviour
                </div>
                <div class="text-xs" style="color: var(--color-text);">{{ p.purchase }}</div>
              </div>
              <div>
                <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                  Brand fit
                </div>
                <div class="text-xs" style="color: var(--color-text);">{{ p.brands }}</div>
              </div>
            </div>

            <div class="flex flex-wrap gap-1 mb-3">
              @for (t of p.traits; track t) {
                <span
                  class="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style="background: var(--color-bg-3); color: var(--color-text-muted);"
                >
                  {{ t }}
                </span>
              }
            </div>

            <div
              class="text-xs italic pt-3 border-t"
              style="border-color: var(--color-border); color: var(--color-sf-gold);"
            >
              "{{ p.cta }}"
            </div>
          </article>
        }
      </div>
    }
  `,
})
export class PersonasComponent {
  private personasSvc = inject(PersonasService);
  private creatorsSvc = inject(CreatorsService);
  private router = inject(Router);
  protected selection = inject(SelectionService);
  protected context = inject(CampaignContextService);

  protected readonly genres = this.creatorsSvc.genres();
  protected readonly counts = AUTO_SELECT_COUNTS;
  protected readonly autoCount = signal<number>(25);
  protected readonly selectedName = signal<string | null>(null);

  protected readonly personas = computed(() =>
    this.personasSvc.listFor(this.context.genre(), this.context.subMode() || undefined),
  );

  protected readonly selected = computed<Persona | null>(() => {
    const name = this.selectedName();
    if (!name) return null;
    return this.personas().find((p) => p.name === name) ?? null;
  });

  select(p: Persona): void {
    this.selectedName.set(this.selectedName() === p.name ? null : p.name);
  }

  runAutoSelect(): void {
    const picks = this.personasSvc.autoSelect(this.context.genre(), this.autoCount());
    this.selection.clear();
    for (const c of picks) this.selection.add(c.id);
  }

  simulate(): void {
    if (this.selection.count() === 0) {
      this.runAutoSelect();
    }
    void this.router.navigateByUrl('/app/simulator');
  }

  slug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
}
