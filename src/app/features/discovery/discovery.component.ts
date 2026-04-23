import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';

import { CreatorsService } from '../../core/creators/creators.service';
import { SelectionService } from '../../core/selection/selection.service';
import { AuthService } from '../../core/auth/auth.service';
import { tierRank } from '../../core/types';
import { CreatorCardComponent } from '../../shared/creator-card/creator-card.component';
import {
  DiscoveryQuery,
  FilterPanelComponent,
} from '../../shared/filter-panel/filter-panel.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';

@Component({
  selector: 'app-discovery',
  standalone: true,
  imports: [CreatorCardComponent, FilterPanelComponent, PaginationComponent, DecimalPipe],
  template: `
    <div class="flex gap-6">
      <aside class="w-72 shrink-0">
        <app-filter-panel (change)="onQuery($event)" />
      </aside>

      <section class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-xl font-bold" style="color: var(--color-text);">Discovery</h1>
          <div class="text-xs" style="color: var(--color-text-muted);" data-testid="results-count">
            {{ results().total | number }} creators
          </div>
        </div>

        @if (selection.hasAny()) {
          <div
            class="mb-4 p-3 rounded-lg flex items-center justify-between"
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
            </div>
          </div>
        }

        @if (results().total === 0) {
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
            @for (c of results().creators; track c.id) {
              <app-creator-card
                [creator]="c"
                [selected]="selection.has(c.id)"
                [canSeeRates]="canSeeRates()"
                (toggle)="onToggle($event)"
              />
            }
          </div>
          <app-pagination
            [page]="results().page"
            [pageCount]="results().pageCount"
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

  protected readonly selection = inject(SelectionService);

  protected readonly query = signal<DiscoveryQuery>({ sort: 'cpi' });
  protected readonly page = signal(0);

  protected readonly results = computed(() => {
    const q = this.query();
    return this.creators.list(q, q.sort, this.page());
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
}
