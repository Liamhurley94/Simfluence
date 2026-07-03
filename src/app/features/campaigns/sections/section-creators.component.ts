import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import { FEATURES } from '../../../core/features';
import { CreatorsService } from '../../../core/creators/creators.service';
import { Creator } from '../../../core/data/creator.types';
import { Campaign } from '../../../core/campaigns/campaign.types';
import { MatchedCreator } from '../../../core/creator-matcher/creator-matcher.service';
import { BrowseCreatorsModalComponent } from './browse-creators-modal.component';
import { CreatorMatcherPanelComponent } from '../creator-matcher/creator-matcher-panel.component';

@Component({
  selector: 'app-section-creators',
  standalone: true,
  imports: [BrowseCreatorsModalComponent, CreatorMatcherPanelComponent],
  template: `
    <section
      class="sf-panel p-5"
      data-testid="section-creators"
    >
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 class="text-xs uppercase tracking-wider font-bold" style="color: var(--color-text-muted);">
          Creators ({{ campaignCreators.records().length }})
        </h2>
        <button
          type="button"
          (click)="openBrowse()"
          [disabled]="readonly()"
          class="sf-btn sf-btn-ghost text-xs disabled:opacity-40"
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
                <span class="sf-chip">
                  {{ sourceLabel(cc.source) }}
                </span>
                <button
                  type="button"
                  (click)="remove(cc.id)"
                  [disabled]="readonly()"
                  class="sf-btn text-[10px] disabled:opacity-40"
                  style="background: transparent; border-color: var(--color-sf-red); color: var(--color-sf-red);"
                  [attr.data-testid]="'campaign-creator-remove-' + cc.id"
                >
                  Remove
                </button>
              </div>
            </li>
          }
        </ul>
      }

      <!-- Creator Matcher — planning-only auto creator-selector. Gated on a
           genre + budget being set (backend needs the genre; budget drives the
           budget-fill). See simfluence-backend/docs/superpowers/specs/
           2026-07-03-creator-matcher-design.md §5. -->
      @if (showMatcher()) {
        <app-creator-matcher-panel
          [genre]="campaign().genre!"
          [budget]="campaign().budget"
          [objectives]="campaign().objectives"
          [excludeIds]="existingCreatorIdList()"
          [disabled]="readonly()"
          (add)="onMatcherAdd($event)"
        />
      } @else if (matcherNeedsSettings()) {
        <div
          class="mt-2 p-4 rounded-lg text-xs text-center"
          style="background: var(--color-bg-3); color: var(--color-text-muted);"
          data-testid="matcher-need-settings"
        >
          Set a genre and budget to get creator suggestions.
        </div>
      }
    </section>
  `,
})
export class SectionCreatorsComponent {
  protected campaignCreators = inject(CampaignCreatorsService);
  private creatorsSvc = inject(CreatorsService);

  readonly campaign = input.required<Campaign>();
  readonly readonly = input(false);

  protected readonly creatorById = signal<Map<number, Creator>>(new Map());
  protected readonly browseOpen = signal(false);

  protected readonly existingCreatorIds = computed(
    () => new Set(this.campaignCreators.records().map((r) => r.creatorId)),
  );
  protected readonly existingCreatorIdList = computed(
    () => this.campaignCreators.records().map((r) => r.creatorId),
  );

  // The Matcher only makes sense while planning and needs a genre + budget to
  // produce a meaningful shortlist (§5.2). Otherwise show a lightweight prompt.
  protected readonly showMatcher = computed(() => {
    const c = this.campaign();
    return FEATURES.creatorMatcher && c.status === 'planning' && !!c.genre && c.budget != null;
  });
  protected readonly matcherNeedsSettings = computed(() => {
    const c = this.campaign();
    return FEATURES.creatorMatcher && c.status === 'planning' && (!c.genre || c.budget == null);
  });

  constructor() {
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

  /** Add a Matcher-suggested creator to the roster (source: 'auto_match'). */
  async onMatcherAdd(m: MatchedCreator): Promise<void> {
    await this.campaignCreators.add({
      campaignId: this.campaign().id,
      creatorId: m.creator.id,
      source: 'auto_match',
      cpiAtAdd: m.best_cpi ?? null,
      rateEstimate: this.rateMidpoint(m),
    });
  }

  /** Midpoint of the mixed-format rate range (the stored single-number estimate). */
  private rateMidpoint(m: MatchedCreator): number | null {
    const mix = m.rateEstimate?.ranges?.mix;
    if (!mix || mix.length !== 2) return null;
    return Math.round((mix[0] + mix[1]) / 2);
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

  protected sourceLabel(source: string): string {
    switch (source) {
      case 'persona_suggestion': return 'Suggested';
      case 'auto_match': return 'Matched';
      case 'manual': return 'Manual';
      default: return source;
    }
  }
}
