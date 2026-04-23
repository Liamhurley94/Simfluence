import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreatorsService } from '../../core/creators/creators.service';
import { CreatorFilters, SortKey } from '../../core/data/creator.types';

export interface DiscoveryQuery extends CreatorFilters {
  sort: SortKey;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'cpi', label: 'CPI Score' },
  { key: 'gfi', label: 'GFI Score' },
  { key: 'subs', label: 'Subscribers' },
  { key: 'name', label: 'Name' },
];

@Component({
  selector: 'app-filter-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div
      class="p-4 rounded-lg flex flex-col gap-4"
      style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
    >
      <!-- Search -->
      <div>
        <label
          class="text-[10px] uppercase tracking-wider mb-1 block"
          style="color: var(--color-text-muted);"
        >
          Search
        </label>
        <input
          type="text"
          [ngModel]="search()"
          (ngModelChange)="onSearch($event)"
          placeholder="Name, handle, bio…"
          class="w-full px-3 py-2 rounded text-sm"
          style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
          data-testid="filter-search"
        />
      </div>

      <!-- Genre -->
      <div>
        <label
          class="text-[10px] uppercase tracking-wider mb-1 block"
          style="color: var(--color-text-muted);"
        >
          Genre
        </label>
        <select
          [ngModel]="genre()"
          (ngModelChange)="onGenre($event)"
          class="w-full px-3 py-2 rounded text-sm"
          style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
          data-testid="filter-genre"
        >
          <option [ngValue]="undefined">All genres</option>
          @for (g of genres; track g) {
            <option [ngValue]="g">{{ g }}</option>
          }
        </select>
      </div>

      <!-- Platform -->
      <div>
        <label
          class="text-[10px] uppercase tracking-wider mb-1 block"
          style="color: var(--color-text-muted);"
        >
          Platform
        </label>
        <div class="flex flex-wrap gap-1" data-testid="filter-platforms">
          @for (p of platforms; track p) {
            <button
              type="button"
              (click)="togglePlatform(p)"
              class="text-[10px] uppercase tracking-wider px-2 py-1 rounded"
              [style.background]="platforms_().includes(p) ? 'var(--color-sf-blue)' : 'var(--color-bg-3)'"
              [style.color]="'#fff'"
              [attr.data-testid]="'filter-platform-' + p.toLowerCase()"
            >
              {{ p }}
            </button>
          }
        </div>
      </div>

      <!-- Language -->
      <div>
        <label
          class="text-[10px] uppercase tracking-wider mb-1 block"
          style="color: var(--color-text-muted);"
        >
          Language
        </label>
        <div class="flex flex-wrap gap-1" data-testid="filter-languages">
          @for (l of languages; track l) {
            <button
              type="button"
              (click)="toggleLanguage(l)"
              class="text-[10px] px-2 py-1 rounded"
              [style.background]="languages_().includes(l) ? 'var(--color-sf-blue)' : 'var(--color-bg-3)'"
              [style.color]="'#fff'"
            >
              {{ l }}
            </button>
          }
        </div>
      </div>

      <!-- Sort -->
      <div>
        <label
          class="text-[10px] uppercase tracking-wider mb-1 block"
          style="color: var(--color-text-muted);"
        >
          Sort by
        </label>
        <select
          [ngModel]="sort()"
          (ngModelChange)="onSort($event)"
          class="w-full px-3 py-2 rounded text-sm"
          style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
          data-testid="filter-sort"
        >
          @for (opt of sortOptions; track opt.key) {
            <option [ngValue]="opt.key">{{ opt.label }}</option>
          }
        </select>
      </div>

      @if (hasFilters()) {
        <button
          type="button"
          (click)="clearAll()"
          class="text-xs py-1.5 rounded"
          style="background: transparent; border: 1px solid var(--color-border); color: var(--color-text-muted);"
          data-testid="filter-clear"
        >
          Clear filters
        </button>
      }
    </div>
  `,
})
export class FilterPanelComponent {
  private svc = inject(CreatorsService);

  readonly change = output<DiscoveryQuery>();

  readonly genres = this.svc.genres();
  readonly platforms = this.svc.platforms();
  readonly languages = this.svc.languages();
  readonly sortOptions = SORT_OPTIONS;

  readonly genre = signal<string | undefined>(undefined);
  readonly platforms_ = signal<string[]>([]);
  readonly languages_ = signal<string[]>([]);
  readonly search = signal<string>('');
  readonly sort = signal<SortKey>('cpi');

  readonly hasFilters = computed(
    () =>
      !!this.genre() ||
      this.platforms_().length > 0 ||
      this.languages_().length > 0 ||
      !!this.search().trim(),
  );

  onGenre(g: string | undefined): void {
    this.genre.set(g);
    this.emit();
  }

  onSearch(s: string): void {
    this.search.set(s);
    this.emit();
  }

  onSort(s: SortKey): void {
    this.sort.set(s);
    this.emit();
  }

  togglePlatform(p: string): void {
    this.platforms_.update((list) =>
      list.includes(p) ? list.filter((x) => x !== p) : [...list, p],
    );
    this.emit();
  }

  toggleLanguage(l: string): void {
    this.languages_.update((list) =>
      list.includes(l) ? list.filter((x) => x !== l) : [...list, l],
    );
    this.emit();
  }

  clearAll(): void {
    this.genre.set(undefined);
    this.platforms_.set([]);
    this.languages_.set([]);
    this.search.set('');
    this.emit();
  }

  private emit(): void {
    this.change.emit({
      genre: this.genre(),
      platforms: this.platforms_(),
      languages: this.languages_(),
      search: this.search(),
      sort: this.sort(),
    });
  }
}
