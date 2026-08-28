import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import { CampaignDeliverablesService } from '../../../core/campaigns/campaign-deliverables.service';
import { FEATURES } from '../../../core/features';
import { CreatorsService } from '../../../core/creators/creators.service';
import { CreatorProfileService } from '../../../core/creator-profile/creator-profile.service';
import { Creator } from '../../../core/data/creator.types';
import { Campaign } from '../../../core/campaigns/campaign.types';
import { CampaignCreator } from '../../../core/campaigns/campaign-creators.types';
import { DeliverablePlatform } from '../../../core/campaigns/campaign-deliverables.types';
import { MatchedCreator } from '../../../core/creator-matcher/creator-matcher.service';
import { BrowseCreatorsModalComponent } from './browse-creators-modal.component';
import { CreatorMatcherPanelComponent } from '../creator-matcher/creator-matcher-panel.component';
import { DeliverableEditorComponent } from './deliverable-editor.component';

@Component({
  selector: 'app-section-creators',
  standalone: true,
  imports: [BrowseCreatorsModalComponent, CreatorMatcherPanelComponent, DeliverableEditorComponent],
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
          [disabled]="editingLocked()"
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
              class="p-2 rounded text-xs cursor-pointer"
              style="background: var(--color-bg-3);"
              (click)="openProfile(cc.creatorId)"
              [attr.data-testid]="'campaign-creator-' + cc.id"
            >
              <div class="flex items-center justify-between gap-3">
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
                    (click)="remove(cc.id); $event.stopPropagation()"
                    [disabled]="editingLocked()"
                    class="sf-btn text-[10px] disabled:opacity-40"
                    style="background: transparent; border-color: var(--color-sf-red); color: var(--color-sf-red);"
                    [attr.data-testid]="'campaign-creator-remove-' + cc.id"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <app-deliverable-editor
                (click)="$event.stopPropagation()"
                [campaignCreator]="cc"
                [creator]="creatorById().get(cc.creatorId) ?? null"
                [disabled]="editingLocked()"
              />
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
          [campaignId]="campaign().id"
          [disabled]="editingLocked()"
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
  private deliverables = inject(CampaignDeliverablesService);
  private creatorsSvc = inject(CreatorsService);
  private profile = inject(CreatorProfileService);

  readonly campaign = input.required<Campaign>();
  readonly readonly = input(false);
  // Locks manual roster editing (Browse/Remove) + hides the Matcher once the
  // campaign leaves "planning". Distinct from `readonly` (completed/archived):
  // an active campaign's roster is frozen but its detail is still viewable.
  readonly rosterLocked = input(false);

  protected readonly creatorById = signal<Map<number, Creator>>(new Map());
  protected readonly browseOpen = signal(false);

  // Manual add/remove is disabled when the campaign is fully readonly OR its
  // roster is locked (past planning).
  protected readonly editingLocked = computed(() => this.readonly() || this.rosterLocked());

  protected readonly existingCreatorIds = computed(
    () => new Set(this.campaignCreators.records().map((r) => r.creatorId)),
  );
  protected readonly existingCreatorIdList = computed(
    () => this.campaignCreators.records().map((r) => r.creatorId),
  );

  // The Matcher only makes sense while planning and needs a genre + budget to
  // produce a meaningful shortlist (§5.2). Otherwise show a lightweight prompt.
  // Also hidden when the roster is locked (redundant with the planning check,
  // but explicit so locking can't leak the panel).
  protected readonly showMatcher = computed(() => {
    const c = this.campaign();
    return (
      FEATURES.creatorMatcher &&
      !this.rosterLocked() &&
      c.status === 'planning' &&
      !!c.genre &&
      c.budget != null
    );
  });
  protected readonly matcherNeedsSettings = computed(() => {
    const c = this.campaign();
    return (
      FEATURES.creatorMatcher &&
      !this.rosterLocked() &&
      c.status === 'planning' &&
      (!c.genre || c.budget == null)
    );
  });

  constructor() {
    // Load each roster row's deliverables whenever the roster changes. Kept
    // as its own effect, separate from creator hydration below: that effect
    // both reads and writes `creatorById`, so it re-runs on every hydration
    // retry, not just on a real roster change — bundling `loadFor` into it
    // would re-fire a deliverables reload on every one of those retries too.
    effect(() => {
      const ids = this.campaignCreators.records().map((r) => r.id);
      void this.deliverables.loadFor(ids);
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

  /** Add a Matcher-suggested creator to the roster (source: 'auto_match'). */
  async onMatcherAdd(m: MatchedCreator): Promise<void> {
    const created = await this.campaignCreators.add({
      campaignId: this.campaign().id,
      creatorId: m.creator.id,
      source: 'auto_match',
      cpiAtAdd: m.best_cpi ?? null,
      rateEstimate: this.rateMidpoint(m),
    });
    if (created) await this.seedDefaultDeliverable(created);
  }

  // Extracted so both add paths (Browse, Matcher) seed the same default
  // deliverable. Only YouTube/Twitch are forecastable; other primaries (e.g.
  // Instagram) get no seed — the roster row's editor then shows the empty
  // state until deliverables are added by hand once that platform ships.
  private async seedDefaultDeliverable(created: CampaignCreator): Promise<void> {
    let cr = this.creatorById().get(created.creatorId) ?? null;
    if (!cr) cr = (await this.creatorsSvc.byIds([created.creatorId]))[0] ?? null;
    const platform = cr?.platform;
    const primary: DeliverablePlatform | null =
      platform === 'YouTube' ? 'YouTube' : platform === 'Twitch' ? 'Twitch' : null;
    if (!primary) return;
    await this.deliverables.add({
      campaignCreatorId: created.id,
      platform: primary,
      format: primary === 'Twitch' ? 'Dedicated' : 'Integrated',
      durationHours: primary === 'Twitch' ? 2 : undefined,
    });
  }

  /** Midpoint of the mixed-format rate range (the stored single-number estimate). */
  private rateMidpoint(m: MatchedCreator): number | null {
    const mix = m.rateEstimate?.ranges?.mix;
    if (!mix || mix.length !== 2) return null;
    return Math.round((mix[0] + mix[1]) / 2);
  }

  // By id, not from creatorById(): the hydrate effect may still be in flight
  // (the row renders a "Creator #123" placeholder then), and the click should
  // work regardless. Viewing a profile is read-only, so this stays enabled even
  // when the roster is locked or the campaign is readonly.
  openProfile(creatorId: number): void {
    void this.profile.openById(creatorId);
  }

  openBrowse(): void {
    this.browseOpen.set(true);
  }

  async addFromBrowse(creatorId: number): Promise<void> {
    const created = await this.campaignCreators.add({
      campaignId: this.campaign().id,
      creatorId,
      source: 'manual',
    });
    if (created) await this.seedDefaultDeliverable(created);
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
