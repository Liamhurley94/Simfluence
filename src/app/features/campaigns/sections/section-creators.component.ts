import { Component, Input, computed, effect, inject, signal } from '@angular/core';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import { CampaignSuggestionsService, CampaignSuggestion } from '../../../core/campaigns/campaign-suggestions.service';
import { CreatorsService } from '../../../core/creators/creators.service';
import { Creator } from '../../../core/data/creator.types';
import { PersonasService } from '../../../core/personas/personas.service';
import { Persona } from '../../../core/data/persona.types';
import { Campaign } from '../../../core/campaigns/campaign.types';

@Component({
  selector: 'app-section-creators',
  standalone: true,
  template: `
    <section
      class="p-4 rounded-lg"
      style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
      data-testid="section-creators"
    >
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 class="text-xs uppercase tracking-wider font-bold" style="color: var(--color-text-muted);">
          Creators ({{ campaignCreators.records().length }})
        </h2>
        <div class="flex gap-2">
          <button
            type="button"
            (click)="loadSuggestions()"
            [disabled]="readonly || !campaign.genre || loadingSuggestions()"
            class="text-xs px-3 py-1.5 rounded disabled:opacity-40"
            style="background: var(--color-sf-purple, #7c5cff); color: white;"
            data-testid="creators-suggest"
          >
            {{ loadingSuggestions() ? 'Loading…' : 'Get suggestions' }}
          </button>
        </div>
      </div>

      @if (campaignCreators.records().length === 0 && suggestions().length === 0) {
        <p class="text-xs" style="color: var(--color-text-muted);">
          No creators yet. Click "Get suggestions" for persona-driven picks, or use the embedded discovery
          (coming in the next iteration) to browse and add.
        </p>
      }

      @if (suggestions().length > 0) {
        <div class="mb-4">
          <div class="text-[10px] uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">
            Suggested for "{{ campaign.genre }}"
          </div>
          <div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));">
            @for (s of suggestions(); track s.creator.id) {
              <article
                class="p-2 rounded"
                style="background: var(--color-bg-3); border: 1px solid var(--color-border);"
                [attr.data-testid]="'suggest-' + s.creator.id"
              >
                <div class="flex items-start justify-between gap-2 mb-1">
                  <div class="min-w-0">
                    <div class="text-xs font-bold truncate" style="color: var(--color-text);">{{ s.creator.name }}</div>
                    <div class="text-[10px] truncate" style="color: var(--color-text-muted);">
                      {{ '@' + (s.creator.handle || '—') }}
                    </div>
                  </div>
                  <div class="text-[10px] font-bold shrink-0" style="color: var(--color-sf-gold);">
                    GFI {{ s.gfi }}
                  </div>
                </div>
                @if (personaFor(s.creator.id); as p) {
                  <div class="text-[10px] mb-2" style="color: var(--color-text-muted);">
                    <span>{{ p.icon }}</span> {{ p.name }}
                  </div>
                }
                <div class="flex gap-1">
                  <button
                    type="button"
                    (click)="acceptSuggestion(s)"
                    [disabled]="readonly"
                    class="flex-1 px-2 py-1 rounded text-xs disabled:opacity-40"
                    style="background: var(--color-sf-blue); color: white;"
                    [attr.data-testid]="'suggest-add-' + s.creator.id"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    (click)="skipSuggestion(s)"
                    class="px-2 py-1 rounded text-xs"
                    style="background: transparent; border: 1px solid var(--color-border); color: var(--color-text-muted);"
                    [attr.data-testid]="'suggest-skip-' + s.creator.id"
                  >
                    Skip
                  </button>
                </div>
              </article>
            }
          </div>
        </div>
      }

      @if (campaignCreators.records().length > 0) {
        <ul class="space-y-2">
          @for (cc of campaignCreators.records(); track cc.id) {
            <li
              class="p-2 rounded flex items-center justify-between gap-3 text-xs"
              style="background: var(--color-bg-3);"
              [attr.data-testid]="'campaign-creator-' + cc.id"
            >
              <div class="min-w-0">
                @if (creatorById().get(cc.creatorId); as cr) {
                  <div class="font-semibold truncate" style="color: var(--color-text);">{{ cr.name }}</div>
                  <div class="text-[10px] truncate" style="color: var(--color-text-muted);">
                    {{ '@' + (cr.handle || '—') }} · {{ cr.genre || '—' }}
                  </div>
                } @else {
                  <div class="font-semibold" style="color: var(--color-text);">Creator #{{ cc.creatorId }}</div>
                }
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span
                  class="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style="background: var(--color-bg-2); color: var(--color-text-muted);"
                >
                  {{ cc.source }}
                </span>
                <button
                  type="button"
                  (click)="remove(cc.id)"
                  [disabled]="readonly"
                  class="text-[10px] px-1.5 py-1 rounded disabled:opacity-40"
                  style="background: transparent; border: 1px solid var(--color-sf-red); color: var(--color-sf-red);"
                  [attr.data-testid]="'campaign-creator-remove-' + cc.id"
                >
                  Remove
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class SectionCreatorsComponent {
  protected campaignCreators = inject(CampaignCreatorsService);
  private creatorsSvc = inject(CreatorsService);
  private suggestionsSvc = inject(CampaignSuggestionsService);
  private personasSvc = inject(PersonasService);

  @Input({ required: true }) campaign!: Campaign;
  @Input() readonly = false;

  protected readonly creatorById = signal<Map<number, Creator>>(new Map());
  protected readonly suggestions = signal<CampaignSuggestion[]>([]);
  protected readonly loadingSuggestions = signal(false);
  private readonly skipped = signal<Set<number>>(new Set());

  private readonly personas = computed<Persona[]>(() =>
    this.campaign.genre ? this.personasSvc.listFor(this.campaign.genre) : [],
  );

  constructor() {
    effect(async () => {
      const ids = this.campaignCreators.records().map((r) => r.creatorId);
      if (ids.length === 0) return;
      const known = this.creatorById();
      const missing = ids.filter((id) => !known.has(id));
      if (missing.length === 0) return;
      const fetched = await this.creatorsSvc.byIds(missing);
      const next = new Map(known);
      for (const cr of fetched) next.set(cr.id, cr);
      this.creatorById.set(next);
    });
  }

  async loadSuggestions(): Promise<void> {
    if (!this.campaign.genre) return;
    this.loadingSuggestions.set(true);
    try {
      const res = await this.suggestionsSvc.suggest(this.campaign.id, 8);
      const skipped = this.skipped();
      this.suggestions.set(res.filter((s) => !skipped.has(s.creator.id)));
    } finally {
      this.loadingSuggestions.set(false);
    }
  }

  async acceptSuggestion(s: CampaignSuggestion): Promise<void> {
    await this.campaignCreators.add({
      campaignId: this.campaign.id,
      creatorId: s.creator.id,
      source: 'persona_suggestion',
      cpiAtAdd: s.creator.cpi ?? null,
    });
    this.suggestions.update((list) => list.filter((x) => x.creator.id !== s.creator.id));
  }

  skipSuggestion(s: CampaignSuggestion): void {
    this.skipped.update((set) => new Set(set).add(s.creator.id));
    this.suggestions.update((list) => list.filter((x) => x.creator.id !== s.creator.id));
  }

  async remove(id: string): Promise<void> {
    await this.campaignCreators.remove(id);
  }

  /**
   * Round-robin assignment: nth suggestion gets the (n % personas.length)th persona.
   * Persona text is client-side reference data; this is just visual labeling.
   */
  protected personaFor(creatorId: number): Persona | null {
    const personas = this.personas();
    if (personas.length === 0) return null;
    const idx = this.suggestions().findIndex((s) => s.creator.id === creatorId);
    if (idx < 0) return null;
    return personas[idx % personas.length];
  }
}
