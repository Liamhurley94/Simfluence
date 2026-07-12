import { Component, computed, inject, resource, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';

import { CreatorsService } from '../../core/creators/creators.service';
import { SelectionService } from '../../core/selection/selection.service';
import { AuthService } from '../../core/auth/auth.service';
import { CampaignsService } from '../../core/campaigns/campaigns.service';
import { CampaignCreatorsService } from '../../core/campaigns/campaign-creators.service';
import { CampaignContextService } from '../../core/context/campaign-context.service';
import { tierRank } from '../../core/types';
import { PagedCreators } from '../../core/data/creator.types';
import { CreatorCardComponent } from '../../shared/creator-card/creator-card.component';
import {
  DiscoveryQuery,
  FilterPanelComponent,
} from '../../shared/filter-panel/filter-panel.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { BudgetPickerComponent } from '../../shared/budget-picker/budget-picker.component';
import { SpinnerComponent } from '../../shared/spinner/spinner.component';

const EMPTY_PAGE: PagedCreators = { creators: [], total: 0, pageCount: 1, page: 0 };

@Component({
  selector: 'app-discovery',
  standalone: true,
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  imports: [CreatorCardComponent, FilterPanelComponent, PaginationComponent, DecimalPipe, BudgetPickerComponent, IconComponent, SpinnerComponent],
  template: `
    <div class="flex gap-6 sf-appear flex-1 min-h-0">
      <aside class="w-72 shrink-0 overflow-y-auto">
        <app-filter-panel (queryChange)="onQuery($event)" />
      </aside>

      <section class="flex-1 min-w-0 min-h-0 flex flex-col">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h1 class="text-xl font-bold" style="color: var(--color-text);">Discovery</h1>
          <app-budget-picker [value]="budget()" (valueChange)="setBudget($event)" />
          <div class="text-xs" style="color: var(--color-text-muted);" data-testid="results-count">
            {{ results.value().total | number }} creators
          </div>
        </div>

        @if (selection.hasAny()) {
          <div
            class="sf-panel mb-4 p-3 flex items-center justify-between flex-wrap gap-2"
            style="border-color: var(--color-sf-blue);"
            data-testid="selection-bar"
          >
            <div class="text-sm" style="color: var(--color-text);">
              {{ selection.count() }} selected
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                (click)="clearSelection()"
                class="sf-btn sf-btn-ghost text-xs"
                data-testid="selection-clear"
              >
                Clear
              </button>
              <button
                type="button"
                (click)="goToScoring()"
                class="sf-btn sf-btn-primary text-xs"
                data-testid="selection-score"
              >
                Score selected <app-icon name="arrow-right" [size]="12" style="display:inline-block;vertical-align:middle;" />
              </button>
              <button
                type="button"
                (click)="goToSimulator()"
                class="sf-btn sf-btn-ghost text-xs"
                data-testid="selection-simulate"
              >
                Simulate selected <app-icon name="arrow-right" [size]="12" style="display:inline-block;vertical-align:middle;" />
              </button>
              <button
                type="button"
                (click)="createCampaignFromSelection()"
                [disabled]="creatingCampaign()"
                class="text-xs px-3 py-1.5 rounded font-semibold disabled:opacity-50"
                style="background: var(--color-sf-green); color: #000;"
                data-testid="selection-create-campaign"
              >
                {{ creatingCampaign() ? 'Creating…' : 'Create campaign from selection' }}
              </button>
            </div>
          </div>
        }

        @if (results.isLoading()) {
          <div class="flex justify-center py-12">
            <app-spinner label="Loading creators…" />
          </div>
        } @else if (results.value().total === 0) {
          <div
            class="sf-card p-12 text-center"
            data-testid="empty-state"
          >
            <div class="text-sm font-semibold mb-2" style="color: var(--color-text);">
              No creators match current filters
            </div>
            <p class="text-xs" style="color: var(--color-text-muted);">
              Try broadening genre, platform, or language selections.
            </p>
          </div>
        } @else {
          <div
            class="grid gap-4 flex-1 min-h-0 overflow-y-auto pr-1"
            style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); align-content: start;"
            data-testid="creator-grid"
          >
            @for (c of results.value().creators; track c.id; let i = $index) {
              <app-creator-card
                class="sf-appear"
                [style.animation-delay.ms]="(i < 12 ? i : 12) * 30"
                [creator]="c"
                [selected]="selection.has(c.id)"
                [canSeeRates]="canSeeRates()"
                [format]="query().format"
                [gfiDisplay]="c.gfi"
                (toggle)="onToggle($event)"
              />
            }
          </div>
          <div
            class="shrink-0 flex items-center justify-center px-2 py-3 mt-2"
            style="border-top: 1px solid var(--color-border); background: var(--color-bg);"
          >
            <app-pagination
              [page]="results.value().page"
              [pageCount]="results.value().pageCount"
              (pageChange)="onPage($event)"
            />
          </div>
        }
      </section>
    </div>
  `,
})
export class DiscoveryComponent {
  private creators = inject(CreatorsService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private campaignsSvc = inject(CampaignsService);
  private campaignCreators = inject(CampaignCreatorsService);
  private context = inject(CampaignContextService);

  protected readonly selection = inject(SelectionService);

  protected readonly query = signal<DiscoveryQuery>({ sort: 'cpi', format: 'Mixed', platform: 'All platforms' });
  protected readonly page = signal(0);
  protected readonly budget = signal<number | null>(null);
  protected readonly creatingCampaign = signal(false);

  // Server-side filtered + paginated query. Reloads automatically when
  // `query`, `page`, or `context.subMode` signals change. When `query.genre`
  // is set, each creator carries a per-genre `gfi` via a join against
  // `creator_genre_scores`.
  protected readonly results = resource<PagedCreators, { q: DiscoveryQuery; page: number; subMode: string }>({
    params: () => ({ q: this.query(), page: this.page(), subMode: this.context.subMode() }),
    loader: ({ params }) =>
      this.creators.list({ ...params.q, subMode: params.subMode }, params.q.sort, params.page),
    defaultValue: EMPTY_PAGE,
  });

  protected readonly canSeeRates = computed(
    () => tierRank(this.auth.tier()) >= tierRank('silver'),
  );

  onQuery(q: DiscoveryQuery): void {
    this.query.set(q);
    this.page.set(0);
  }

  onPage(p: number): void {
    this.page.set(p);
  }

  onToggle(id: number): void {
    this.selection.toggle(id);
  }

  clearSelection(): void {
    this.selection.clear();
  }

  goToScoring(): void {
    // GFI on the scoring screen is genre-relative: each creator is scored against
    // the active campaign genre. Carry over the genre the user narrowed Discovery
    // to so their shortlist isn't scored against the default ('Gaming & Esports'),
    // which floors non-gaming creators at GFI 5. Skip when no genre filter is set
    // ("All genres") so we don't clobber a genre already chosen on the scoring screen.
    const genre = this.query().genre;
    if (genre) this.context.genre.set(genre);
    void this.router.navigateByUrl('/app/scoring');
  }

  goToSimulator(): void {
    // The standalone simulator runs on the Discovery selection. Carry the active
    // genre into shared context via setGenre (which clears a now-stale sub-mode)
    // so the sim seeds its genre from the user's narrowed selection.
    const genre = this.query().genre;
    if (genre) this.context.setGenre(genre);
    void this.router.navigateByUrl('/app/simulator?run=1');
  }

  setBudget(value: number | null): void {
    this.budget.set(value);
    // Thread into the query so CreatorsService filters by affordability.
    this.query.update((q) => ({ ...q, maxBudget: value }));
    this.page.set(0);
  }

  async createCampaignFromSelection(): Promise<void> {
    const ids = Array.from(this.selection.ids());
    if (ids.length === 0) return;
    this.creatingCampaign.set(true);
    try {
      const created = await this.campaignsSvc.create({
        name: `Discovery campaign — ${new Date().toLocaleDateString()}`,
        genre: this.query().genre ?? null,
        budget: this.budget(),
      });
      if (!created) return;

      await Promise.all(
        ids.map((cid) =>
          this.campaignCreators.add({ campaignId: created.id, creatorId: cid, source: 'discovery' }),
        ),
      );

      this.selection.clear();
      void this.router.navigate(['/app/campaigns', created.id]);
    } finally {
      this.creatingCampaign.set(false);
    }
  }
}
