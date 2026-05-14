import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { CreatorFilters, CreatorTier, SortKey } from '../../core/data/creator.types';
import { Format } from '../../core/simulation/simulation.types';
import { tierRank } from '../../core/types';
import { UpgradePromptService } from '../../core/upgrade/upgrade-prompt.service';

export interface DiscoveryQuery extends CreatorFilters {
  sort: SortKey;
  // `format` is a display preference (which rate range to show on each card),
  // not a DB filter — server-side queries ignore it.
  format: Format;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'cpi', label: 'CPI Score' },
  { key: 'gfi', label: 'GFI Score' },
  { key: 'subs', label: 'Subscribers' },
  { key: 'name', label: 'Name' },
];

const TIER_OPTIONS: { key: CreatorTier; label: string }[] = [
  { key: 'Micro', label: 'Micro only (≤50K)' },
  { key: 'Mid-tier', label: 'Mid-tier (50K–500K)' },
  { key: 'Established', label: 'Established (500K–2M)' },
  { key: 'Megastar', label: 'Megastar (2M+)' },
];

const FORMAT_OPTIONS: { key: Format; label: string }[] = [
  { key: 'Integrated', label: 'Integrated (60–90 sec)' },
  { key: 'Dedicated', label: 'Dedicated (full video)' },
  { key: 'Mixed', label: 'Mixed' },
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
          @for (g of genres(); track g) {
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
          @for (p of platforms(); track p) {
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
          @for (l of languages(); track l) {
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

      <!-- Tier -->
      <div>
        <label
          class="text-[10px] uppercase tracking-wider mb-1 block"
          style="color: var(--color-text-muted);"
        >
          Creator tier
        </label>
        <select
          [ngModel]="tier()"
          (ngModelChange)="onTier($event)"
          class="w-full px-3 py-2 rounded text-sm"
          style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
          data-testid="filter-tier"
        >
          <option [ngValue]="undefined">Mixed tiers</option>
          @for (opt of tierOptions; track opt.key) {
            <option [ngValue]="opt.key">{{ opt.label }}</option>
          }
        </select>
      </div>

      <!-- Sponsored format -->
      <div>
        <label
          class="text-[10px] uppercase tracking-wider mb-1 block"
          style="color: var(--color-text-muted);"
        >
          Sponsored format
        </label>
        <select
          [ngModel]="format()"
          (ngModelChange)="onFormat($event)"
          class="w-full px-3 py-2 rounded text-sm"
          style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
          data-testid="filter-format"
        >
          @for (opt of formatOptions; track opt.key) {
            <option [ngValue]="opt.key">{{ opt.label }}</option>
          }
        </select>
      </div>

      <!-- Score filters (Gold+ only) -->
      <div
        class="relative flex flex-col gap-4"
        [class.blur-sm]="!canUseScoreFilters()"
        [class.opacity-60]="!canUseScoreFilters()"
        [class.pointer-events-none]="!canUseScoreFilters()"
        data-testid="filter-score-group"
      >
        <!-- Min CPI -->
        <div>
          <label
            class="text-[10px] uppercase tracking-wider mb-1 flex items-center justify-between"
            style="color: var(--color-text-muted);"
          >
            <span>Min CPI Score</span>
            <span
              class="text-xs font-semibold"
              style="color: var(--color-sf-gold);"
              data-testid="filter-min-cpi-val"
            >
              {{ minCpi() ? minCpi() : 'Any' }}
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="90"
            step="5"
            [ngModel]="minCpi()"
            (ngModelChange)="onMinCpi($event)"
            class="w-full"
            style="accent-color: var(--color-sf-gold);"
            data-testid="filter-min-cpi"
          />
        </div>

        <!-- Min GFI -->
        <div>
          <label
            class="text-[10px] uppercase tracking-wider mb-1 flex items-center justify-between"
            style="color: var(--color-text-muted);"
          >
            <span>Min GFI Score</span>
            <span
              class="text-xs font-semibold"
              style="color: var(--color-sf-green);"
              data-testid="filter-min-gfi-val"
            >
              {{ minGfi() ? minGfi() : 'Any' }}
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="95"
            step="5"
            [ngModel]="minGfi()"
            (ngModelChange)="onMinGfi($event)"
            class="w-full"
            style="accent-color: var(--color-sf-green);"
            data-testid="filter-min-gfi"
          />
        </div>
      </div>

      @if (!canUseScoreFilters()) {
        <button
          type="button"
          (click)="promptScoreFilterUpgrade()"
          class="-mt-2 text-[10px] uppercase tracking-wider py-1.5 rounded"
          style="background: rgba(255,212,0,0.08); border: 1px solid rgba(255,212,0,0.3); color: var(--color-sf-gold);"
          data-testid="filter-score-upgrade"
        >
          ★ Gold+ — unlock score filters
        </button>
      }

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
  private auth = inject(AuthService);
  private upgrade = inject(UpgradePromptService);

  readonly queryChange = output<DiscoveryQuery>();

  readonly canUseScoreFilters = computed(
    () => tierRank(this.auth.tier()) >= tierRank('gold'),
  );

  // Bind to the service signals directly so dropdowns update when the
  // RPC-fed lists populate after the APP_INITIALIZER fires.
  readonly genres = this.svc.genres;
  readonly platforms = this.svc.platforms;
  readonly languages = this.svc.languages;
  readonly sortOptions = SORT_OPTIONS;
  readonly tierOptions = TIER_OPTIONS;
  readonly formatOptions = FORMAT_OPTIONS;

  readonly genre = signal<string | undefined>(undefined);
  readonly platforms_ = signal<string[]>([]);
  readonly languages_ = signal<string[]>([]);
  readonly search = signal<string>('');
  readonly sort = signal<SortKey>('cpi');
  readonly tier = signal<CreatorTier | undefined>(undefined);
  readonly format = signal<Format>('Integrated');
  readonly minCpi = signal<number>(0);
  readonly minGfi = signal<number>(0);

  readonly hasFilters = computed(
    () =>
      !!this.genre() ||
      this.platforms_().length > 0 ||
      this.languages_().length > 0 ||
      !!this.search().trim() ||
      !!this.tier() ||
      this.minCpi() > 0 ||
      this.minGfi() > 0,
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

  onTier(t: CreatorTier | undefined): void {
    this.tier.set(t);
    this.emit();
  }

  onFormat(f: Format): void {
    this.format.set(f);
    this.emit();
  }

  onMinCpi(v: number | string): void {
    if (!this.canUseScoreFilters()) return;
    this.minCpi.set(Number(v) || 0);
    this.emit();
  }

  onMinGfi(v: number | string): void {
    if (!this.canUseScoreFilters()) return;
    this.minGfi.set(Number(v) || 0);
    this.emit();
  }

  promptScoreFilterUpgrade(): void {
    this.upgrade.open('CPI / GFI score filters', 'gold');
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
    this.tier.set(undefined);
    this.format.set('Integrated');
    this.minCpi.set(0);
    this.minGfi.set(0);
    this.emit();
  }

  private emit(): void {
    const gold = this.canUseScoreFilters();
    this.queryChange.emit({
      genre: this.genre(),
      platforms: this.platforms_(),
      languages: this.languages_(),
      search: this.search(),
      sort: this.sort(),
      tier: this.tier(),
      format: this.format(),
      minCpi: gold ? this.minCpi() : 0,
      minGfi: gold ? this.minGfi() : 0,
    });
  }
}
