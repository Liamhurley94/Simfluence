import { Component, computed, effect, inject, resource, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { CampaignContextService } from '../../core/context/campaign-context.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { SelectionService } from '../../core/selection/selection.service';
import { ScoreCreatorService } from '../../core/score/score-creator.service';
import { GENRE_BENCHMARKS } from '../../core/data/benchmarks.data';
import { Creator } from '../../core/data/creator.types';
import { computeRateRanges, RateRanges } from '../../core/rates/rate-estimate';
import { Format } from '../../core/simulation/simulation.types';
import { tierRank } from '../../core/types';
import { MetricSourceBadgeComponent } from '../../shared/metric-source/metric-source-badge.component';
import { SpinnerComponent } from '../../shared/spinner/spinner.component';

interface ScoredRow {
  creator: Creator;
  cpi: number;
  // null while the bulk-score round-trip is in flight, or if the creator has
  // no cached row for the campaign genre. UI renders "—" rather than zeroing.
  gfi: number | null;
  performance: number | null;
  ranges: RateRanges;
}

@Component({
  selector: 'app-scoring',
  standalone: true,
  imports: [DecimalPipe, FormsModule, RouterLink, MetricSourceBadgeComponent, SpinnerComponent],
  template: `
    <div class="sf-appear">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold" style="color: var(--color-text);">Scoring</h1>
      <div class="flex items-center gap-3">
        <label class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">
          Campaign genre
        </label>
        <select
          [ngModel]="context.genre()"
          (ngModelChange)="onGenreChange($event)"
          class="sf-select w-auto"
          data-testid="scoring-genre"
        >
          @for (g of genres(); track g) {
            <option [ngValue]="g">{{ g }}</option>
          }
        </select>

        @if (subModes().length) {
          <label class="text-[10px] uppercase tracking-wider ml-2" style="color: var(--color-text-muted);">
            Sub-mode
          </label>
          <select
            [ngModel]="context.subMode()"
            (ngModelChange)="onSubModeChange($event)"
            class="sf-select w-auto"
            data-testid="scoring-submode"
          >
            <option [ngValue]="''">All sub-modes</option>
            @for (sm of subModes(); track sm.subMode) {
              <option [ngValue]="sm.subMode">{{ sm.subMode }}{{ sm.hasKeywords ? '' : ' (beta)' }}</option>
            }
          </select>
        }

        <label class="text-[10px] uppercase tracking-wider ml-2" style="color: var(--color-text-muted);">
          Format
        </label>
        <select
          [ngModel]="format()"
          (ngModelChange)="format.set($event)"
          class="sf-select w-auto"
          data-testid="scoring-format"
        >
          @for (f of formats; track f) {
            <option [ngValue]="f">{{ f }}</option>
          }
        </select>

        @if (score.pending()) {
          <span class="text-xs" style="color: var(--color-text-muted);" data-testid="scoring-pending">
            Scoring…
          </span>
        }
      </div>
    </div>

    @if (loading()) {
      <div class="flex justify-center py-12">
        <app-spinner [label]="creatorsLoading() ? 'Loading creators…' : 'Scoring creators…'" />
      </div>
    } @else if (rows().length === 0) {
      <div
        class="sf-card p-12 text-center"
        data-testid="scoring-empty"
      >
        <div class="text-sm font-semibold mb-2" style="color: var(--color-text);">
          No creators selected yet
        </div>
        <p class="text-xs mb-4" style="color: var(--color-text-muted);">
          Head to Discovery and pick a shortlist to score.
        </p>
        <a
          routerLink="/app/discovery"
          class="sf-btn sf-btn-primary text-xs"
        >
          Go to Discovery
        </a>
      </div>
    } @else {
      <!-- Summary stats -->
      <div class="grid grid-cols-4 gap-3 mb-6" data-testid="scoring-summary">
        <div
          class="sf-card p-4"
        >
          <div class="text-[10px] uppercase tracking-wider mb-1" style="color: var(--color-text-muted);">
            Avg CPI Score
          </div>
          <div class="text-3xl font-bold" style="color: var(--color-sf-gold);" data-testid="summary-cpi">
            {{ avgCpi() | number: '1.0-0' }}
          </div>
          <div class="h-1 mt-2 rounded-full overflow-hidden" style="background: var(--color-bg-3);">
            <div
              class="h-full"
              [style.width.%]="avgCpi()"
              [style.background]="'var(--color-sf-gold)'"
            ></div>
          </div>
        </div>
        <div
          class="sf-card p-4"
        >
          <div class="text-[10px] uppercase tracking-wider mb-1" style="color: var(--color-text-muted);">
            Avg GFI Score
          </div>
          <div class="text-3xl font-bold" style="color: var(--color-sf-green);" data-testid="summary-gfi">
            {{ avgGfi() | number: '1.0-0' }}
          </div>
          <div class="h-1 mt-2 rounded-full overflow-hidden" style="background: var(--color-bg-3);">
            <div
              class="h-full"
              [style.width.%]="avgGfi()"
              [style.background]="'var(--color-sf-green)'"
            ></div>
          </div>
        </div>
        <div
          class="sf-card p-4"
        >
          <div class="text-[10px] uppercase tracking-wider mb-1" style="color: var(--color-text-muted);">
            Top Creator
          </div>
          <div
            class="text-lg font-bold truncate"
            style="color: var(--color-text);"
            data-testid="summary-top"
          >
            {{ topCreator()?.name ?? '—' }}
          </div>
          <div class="text-[9px]" style="color: var(--color-text-muted);">
            @if (topCreator()?.ytStats; as yt) {
              {{ subsLabel(yt.subscriberCount) }} subs
            } @else if (topCreator()?.twitchStats; as tw) {
              {{ tw.avgCcv | number: '1.0-0' }} avg viewers
            }
          </div>
        </div>
        <div
          class="sf-card p-4"
        >
          <div class="text-[10px] uppercase tracking-wider mb-1" style="color: var(--color-text-muted);">
            Data Confidence
          </div>
          <div
            class="text-3xl font-bold"
            style="color: var(--color-sf-blue);"
            data-testid="summary-confidence"
          >
            {{ confidence() | number: '1.0-0' }}%
          </div>
          <div class="text-[9px]" style="color: var(--color-text-muted);">
            Based on verified sponsor history
          </div>
        </div>
      </div>

      <!-- Scoring table -->
      <div
        class="sf-card overflow-hidden mb-6"
        data-testid="scoring-table"
      >
        <table class="w-full text-sm">
          <thead>
            <tr style="background: var(--color-sf-blue); color: white;">
              <th class="text-left p-3 text-[10px] uppercase tracking-wider">Creator</th>
              <th class="text-right p-3 text-[10px] uppercase tracking-wider">
                CPI <app-metric-source-badge source="simfluence" />
              </th>
              <th class="text-right p-3 text-[10px] uppercase tracking-wider">
                GFI <app-metric-source-badge source="simfluence" />
              </th>
              <th class="text-left p-3 text-[10px] uppercase tracking-wider w-1/3">Performance</th>
              <th class="text-right p-3 text-[10px] uppercase tracking-wider">
                Est. Rate <app-metric-source-badge source="simfluence" />
              </th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.creator.id; let i = $index) {
              <tr
                class="border-t sf-appear"
                style="border-color: var(--color-border);"
                [style.animation-delay.ms]="(i < 12 ? i : 12) * 30"
                [attr.data-testid]="'scoring-row-' + row.creator.id"
              >
                <td class="p-3">
                  <div class="flex items-center gap-2">
                    <div
                      class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      [style.background]="row.creator.color"
                      style="color: white;"
                    >
                      {{ initialsOf(row.creator) }}
                    </div>
                    <div class="min-w-0">
                      <div class="font-semibold truncate" style="color: var(--color-text);">
                        {{ row.creator.name }}
                      </div>
                      <div class="text-xs" style="color: var(--color-text-muted);">
                        {{ row.creator.handle }} · {{ row.creator.platform }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="p-3 text-center">
                  <div class="text-2xl font-bold leading-none" [style.color]="scoreColor(row.cpi)">
                    {{ row.cpi }}
                  </div>
                  @if (row.creator.ytStats; as yt) {
                    <div class="text-[9px] mt-1" style="color: var(--color-text-muted);" data-testid="scoring-eng">
                      {{ yt.engagementRate }}% eng
                    </div>
                  } @else if (row.creator.twitchStats; as tw) {
                    <div class="text-[9px] mt-1" style="color: var(--color-text-muted);" data-testid="scoring-eng">
                      {{ tw.avgCcv | number: '1.0-0' }} avg viewers
                    </div>
                  } @else {
                    <div class="text-[9px] mt-1" style="color: var(--color-text-muted);" data-testid="scoring-eng">
                      —
                    </div>
                  }
                  @if (score.getBreakdown(row.creator.id); as bd) {
                    <button
                      type="button"
                      class="text-[8px] mt-1 underline"
                      style="color: var(--color-sf-gold);"
                      (click)="toggleBreakdown(row.creator.id); $event.stopPropagation()"
                    >
                      {{ expandedCpi().has(row.creator.id) ? 'hide' : 'why this score?' }}
                    </button>
                  }
                </td>
                <td class="p-3 text-center">
                  @if (row.gfi !== null) {
                    <div class="text-2xl font-bold leading-none" [style.color]="scoreColor(row.gfi)">
                      {{ row.gfi }}%
                    </div>
                  } @else {
                    <div class="text-2xl font-bold leading-none" style="color: var(--color-text-muted);" title="Scoring in progress…">
                      —
                    </div>
                  }
                  <div class="text-[9px] mt-1" style="color: var(--color-text-muted);">
                    genre fit
                  </div>
                </td>
                <td class="p-3">
                  <div class="flex items-center gap-2 mb-1.5">
                    <div class="text-[8px] w-7" style="color: var(--color-text-muted);">CPI</div>
                    <div class="flex-1 h-1 rounded-sm overflow-hidden" style="background: var(--color-bg-3);">
                      <div
                        class="h-full transition-all"
                        [style.width.%]="row.cpi"
                        [style.background]="scoreColor(row.cpi)"
                      ></div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="text-[8px] w-7" style="color: var(--color-text-muted);">GFI</div>
                    <div class="flex-1 h-1 rounded-sm overflow-hidden" style="background: var(--color-bg-3);">
                      <div
                        class="h-full transition-all"
                        [style.width.%]="row.gfi ?? 0"
                        [style.background]="scoreColor(row.gfi ?? 0)"
                      ></div>
                    </div>
                  </div>
                </td>
                <td
                  class="p-3 text-right"
                  [class.blur-sm]="!canSeeRates()"
                  [class.select-none]="!canSeeRates()"
                  data-testid="scoring-rate"
                >
                  <div class="text-sm font-bold" style="color: var(--color-sf-gold);">
                    {{ rangeLabel(row.ranges[primaryKey()]) }}
                  </div>
                  <div class="text-[8px] uppercase tracking-wider mt-0.5" style="color: var(--color-text-muted);">
                    {{ format() }}
                  </div>
                  <div class="text-[10px] mt-0.5" style="color: var(--color-text-muted);">
                    {{ rangeLabel(row.ranges[secondaryKey()]) }} {{ secondaryKey() }}
                  </div>
                </td>
              </tr>
              @if (expandedCpi().has(row.creator.id) && score.getBreakdown(row.creator.id); as bd) {
                <tr style="background: var(--color-bg-3);">
                  <td colspan="5" class="px-6 py-3">
                    <div class="text-[9px] uppercase tracking-wider mb-2 font-semibold" style="color: var(--color-sf-gold);">
                      CPI Breakdown — {{ row.creator.name }}
                    </div>
                    <div class="grid grid-cols-4 gap-3">
                      @for (f of bd.factors; track f.label) {
                        <div class="p-2 rounded" style="background: var(--color-bg-2);">
                          <div class="text-[9px] uppercase tracking-wider mb-1" style="color: var(--color-text-muted);">
                            {{ f.label }}
                          </div>
                          <div class="flex items-baseline gap-1 mb-1">
                            <span class="text-sm font-bold" style="color: var(--color-text);">{{ f.score }}</span>
                            <span class="text-[9px]" style="color: var(--color-text-muted);">/ {{ f.max }}</span>
                          </div>
                          <div class="h-1 rounded-full overflow-hidden mb-1" style="background: var(--color-bg-3);">
                            <div
                              class="h-full"
                              [style.width.%]="(+f.score / f.max) * 100"
                              [style.background]="scoreColor((+f.score / f.max) * 100)"
                            ></div>
                          </div>
                          <div class="text-[8px]" style="color: var(--color-text-muted);">
                            {{ f.value }} · {{ f.note }}
                          </div>
                        </div>
                      }
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <!-- Genre benchmark — 5-card layout, mirrors prod. -->
      <div
        class="sf-card overflow-hidden"
        data-testid="genre-benchmark"
      >
        <div
          class="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold"
          style="background: var(--color-sf-blue); color: white;"
        >
          Genre Benchmark · {{ context.genre() }}
        </div>
        <div class="grid grid-cols-5 gap-3 p-4">
          @for (m of benchmarkCards(); track m.key) {
            <div
              class="text-center p-4 rounded-md"
              style="background: var(--color-bg-3);"
              [attr.data-testid]="'benchmark-' + m.key"
            >
              <div
                class="text-[9px] uppercase tracking-wider mb-1.5"
                style="color: var(--color-text-muted);"
              >
                {{ m.label }}
              </div>
              <div class="text-2xl font-bold leading-none" style="color: var(--color-sf-gold);">
                {{ m.value }}
              </div>
              <div class="text-[9px] uppercase mt-1.5" style="color: var(--color-text-muted);">
                Industry avg
              </div>
            </div>
          }
        </div>
      </div>
    }
    </div>
  `,
})
export class ScoringComponent {
  private selection = inject(SelectionService);
  private creatorsSvc = inject(CreatorsService);
  private auth = inject(AuthService);
  protected score = inject(ScoreCreatorService);
  protected context = inject(CampaignContextService);

  protected readonly genres = this.creatorsSvc.genres;

  protected readonly subModes = computed(() => {
    const g = this.context.genre();
    return this.creatorsSvc.submodesByGenre()[g] ?? [];
  });

  // Async batch fetch of selected creators; re-runs when selection changes.
  private readonly selectedCreatorsRes = resource<Creator[], number[]>({
    params: () => Array.from(this.selection.ids()),
    loader: ({ params }) => this.creatorsSvc.byIds(params),
    defaultValue: [],
  });
  private readonly selectedCreators = computed(() => this.selectedCreatorsRes.value());
  // True only when there is a non-empty selection in flight — avoids flashing
  // the spinner on the genuine "nothing selected" empty state.
  protected readonly creatorsLoading = computed(
    () => this.selection.hasAny() && this.selectedCreatorsRes.isLoading(),
  );
  // Full loading state: creators still loading, OR the first score is in flight
  // and no GFIs are available yet — so we show a spinner instead of a table full
  // of zeros. Incremental re-scores that keep prior GFIs fall through to the
  // inline "Scoring…" hint instead of blanking the page.
  protected readonly loading = computed(
    () =>
      this.creatorsLoading() ||
      (this.score.pending() && !this.rows().some((r) => r.gfi !== null)),
  );

  protected readonly rows = computed<ScoredRow[]>(() => {
    // Tie in `score.version` so rows re-render when bulk score completes.
    this.score.version();
    return this.selectedCreators()
      .map((creator) => {
        const cpi = creator.cpi;
        const gfi = this.score.getGfi(creator.id) ?? null;
        return {
          creator,
          cpi,
          gfi,
          performance: gfi === null ? null : Math.round((cpi + gfi) / 2),
          ranges: computeRateRanges(creator),
        };
      })
      .sort((a, b) => b.cpi - a.cpi);
  });

  protected readonly avgCpi = computed(() => {
    const list = this.rows();
    if (list.length === 0) return 0;
    return list.reduce((s, r) => s + r.cpi, 0) / list.length;
  });

  protected readonly avgGfi = computed(() => {
    // Exclude rows whose GFI hasn't returned yet — averaging with 0 would
    // mislead the user during the bulk-score round-trip.
    const list = this.rows().filter((r): r is ScoredRow & { gfi: number } => r.gfi !== null);
    if (list.length === 0) return 0;
    return list.reduce((s, r) => s + r.gfi, 0) / list.length;
  });

  protected readonly topCreator = computed(() => {
    const list = this.rows().filter((r): r is ScoredRow & { gfi: number } => r.gfi !== null);
    if (list.length === 0) return null;
    return list.reduce((best, row) =>
      row.cpi + row.gfi > best.cpi + best.gfi ? row : best,
    ).creator;
  });

  protected readonly confidence = computed(() => {
    const list = this.rows();
    if (list.length === 0) return 0;
    const verified = list.filter((r) => (r.creator.verifiedDeals ?? 0) > 0).length;
    return (verified / list.length) * 100;
  });

  // Industry-average benchmarks per genre — drives the bottom benchmark cards.
  protected readonly benchmark = computed(
    () => GENRE_BENCHMARKS[this.context.genre()] ?? GENRE_BENCHMARKS['Gaming & Esports'],
  );

  protected readonly benchmarkCards = computed(() => {
    const b = this.benchmark();
    return [
      { key: 'ctr', label: 'CTR', value: b.ctrBase + '%' },
      { key: 'cpm', label: 'CPM', value: '$' + b.cpmBase },
      { key: 'cvr', label: 'CVR', value: b.cvrBase + '%' },
      { key: 'roas', label: 'ROAS', value: b.roasBase + '×' },
      { key: 'eng', label: 'Eng Rate', value: b.engBase + '%' },
    ];
  });

  protected readonly canSeeRates = computed(
    () => tierRank(this.auth.tier()) >= tierRank('silver'),
  );

  protected readonly format = signal<Format>('Integrated');
  protected readonly formats: Format[] = ['Integrated', 'Dedicated', 'Mixed'];
  protected readonly expandedCpi = signal<Set<number>>(new Set());

  constructor() {
    // Re-score when the campaign context changes. `untracked` reads of selection
    // avoid rescoring on every add/remove — only on genre/sub-mode/secondary shifts.
    effect(() => {
      const genre = this.context.genre();
      const subMode = this.context.subMode();
      const secondaryGenres = this.context.secondaryGenres();
      const ids = untracked(() => Array.from(this.selection.ids()));
      if (ids.length === 0) return;
      const key = this.scoreKey(ids, genre, subMode, secondaryGenres);
      // Skip the redundant re-score (and its clear -> blank flash) when returning
      // to the screen with the same inputs already scored in the persisted cache.
      if (this.score.hasFreshScores(key)) return;
      void this.creatorsSvc.byIds(ids).then((creators) => {
        if (creators.length === 0) return;
        this.score.clear();
        void this.score.scoreBulk({ creators, campaignGenre: genre, subMode, secondaryGenres, key });
      });
    });
  }

  // Stable identity of the current scoring inputs — selection + genre + sub-mode
  // + secondary genres — so the effect can tell whether a re-score is needed.
  private scoreKey(ids: number[], genre: string, subMode: string, secondaryGenres: string[]): string {
    return [
      [...ids].sort((a, b) => a - b).join(','),
      genre,
      subMode,
      [...secondaryGenres].sort().join('|'),
    ].join('::');
  }

  onGenreChange(g: string): void {
    this.context.setGenre(g);
  }

  onSubModeChange(sm: string): void {
    this.context.subMode.set(sm);
  }

  toggleBreakdown(id: number): void {
    this.expandedCpi.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  initialsOf(c: Creator): string {
    return c.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase();
  }

  scoreColor(s: number): string {
    if (s >= 80) return 'var(--color-sf-green)';
    if (s >= 60) return 'var(--color-sf-orange)';
    return 'var(--color-sf-red)';
  }

  // Format → range key.
  protected primaryKey(): 'int' | 'ded' | 'mix' {
    const f = this.format();
    return f === 'Dedicated' ? 'ded' : f === 'Mixed' ? 'mix' : 'int';
  }

  // Pick a secondary range to show in dim text below the primary one.
  // Conventions: Integrated → ded; Dedicated → int; Mixed → ded.
  protected secondaryKey(): 'int' | 'ded' | 'mix' {
    const f = this.format();
    if (f === 'Integrated') return 'ded';
    if (f === 'Dedicated') return 'int';
    return 'ded';
  }

  protected rangeLabel(range: [number, number]): string {
    return `$${compact(range[0])}–$${compact(range[1])}`;
  }

  protected subsLabel(n: number): string {
    return compact(n);
  }
}

function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
}
