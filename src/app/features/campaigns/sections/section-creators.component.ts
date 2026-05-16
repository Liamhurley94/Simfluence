import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import {
  CampaignSuggestionGroup,
  CampaignSuggestion,
  CampaignSuggestionsService,
} from '../../../core/campaigns/campaign-suggestions.service';
import { CreatorsService } from '../../../core/creators/creators.service';
import { Creator } from '../../../core/data/creator.types';
import { Campaign } from '../../../core/campaigns/campaign.types';
import { BrowseCreatorsModalComponent } from './browse-creators-modal.component';

interface MatchBand {
  label: string;
  color: string;
}

@Component({
  selector: 'app-section-creators',
  standalone: true,
  imports: [BrowseCreatorsModalComponent],
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
        <button
          type="button"
          (click)="openBrowse()"
          [disabled]="readonly()"
          class="text-xs px-3 py-1.5 rounded disabled:opacity-40"
          style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text);"
          data-testid="creators-browse"
        >
          Browse all
        </button>
      </div>

      @if (browseOpen()) {
        <app-browse-creators-modal
          [campaignGenre]="campaign().genre ?? null"
          [existingCreatorIds]="existingCreatorIds()"
          (close)="browseOpen.set(false)"
          (add)="addFromBrowse($event)"
        />
      }

      @if (campaignCreators.records().length > 0) {
        <ul class="space-y-2 mb-4">
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
                  [disabled]="readonly()"
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

      <!-- Persona-grouped suggestions: always visible (auto-loads when genre set) -->
      <div class="mt-2">
        <div
          class="text-[10px] uppercase tracking-wider mb-3 flex items-center gap-2"
          style="color: var(--color-text-muted);"
        >
          <span>Audience-aligned suggestions</span>
          @if (loadingSuggestions()) {
            <span data-testid="suggestions-loading">· loading…</span>
          }
        </div>

        @if (!campaign().genre) {
          <div
            class="p-6 rounded-lg text-xs text-center"
            style="background: var(--color-bg-3); color: var(--color-text-muted);"
            data-testid="suggestions-need-genre"
          >
            Set a campaign genre above to see audience-matched creator suggestions.
          </div>
        } @else if (!loadingSuggestions() && groups().length === 0) {
          <div
            class="p-6 rounded-lg text-xs text-center"
            style="background: var(--color-bg-3); color: var(--color-text-muted);"
            data-testid="suggestions-empty"
          >
            No persona matches for this genre yet. Try "Browse all" to pick creators directly.
          </div>
        } @else {
          <div
            class="grid gap-4"
            style="grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));"
            data-testid="suggestion-groups"
          >
            @for (g of groups(); track g.persona.name; let idx = $index) {
              <article
                class="rounded-xl p-5 relative overflow-hidden"
                [style.background]="'var(--color-bg-3)'"
                [style.border]="idx === 0 ? '2px solid ' + g.persona.color : '1px solid var(--color-border)'"
                [attr.data-testid]="'persona-group-' + slugify(g.persona.name)"
              >
                <!-- Match band badge -->
                <div
                  class="absolute top-3 right-3 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded"
                  [style.background]="bandFor(g.personaScore).color + '22'"
                  [style.color]="bandFor(g.personaScore).color"
                  [style.border]="'1px solid ' + bandFor(g.personaScore).color + '44'"
                  [attr.data-testid]="'persona-band-' + slugify(g.persona.name)"
                >
                  {{ bandFor(g.personaScore).label }}
                </div>

                <!-- Icon -->
                <div class="text-3xl mb-3" aria-hidden="true">{{ g.persona.icon }}</div>

                <!-- Name + demographics -->
                <div
                  class="text-base font-bold mb-1"
                  [style.color]="g.persona.color"
                >
                  {{ g.persona.name }}
                </div>
                <div
                  class="text-[10px] uppercase tracking-wider mb-3"
                  style="color: var(--color-text-muted);"
                >
                  {{ g.persona.demo }}
                </div>

                <!-- Description -->
                <p
                  class="text-xs leading-relaxed mb-4"
                  style="color: var(--color-text);"
                >
                  {{ g.persona.desc }}
                </p>

                <!-- Match progress bar -->
                <div class="mb-4">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                      Campaign match
                    </span>
                    <span
                      class="text-[11px] font-bold"
                      [style.color]="bandFor(g.personaScore).color"
                      [attr.data-testid]="'persona-score-' + slugify(g.persona.name)"
                    >
                      {{ g.personaScore }}%
                    </span>
                  </div>
                  <div class="h-1 rounded overflow-hidden" style="background: var(--color-bg-2);">
                    <div
                      class="h-full transition-all"
                      [style.width.%]="g.personaScore"
                      [style.background]="bandFor(g.personaScore).color"
                    ></div>
                  </div>
                </div>

                <!-- Purchase + Brand fit grid -->
                <div class="grid grid-cols-2 gap-2 mb-4">
                  <div class="rounded p-2" style="background: var(--color-bg-2); border: 1px solid var(--color-border);">
                    <div class="text-[8px] uppercase tracking-wider mb-1" style="color: var(--color-text-muted);">
                      Purchase behaviour
                    </div>
                    <div class="text-[11px] leading-snug" style="color: var(--color-text);">
                      {{ g.persona.purchase }}
                    </div>
                  </div>
                  <div class="rounded p-2" style="background: var(--color-bg-2); border: 1px solid var(--color-border);">
                    <div class="text-[8px] uppercase tracking-wider mb-1" style="color: var(--color-text-muted);">
                      Brand fit
                    </div>
                    <div class="text-[11px] leading-snug" style="color: var(--color-text);">
                      {{ g.persona.brands }}
                    </div>
                  </div>
                </div>

                <!-- CTA callout -->
                <div
                  class="rounded px-3 py-2 mb-4"
                  [style.background]="g.persona.color + '15'"
                  [style.border]="'1px solid ' + g.persona.color + '33'"
                >
                  <div
                    class="text-[8px] uppercase tracking-wider mb-0.5"
                    [style.color]="g.persona.color"
                  >
                    Suggested CTA
                  </div>
                  <div
                    class="text-xs font-semibold"
                    [style.color]="g.persona.color"
                  >
                    {{ g.persona.cta }}
                  </div>
                </div>

                <!-- Matched creators -->
                <div class="text-[8px] uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">
                  Matched creators
                </div>
                <div class="flex flex-col gap-1.5">
                  @for (s of g.creators; track s.creator.id) {
                    <div
                      class="flex items-center gap-2.5 p-2 rounded"
                      style="background: var(--color-bg-2);"
                      [attr.data-testid]="'suggest-' + s.creator.id"
                    >
                      <div
                        class="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                        [style.background]="s.creator.color + '22'"
                        [style.color]="s.creator.color"
                      >
                        {{ initialsOf(s.creator.name) }}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="text-xs font-semibold truncate" style="color: var(--color-text);">
                          {{ s.creator.name }}
                        </div>
                        <div class="text-[9px] truncate" style="color: var(--color-text-muted);">
                          {{ '@' + (s.creator.handle || '—') }} · {{ s.creator.platform }} · {{ s.creator.subs }}
                        </div>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <div class="text-center">
                          <div class="text-[8px]" style="color: var(--color-text-muted);">CPI</div>
                          <div class="text-sm font-bold" [style.color]="cpiColor(s.creator.cpi)">{{ s.creator.cpi }}</div>
                        </div>
                        @if (s.gfi !== null) {
                          <div class="text-center">
                            <div class="text-[8px]" style="color: var(--color-text-muted);">GFI</div>
                            <div
                              class="text-xs font-bold px-1.5 rounded text-white"
                              [style.background]="bandFor(s.gfi).color"
                            >
                              {{ s.gfi }}%
                            </div>
                          </div>
                        }
                      </div>
                      @if (existingCreatorIds().has(s.creator.id)) {
                        <span
                          class="text-[9px] uppercase tracking-wider px-2 py-1 rounded shrink-0"
                          style="background: var(--color-bg-3); color: var(--color-text-muted);"
                          data-testid="suggest-added-badge"
                        >
                          Added
                        </span>
                      } @else {
                        <button
                          type="button"
                          (click)="acceptSuggestion(s, g.persona.name)"
                          [disabled]="readonly()"
                          class="text-[9px] uppercase tracking-wider px-2.5 py-1 rounded shrink-0 disabled:opacity-40"
                          style="background: rgba(0,80,255,0.12); border: 1px solid rgba(0,80,255,0.3); color: #6B9FFF;"
                          [attr.data-testid]="'suggest-add-' + s.creator.id"
                        >
                          + Add
                        </button>
                      }
                    </div>
                  }
                </div>
              </article>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class SectionCreatorsComponent {
  protected campaignCreators = inject(CampaignCreatorsService);
  private creatorsSvc = inject(CreatorsService);
  private suggestionsSvc = inject(CampaignSuggestionsService);

  readonly campaign = input.required<Campaign>();
  readonly readonly = input(false);

  protected readonly creatorById = signal<Map<number, Creator>>(new Map());
  protected readonly groups = signal<CampaignSuggestionGroup[]>([]);
  protected readonly loadingSuggestions = signal(false);
  protected readonly browseOpen = signal(false);
  private readonly skipped = signal<Set<number>>(new Set());

  protected readonly existingCreatorIds = computed(
    () => new Set(this.campaignCreators.records().map((r) => r.creatorId)),
  );

  // Only inputs that actually change persona scoring should re-trigger a
  // refetch — not every campaign mutation. Stringify keeps signal equality
  // straightforward.
  private readonly suggestionsKey = computed(() => {
    const c = this.campaign();
    if (!c.genre) return '';
    return `${c.id}|${c.genre}|${(c.objectives ?? []).join(',')}`;
  });

  constructor() {
    // Auto-fetch suggestions on mount + whenever genre/objectives change.
    effect(() => {
      const key = this.suggestionsKey();
      if (!key) {
        this.groups.set([]);
        return;
      }
      void this.loadSuggestions();
    });

    // Hydrate creator info for the "added creators" list.
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

  private async loadSuggestions(): Promise<void> {
    this.loadingSuggestions.set(true);
    try {
      const fetched = await this.suggestionsSvc.suggest(this.campaign().id);
      const skipped = this.skipped();
      const filtered = fetched
        .map((g) => ({ ...g, creators: g.creators.filter((s) => !skipped.has(s.creator.id)) }))
        .filter((g) => g.creators.length > 0);
      this.groups.set(filtered);
    } finally {
      this.loadingSuggestions.set(false);
    }
  }

  async acceptSuggestion(s: CampaignSuggestion, personaName: string): Promise<void> {
    await this.campaignCreators.add({
      campaignId: this.campaign().id,
      creatorId: s.creator.id,
      source: 'persona_suggestion',
      cpiAtAdd: s.creator.cpi ?? null,
      notes: `Matched to "${personaName}" persona`,
    });
  }

  openBrowse(): void {
    this.browseOpen.set(true);
  }

  async addFromBrowse(creatorId: number): Promise<void> {
    await this.campaignCreators.add({
      campaignId: this.campaign().id,
      creatorId,
      source: 'manual',
    });
  }

  async remove(id: string): Promise<void> {
    await this.campaignCreators.remove(id);
  }

  /** Match band copy + colour. Mirrors prod's thresholds (85/70/55). */
  protected bandFor(score: number): MatchBand {
    if (score >= 85) return { label: 'Primary match', color: 'var(--color-sf-green)' };
    if (score >= 70) return { label: 'Strong fit',    color: 'var(--color-sf-green)' };
    if (score >= 55) return { label: 'Moderate fit',  color: 'var(--color-sf-orange)' };
    return { label: 'Partial fit', color: 'var(--color-sf-red)' };
  }

  protected cpiColor(cpi: number): string {
    if (cpi >= 80) return 'var(--color-sf-green)';
    if (cpi >= 60) return 'var(--color-sf-orange)';
    return 'var(--color-sf-red)';
  }

  protected slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  protected initialsOf(name: string): string {
    return (name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase();
  }
}
