import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';

import { CreatorsService } from '../../../core/creators/creators.service';
import { CreatorFilters, PagedCreators } from '../../../core/data/creator.types';

const EMPTY_PAGE: PagedCreators = { creators: [], total: 0, pageCount: 1, page: 0 };
const PAGE_SIZE = 20;

@Component({
  selector: 'app-browse-creators-modal',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <div
      class="fixed inset-0 z-40 flex items-center justify-center p-4"
      style="background: rgba(0,0,0,0.6);"
      (click)="onBackdrop($event)"
      data-testid="browse-creators-backdrop"
    >
      <div
        class="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-lg"
        style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
        (click)="$event.stopPropagation()"
        data-testid="browse-creators-modal"
      >
        <header
          class="flex items-center justify-between px-4 py-3"
          style="border-bottom: 1px solid var(--color-border);"
        >
          <div>
            <div class="text-sm font-bold" style="color: var(--color-text);">Browse creators</div>
            <div class="text-[10px]" style="color: var(--color-text-muted);">
              Filter and add to this campaign
            </div>
          </div>
          <button
            type="button"
            (click)="close.emit()"
            class="text-xs px-3 py-1 rounded"
            style="background: transparent; border: 1px solid var(--color-border); color: var(--color-text-muted);"
            data-testid="browse-creators-close"
          >
            Done
          </button>
        </header>

        <div
          class="px-4 py-3 flex items-center gap-2 flex-wrap"
          style="border-bottom: 1px solid var(--color-border);"
        >
          <input
            type="text"
            [ngModel]="search()"
            (ngModelChange)="onSearch($event)"
            placeholder="Search name, handle, bio…"
            class="flex-1 min-w-0 px-3 py-2 rounded text-sm"
            style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
            data-testid="browse-creators-search"
          />
          @if (campaignGenre) {
            <button
              type="button"
              (click)="toggleGenreFilter()"
              class="text-[10px] uppercase tracking-wider px-2 py-1.5 rounded"
              [style.background]="genreActive() ? 'var(--color-sf-blue)' : 'var(--color-bg-3)'"
              style="color: #fff;"
              data-testid="browse-creators-genre-toggle"
            >
              {{ campaignGenre }}
              @if (genreActive()) { <span class="ml-1 opacity-70">✓</span> }
            </button>
          }
        </div>

        <div class="flex-1 overflow-y-auto px-4 py-3">
          @if (results.isLoading()) {
            <div class="text-xs py-8 text-center" style="color: var(--color-text-muted);">
              Loading…
            </div>
          } @else if (results.value().total === 0) {
            <div class="text-xs py-8 text-center" style="color: var(--color-text-muted);" data-testid="browse-creators-empty">
              No creators match these filters.
            </div>
          } @else {
            <ul class="space-y-2">
              @for (c of results.value().creators; track c.id) {
                <li
                  class="flex items-center gap-3 p-2 rounded"
                  style="background: var(--color-bg-3);"
                  [attr.data-testid]="'browse-creator-' + c.id"
                >
                  <div
                    class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    [style.background]="c.color"
                    style="color: white;"
                  >
                    {{ initialsOf(c.name) }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-xs font-semibold truncate" style="color: var(--color-text);">{{ c.name }}</div>
                    <div class="text-[10px] truncate" style="color: var(--color-text-muted);">
                      {{ '@' + (c.handle || '—') }} · {{ c.platform }} · {{ c.subs }} subs
                    </div>
                  </div>
                  <div class="text-[10px] flex items-center gap-2 shrink-0" style="color: var(--color-text-muted);">
                    <span>CPI <strong style="color: var(--color-sf-gold);">{{ c.cpi }}</strong></span>
                    @if (c.gfi !== null) {
                      <span>GFI <strong style="color: var(--color-sf-green);">{{ c.gfi }}</strong></span>
                    } @else {
                      <span>GFI <strong style="color: var(--color-text-muted);">—</strong></span>
                    }
                  </div>
                  @if (existingCreatorIds.has(c.id)) {
                    <span
                      class="text-[10px] uppercase tracking-wider px-2 py-1 rounded shrink-0"
                      style="background: var(--color-bg-2); color: var(--color-text-muted);"
                      data-testid="browse-creator-added"
                    >
                      Added
                    </span>
                  } @else {
                    <button
                      type="button"
                      (click)="onAdd(c.id)"
                      [disabled]="addingIds().has(c.id)"
                      class="text-[10px] uppercase tracking-wider px-3 py-1 rounded shrink-0 disabled:opacity-50"
                      style="background: var(--color-sf-blue); color: white;"
                      [attr.data-testid]="'browse-creator-add-' + c.id"
                    >
                      {{ addingIds().has(c.id) ? 'Adding…' : 'Add' }}
                    </button>
                  }
                </li>
              }
            </ul>
          }
        </div>

        <footer
          class="px-4 py-3 flex items-center justify-between text-xs"
          style="border-top: 1px solid var(--color-border); color: var(--color-text-muted);"
        >
          <div data-testid="browse-creators-count">
            {{ results.value().total | number }} creators
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="prev()"
              [disabled]="page() === 0"
              class="text-[10px] uppercase tracking-wider px-2 py-1 rounded disabled:opacity-40"
              style="background: transparent; border: 1px solid var(--color-border); color: var(--color-text-muted);"
              data-testid="browse-creators-prev"
            >
              Prev
            </button>
            <span class="text-[10px]" data-testid="browse-creators-page">
              {{ page() + 1 }} / {{ results.value().pageCount }}
            </span>
            <button
              type="button"
              (click)="next()"
              [disabled]="page() + 1 >= results.value().pageCount"
              class="text-[10px] uppercase tracking-wider px-2 py-1 rounded disabled:opacity-40"
              style="background: transparent; border: 1px solid var(--color-border); color: var(--color-text-muted);"
              data-testid="browse-creators-next"
            >
              Next
            </button>
          </div>
        </footer>
      </div>
    </div>
  `,
})
export class BrowseCreatorsModalComponent {
  private creatorsSvc = inject(CreatorsService);

  /** Genre filter is preset to this on open; can be toggled off. */
  @Input() campaignGenre: string | null = null;

  /** Already-added creator IDs — rendered as "Added" instead of an Add button. */
  @Input() existingCreatorIds: Set<number> = new Set();

  @Output() close = new EventEmitter<void>();
  @Output() add = new EventEmitter<number>();

  protected readonly search = signal('');
  protected readonly page = signal(0);
  protected readonly addingIds = signal<Set<number>>(new Set());

  // Genre toggle state — defaults to "on" when a campaign genre is provided.
  // User can clear it to browse across genres without losing the toggle option.
  protected readonly genreFilterEnabled = signal(true);
  protected readonly genreActive = computed(
    () => this.genreFilterEnabled() && !!this.campaignGenre,
  );

  private debounceTimer: number | null = null;

  protected readonly results = resource<PagedCreators, { filters: CreatorFilters; page: number }>({
    params: () => ({
      filters: {
        genre: this.genreActive() ? (this.campaignGenre ?? undefined) : undefined,
        search: this.search().trim() || undefined,
      },
      page: this.page(),
    }),
    loader: ({ params }) =>
      this.creatorsSvc.list(params.filters, 'cpi', params.page, PAGE_SIZE),
    defaultValue: EMPTY_PAGE,
  });

  onSearch(s: string): void {
    // Debounce typed input — avoid hammering PostgREST on every keystroke.
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.search.set(s);
      this.page.set(0);
    }, 250) as unknown as number;
  }

  toggleGenreFilter(): void {
    this.genreFilterEnabled.update((v) => !v);
    this.page.set(0);
  }

  prev(): void {
    this.page.update((p) => Math.max(0, p - 1));
  }

  next(): void {
    this.page.update((p) => p + 1);
  }

  async onAdd(creatorId: number): Promise<void> {
    this.addingIds.update((set) => new Set(set).add(creatorId));
    this.add.emit(creatorId);
    // Parent owns the actual add; we just clear the spinner once the
    // existingCreatorIds set updates (next render). For robustness we also
    // clear after a short window.
    setTimeout(() => {
      this.addingIds.update((set) => {
        const next = new Set(set);
        next.delete(creatorId);
        return next;
      });
    }, 1500);
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
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
