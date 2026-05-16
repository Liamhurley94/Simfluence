import { Component, computed, inject, resource, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';

import { CreatorsService } from '../../core/creators/creators.service';
import { SelectionService } from '../../core/selection/selection.service';
import { AuthService } from '../../core/auth/auth.service';
import { CampaignsService } from '../../core/campaigns/campaigns.service';
import { CampaignCreatorsService } from '../../core/campaigns/campaign-creators.service';
import { tierRank } from '../../core/types';
import { PagedCreators } from '../../core/data/creator.types';
import { CreatorCardComponent } from '../../shared/creator-card/creator-card.component';
import {
  DiscoveryQuery,
  FilterPanelComponent,
} from '../../shared/filter-panel/filter-panel.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { BudgetPickerComponent } from '../../shared/budget-picker/budget-picker.component';

const EMPTY_PAGE: PagedCreators = { creators: [], total: 0, pageCount: 1, page: 0 };

@Component({
  selector: 'app-discovery',
  standalone: true,
  imports: [CreatorCardComponent, FilterPanelComponent, PaginationComponent, DecimalPipe, BudgetPickerComponent],
  template: `
    <div class="flex gap-6">
      <aside class="w-72 shrink-0">
        <app-filter-panel (queryChange)="onQuery($event)" />
      </aside>

      <section class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h1 class="text-xl font-bold" style="color: var(--color-text);">Discovery</h1>
          <app-budget-picker [value]="budget()" (valueChange)="setBudget($event)" />
          <div class="text-xs" style="color: var(--color-text-muted);" data-testid="results-count">
            {{ results.value().total | number }} creators
          </div>
        </div>

        @if (selection.hasAny()) {
          <div
            class="mb-4 p-3 rounded-lg flex items-center justify-between flex-wrap gap-2"
            style="background: var(--color-bg-2); border: 1px solid var(--color-sf-blue);"
            data-testid="selection-bar"
          >
            <div class="text-sm" style="color: var(--color-text);">
              {{ selection.count() }} selected
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                (click)="clearSelection()"
                class="text-xs px-3 py-1.5 rounded"
                style="background: transparent; border: 1px solid var(--color-border); color: var(--color-text);"
                data-testid="selection-clear"
              >
                Clear
              </button>
              <button
                type="button"
                (click)="goToScoring()"
                class="text-xs px-3 py-1.5 rounded font-semibold"
                style="background: var(--color-sf-blue); color: white;"
                data-testid="selection-score"
              >
                Score selected →
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

        @if (results.value().total === 0) {
          <div
            class="p-12 rounded-lg text-center"
            style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
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
            class="grid gap-4 mb-6"
            style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));"
            data-testid="creator-grid"
          >
            @for (c of results.value().creators; track c.id) {
              <app-creator-card
                [creator]="c"
                [selected]="selection.has(c.id)"
                [canSeeRates]="canSeeRates()"
                [format]="query().format"
                [gfiDisplay]="c.gfi"
                (toggle)="onToggle($event)"
              />
            }
          </div>
          <app-pagination
            [page]="results.value().page"
            [pageCount]="results.value().pageCount"
            (pageChange)="onPage($event)"
          />
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

  protected readonly selection = inject(SelectionService);

  protected readonly query = signal<DiscoveryQuery>({ sort: 'cpi', format: 'Mixed' });
  protected readonly page = signal(0);
  protected readonly budget = signal<number | null>(null);
  protected readonly creatingCampaign = signal(false);

  // Server-side filtered + paginated query. Reloads automatically when
  // `query` or `page` signals change. When `query.genre` is set, each creator
  // carries a per-genre `gfi` via a join against `creator_genre_scores`.
  protected readonly results = resource<PagedCreators, { q: DiscoveryQuery; page: number }>({
    params: () => ({ q: this.query(), page: this.page() }),
    loader: ({ params }) =>
      this.creators.list(params.q, params.q.sort, params.page),
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
    void this.router.navigateByUrl('/app/scoring');
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
