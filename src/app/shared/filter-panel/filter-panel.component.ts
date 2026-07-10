import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { CampaignContextService } from '../../core/context/campaign-context.service';
import { CreatorFilters, CreatorTier, SortKey } from '../../core/data/creator.types';
import { Format } from '../../core/simulation/simulation.types';
import { tierRank } from '../../core/types';
import { UpgradePromptService } from '../../core/upgrade/upgrade-prompt.service';
import { IconComponent } from '../icon/icon.component';

export interface DiscoveryQuery extends CreatorFilters {
  sort: SortKey;
  format: Format;
  platform: string;
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

// Sentinel for the show-all (no platform filter) mode — CreatorsService.list
// recognises this exact string and runs the creator_cpi view-backed query.
const ALL_PLATFORMS = 'All platforms';

@Component({
  selector: 'app-filter-panel',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div
      class="sf-card p-4 flex flex-col gap-4"
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
          class="sf-input"
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
          class="sf-select"
          data-testid="filter-genre"
        >
          <option [ngValue]="undefined">All genres</option>
          @for (g of genres(); track g) {
            <option [ngValue]="g">{{ g }}</option>
          }
        </select>
      </div>

      <!-- Sub-mode (genre-dependent; shared via CampaignContext) -->
      @if (subModes().length) {
        <div>
          <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">
            Sub-mode
          </label>
          <select
            [ngModel]="context.subMode()"
            (ngModelChange)="onSubMode($event)"
            class="sf-select"
            data-testid="filter-submode"
          >
            <option [ngValue]="''">All sub-modes</option>
            @for (sm of subModes(); track sm.subMode) {
              <option [ngValue]="sm.subMode">{{ sm.subMode }}{{ sm.hasKeywords ? '' : ' (beta)' }}</option>
            }
          </select>
        </div>
      }

      <!-- Platform -->
      <div>
        <label
          class="text-[10px] uppercase tracking-wider mb-1 block"
          style="color: var(--color-text-muted);"
        >
          Platform
        </label>
        <select
          [ngModel]="platform_()"
          (ngModelChange)="onPlatform($event)"
          class="sf-select"
          data-testid="filter-platform"
        >
          <option [ngValue]="allPlatforms">{{ allPlatforms }}</option>
          @for (p of platforms(); track p) {
            <option [ngValue]="p">{{ p }}</option>
          }
        </select>
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
          @for (l of languages(); track l.code) {
            <button
              type="button"
              (click)="toggleLanguage(l.code)"
              class="sf-chip cursor-pointer"
              [style.background]="languages_().includes(l.code) ? 'var(--color-sf-blue)' : ''"
              [style.color]="languages_().includes(l.code) ? 'white' : ''"
              [style.border-color]="languages_().includes(l.code) ? 'var(--color-sf-blue)' : ''"
            >
              {{ l.name }}
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
          class="sf-select"
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
          class="sf-select"
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
        <div
          [class.opacity-50]="!genre()"
          [class.pointer-events-none]="!genre()"
          [attr.title]="!genre() ? 'Select a genre to enable GFI filter' : null"
        >
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
            [disabled]="!genre()"
            class="w-full"
            style="accent-color: var(--color-sf-green);"
            data-testid="filter-min-gfi"
          />
          @if (!genre()) {
            <div class="text-[9px] mt-1" style="color: var(--color-text-muted);">
              Select a genre to enable
            </div>
          }
        </div>
      </div>

      @if (!canUseScoreFilters()) {
        <button
          type="button"
          (click)="promptScoreFilterUpgrade()"
          class="-mt-2 text-[10px] uppercase tracking-wider py-1.5 rounded"
          style="background: color-mix(in srgb, var(--color-sf-gold) 8%, transparent); border: 1px solid color-mix(in srgb, var(--color-sf-gold) 30%, transparent); color: var(--color-sf-gold);"
          data-testid="filter-score-upgrade"
        >
          <app-icon name="star" [size]="12" style="display:inline-block;vertical-align:middle;" /> Gold+ — unlock score filters
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
          class="sf-select"
          data-testid="filter-sort"
        >
          @for (opt of sortOptions; track opt.key) {
            <option
              [ngValue]="opt.key"
              [disabled]="opt.key === 'gfi' && !genre()"
            >
              {{ opt.label }}{{ opt.key === 'gfi' && !genre() ? ' (select genre)' : '' }}
            </option>
          }
        </select>
      </div>

      @if (hasFilters()) {
        <button
          type="button"
          (click)="clearAll()"
          class="sf-btn sf-btn-ghost text-xs w-full"
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
  protected readonly context = inject(CampaignContextService);

  readonly queryChange = output<DiscoveryQuery>();

  readonly canUseScoreFilters = computed(
    () => tierRank(this.auth.tier()) >= tierRank('gold'),
  );

  // Bind to the service signals directly so dropdowns update when the
  // RPC-fed lists populate after the APP_INITIALIZER fires.
  readonly genres = this.svc.genres;
  readonly platforms = this.svc.platforms;
  readonly languages = this.svc.usedLanguages;
  readonly sortOptions = SORT_OPTIONS;
  readonly tierOptions = TIER_OPTIONS;
  readonly formatOptions = FORMAT_OPTIONS;
  readonly allPlatforms = ALL_PLATFORMS;

  // Sub-modes for the currently-selected genre (empty when no genre / none configured).
  protected readonly subModes = computed(() => {
    const g = this.genre();
    return g ? (this.svc.submodesByGenre()[g] ?? []) : [];
  });

  readonly genre = signal<string | undefined>(undefined);
  readonly platform_ = signal<string>(ALL_PLATFORMS);
  readonly languages_ = signal<string[]>([]);
  readonly search = signal<string>('');
  readonly sort = signal<SortKey>('cpi');
  readonly tier = signal<CreatorTier | undefined>(undefined);
  readonly format = signal<Format>('Mixed');
  readonly minCpi = signal<number>(0);
  readonly minGfi = signal<number>(0);

  readonly hasFilters = computed(
    () =>
      !!this.genre() ||
      this.platform_() !== ALL_PLATFORMS ||
      this.languages_().length > 0 ||
      !!this.search().trim() ||
      !!this.tier() ||
      this.minCpi() > 0 ||
      this.minGfi() > 0,
  );

  onGenre(g: string | undefined): void {
    this.genre.set(g);
    // Reset sub-mode if it doesn't belong to the new genre (or genre cleared).
    const valid = g
      ? (this.svc.submodesByGenre()[g] ?? []).some((s) => s.subMode === this.context.subMode())
      : false;
    if (!valid) this.context.subMode.set('');
    // GFI sort + minGfi filter require a genre. If the user clears the genre
    // while either is active, fall back to defaults so the emitted query is
    // never in an "impossible" state for the cache.
    if (!g) {
      if (this.sort() === 'gfi') this.sort.set('cpi');
      if (this.minGfi() > 0) this.minGfi.set(0);
    }
    this.emit();
  }

  onSubMode(sm: string): void {
    this.context.subMode.set(sm);
    // Discovery's resource tracks context.subMode directly; no emit needed.
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
    if (!this.genre()) return;
    this.minGfi.set(Number(v) || 0);
    this.emit();
  }

  promptScoreFilterUpgrade(): void {
    this.upgrade.open('CPI / GFI score filters', 'gold');
  }

  onPlatform(p: string): void {
    this.platform_.set(p);
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
    this.platform_.set(ALL_PLATFORMS);
    this.languages_.set([]);
    this.search.set('');
    this.tier.set(undefined);
    this.format.set('Mixed');
    this.minCpi.set(0);
    this.minGfi.set(0);
    this.emit();
  }

  private emit(): void {
    const gold = this.canUseScoreFilters();
    this.queryChange.emit({
      genre: this.genre(),
      platform: this.platform_(),
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
