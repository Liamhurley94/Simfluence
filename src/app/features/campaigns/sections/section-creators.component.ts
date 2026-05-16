import { Component, Input, computed, effect, inject, signal } from '@angular/core';
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
        <div class="flex gap-2">
          <button
            type="button"
            (click)="openBrowse()"
            [disabled]="readonly"
            class="text-xs px-3 py-1.5 rounded disabled:opacity-40"
            style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text);"
            data-testid="creators-browse"
          >
            Browse
          </button>
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

      @if (campaignCreators.records().length === 0 && groups().length === 0) {
        <p class="text-xs" style="color: var(--color-text-muted);">
          No creators yet. Click "Get suggestions" for persona-driven picks, or "Browse" to search and add directly.
        </p>
      }

      @if (browseOpen()) {
        <app-browse-creators-modal
          [campaignGenre]="campaign.genre ?? null"
          [existingCreatorIds]="existingCreatorIds()"
          (close)="browseOpen.set(false)"
          (add)="addFromBrowse($event)"
        />
      }

      @if (groups().length > 0) {
        <div class="mb-4 space-y-4" data-testid="suggestion-groups">
          @for (g of groups(); track g.persona.name) {
            <article
              class="rounded-lg overflow-hidden"
              style="background: var(--color-bg-3); border: 1px solid var(--color-border);"
              [attr.data-testid]="'persona-group-' + slugify(g.persona.name)"
            >
              <header
                class="px-3 py-2 flex items-start gap-3"
                [style.borderLeft]="'4px solid ' + g.persona.color"
                style="background: var(--color-bg-2);"
              >
                <div class="text-2xl shrink-0" aria-hidden="true">{{ g.persona.icon }}</div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="text-sm font-bold" style="color: var(--color-text);">{{ g.persona.name }}</h3>
                    <span
                      class="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                      [style.background]="g.persona.color + '22'"
                      [style.color]="g.persona.color"
                      [attr.data-testid]="'persona-score-' + slugify(g.persona.name)"
                    >
                      Fit {{ g.personaScore }}
                    </span>
                  </div>
                  <p class="text-[10px] mt-0.5" style="color: var(--color-text-muted);">{{ g.persona.desc }}</p>
                  <div class="text-[10px] mt-1 italic" style="color: var(--color-sf-gold);">
                    {{ g.persona.cta }}
                  </div>
                </div>
              </header>

              <div
                class="grid gap-2 p-3"
                style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));"
              >
                @for (s of g.creators; track s.creator.id) {
                  <div
                    class="p-2 rounded"
                    style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
                    [attr.data-testid]="'suggest-' + s.creator.id"
                  >
                    <div class="flex items-start justify-between gap-2 mb-1">
                      <div class="min-w-0">
                        <div class="text-xs font-bold truncate" style="color: var(--color-text);">{{ s.creator.name }}</div>
                        <div class="text-[10px] truncate" style="color: var(--color-text-muted);">
                          {{ '@' + (s.creator.handle || '—') }}
                        </div>
                      </div>
                      <div class="text-[10px] font-bold shrink-0 text-right" style="color: var(--color-sf-gold);">
                        @if (s.gfi !== null) {
                          GFI {{ s.gfi }}
                        } @else {
                          GFI —
                        }
                      </div>
                    </div>
                    <div class="flex gap-1">
                      @if (existingCreatorIds().has(s.creator.id)) {
                        <span
                          class="flex-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded text-center"
                          style="background: var(--color-bg-3); color: var(--color-text-muted);"
                        >
                          Added
                        </span>
                      } @else {
                        <button
                          type="button"
                          (click)="acceptSuggestion(s, g.persona.name)"
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
                      }
                    </div>
                  </div>
                }
              </div>
            </article>
          }
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

  @Input({ required: true }) campaign!: Campaign;
  @Input() readonly = false;

  protected readonly creatorById = signal<Map<number, Creator>>(new Map());
  protected readonly groups = signal<CampaignSuggestionGroup[]>([]);
  protected readonly loadingSuggestions = signal(false);
  protected readonly browseOpen = signal(false);
  private readonly skipped = signal<Set<number>>(new Set());

  protected readonly existingCreatorIds = computed(
    () => new Set(this.campaignCreators.records().map((r) => r.creatorId)),
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
      const fetched = await this.suggestionsSvc.suggest(this.campaign.id);
      const skipped = this.skipped();
      // Drop creators the user already skipped from every group; drop
      // groups that become empty as a result.
      const filtered = fetched
        .map((g) => ({
          ...g,
          creators: g.creators.filter((s) => !skipped.has(s.creator.id)),
        }))
        .filter((g) => g.creators.length > 0);
      this.groups.set(filtered);
    } finally {
      this.loadingSuggestions.set(false);
    }
  }

  async acceptSuggestion(s: CampaignSuggestion, personaName: string): Promise<void> {
    await this.campaignCreators.add({
      campaignId: this.campaign.id,
      creatorId: s.creator.id,
      source: 'persona_suggestion',
      cpiAtAdd: s.creator.cpi ?? null,
      notes: `Matched to "${personaName}" persona`,
    });
    // Keep the suggestion visible — the Added badge replaces the buttons
    // (via existingCreatorIds()) so the user can see what they've added
    // without losing context of the persona grouping.
  }

  openBrowse(): void {
    this.browseOpen.set(true);
  }

  async addFromBrowse(creatorId: number): Promise<void> {
    await this.campaignCreators.add({
      campaignId: this.campaign.id,
      creatorId,
      source: 'manual',
    });
  }

  skipSuggestion(s: CampaignSuggestion): void {
    this.skipped.update((set) => new Set(set).add(s.creator.id));
    this.groups.update((groups) =>
      groups
        .map((g) => ({ ...g, creators: g.creators.filter((x) => x.creator.id !== s.creator.id) }))
        .filter((g) => g.creators.length > 0),
    );
  }

  async remove(id: string): Promise<void> {
    await this.campaignCreators.remove(id);
  }

  protected slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}
