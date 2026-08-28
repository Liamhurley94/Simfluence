import { Component, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { RateLimitService } from '../../core/simulation/rate-limit.service';
import { RunSimulationService } from '../../core/simulation/run-simulation.service';
import { errorMessage } from '../../shared/simulation/simulation-panel.component';
import { Creator } from '../../core/data/creator.types';
import { W2Response } from '../../core/simulation/simulation-w2.types';

type Side = 'a' | 'b';

interface CompareRow {
  key: string;
  label: string;
  unit: 'int' | 'usd' | 'usd2';
  a: number | null;
  b: number | null;
  /** Cost rows invert the reading: under A is a win for B, not a shortfall. */
  lowerIsBetter?: boolean;
  upperBound?: boolean;
}

/**
 * Roster comparison (D24 §4) — "what if we swapped Caylus for two mid-tier
 * creators?" Two rosters, both seeded from the Discovery selection, run
 * against the SAME budget via two free-mode `run-simulation` calls; results
 * render side-by-side with a B-vs-A delta per metric. Frontend-only and
 * ephemeral: comparisons aren't saved, and Discovery stays the only picking
 * surface — a chip here only excludes/includes a selected creator per side.
 */
@Component({
  selector: 'app-roster-comparison',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="sf-panel p-5" data-testid="roster-comparison">
      <div class="grid grid-cols-2 gap-4 mb-4">
        @for (side of SIDES; track side) {
          <div>
            <div class="text-[10px] uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">
              Roster {{ side.toUpperCase() }} ·
              <span [attr.data-testid]="'cmp-count-' + side">{{ idsFor(side).length }}</span> creators
            </div>
            <div class="flex flex-wrap gap-1.5">
              @for (c of creators(); track c.id) {
                <button type="button" (click)="toggle(side, c.id)"
                  class="sf-chip cursor-pointer"
                  [style.opacity]="isExcluded(side, c.id) ? 0.35 : 1"
                  [style.text-decoration]="isExcluded(side, c.id) ? 'line-through' : 'none'"
                  [attr.data-testid]="'cmp-chip-' + side + '-' + c.id">
                  {{ c.name }}
                </button>
              }
            </div>
          </div>
        }
      </div>

      <div class="flex items-end gap-3 mb-4">
        <label class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">
          Budget (shared)
          <input type="number" min="0" [value]="budget()" (change)="setBudget($event)"
            class="sf-input block px-2 py-1 text-xs w-32 mt-1" data-testid="cmp-budget" />
        </label>
        <label class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">
          Genre
          <select [value]="genre()" (change)="setGenre($event)"
            class="sf-input block px-2 py-1 text-xs mt-1" data-testid="cmp-genre">
            @for (g of genres(); track g) { <option [value]="g">{{ g }}</option> }
          </select>
        </label>
        <button type="button" (click)="run()" [disabled]="runDisabled()"
          class="sf-btn text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
          style="background: var(--color-accent); color: var(--color-accent-fg);" data-testid="cmp-run">
          {{ pending() ? 'Running…' : 'Compare' }}
        </button>
      </div>

      @if (error(); as e) {
        <p class="text-xs mb-3" style="color: var(--color-sf-red);" data-testid="cmp-error">{{ e }}</p>
      }

      @if (rows().length > 0) {
        <div class="overflow-x-auto" data-testid="cmp-results">
          <table class="w-full text-xs">
            <thead>
              <tr style="color: var(--color-text-muted);">
                <th class="text-left font-normal px-1 py-1"></th>
                <th class="text-right font-normal px-1 py-1">Roster A</th>
                <th class="text-right font-normal px-1 py-1">Roster B</th>
                <th class="text-right font-normal px-1 py-1">B vs A</th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.key) {
                <tr style="border-top: 1px solid var(--color-border); color: var(--color-text);"
                  [attr.data-testid]="'cmp-row-' + r.key">
                  <td class="px-1 py-1.5">
                    {{ r.label }}
                    @if (r.upperBound) {
                      <span class="text-[9px]" style="color: var(--color-sf-orange);">Upper bound — platforms overlap</span>
                    }
                  </td>
                  <td class="px-1 py-1.5 text-right">{{ fmt(r.a, r.unit) }}</td>
                  <td class="px-1 py-1.5 text-right">{{ fmt(r.b, r.unit) }}</td>
                  <td class="px-1 py-1.5 text-right"
                    [style.color]="deltaColor(delta(r), r.lowerIsBetter)"
                    [attr.data-testid]="'cmp-delta-' + r.key">
                    {{ deltaLabel(delta(r)) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>

          @if (platRows().length > 0) {
            <table class="w-full text-xs mt-3">
              <thead>
                <tr style="color: var(--color-text-muted);">
                  <th class="text-left font-normal px-1 py-1">Platform</th>
                  <th class="text-right font-normal px-1 py-1">Impr A</th>
                  <th class="text-right font-normal px-1 py-1">Impr B</th>
                  <th class="text-right font-normal px-1 py-1">Cost / conv A</th>
                  <th class="text-right font-normal px-1 py-1">Cost / conv B</th>
                </tr>
              </thead>
              <tbody>
                @for (p of platRows(); track p.platform) {
                  <tr style="border-top: 1px solid var(--color-border); color: var(--color-text);"
                    [attr.data-testid]="'cmp-plat-' + p.platform">
                    <td class="px-1 py-1.5">{{ p.platform }}</td>
                    <td class="px-1 py-1.5 text-right">{{ fmt(p.imprA, 'int') }}</td>
                    <td class="px-1 py-1.5 text-right">{{ fmt(p.imprB, 'int') }}</td>
                    <td class="px-1 py-1.5 text-right">{{ fmt(p.cpcA, 'usd2') }}</td>
                    <td class="px-1 py-1.5 text-right">{{ fmt(p.cpcB, 'usd2') }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }

          @for (side of SIDES; track side) {
            @if (resultFor(side)?.unallocatedMessage; as msg) {
              <p class="text-[11px] mt-2" style="color: var(--color-text-muted);"
                [attr.data-testid]="'cmp-unallocated-' + side">
                Roster {{ side.toUpperCase() }}: {{ msg }}
              </p>
            }
          }
        </div>
      }
    </div>
  `,
})
export class RosterComparisonComponent {
  private runSim = inject(RunSimulationService);
  private rateLimitSvc = inject(RateLimitService);
  private auth = inject(AuthService);

  readonly creators = input.required<Creator[]>();
  readonly genres = input<string[]>([]);
  readonly initialGenre = input<string>('');

  protected readonly SIDES: Side[] = ['a', 'b'];

  // Same default the single-run panel uses.
  protected readonly budget = signal(85_000);
  protected readonly genre = signal('');
  private readonly excludedA = signal<Set<number>>(new Set());
  private readonly excludedB = signal<Set<number>>(new Set());

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly resultA = signal<W2Response | null>(null);
  protected readonly resultB = signal<W2Response | null>(null);

  constructor() {
    // input() isn't readable at construction; genre seeds lazily on first read.
  }

  private excludedFor(side: Side): Set<number> {
    return side === 'a' ? this.excludedA() : this.excludedB();
  }

  protected idsFor(side: Side): number[] {
    const excluded = this.excludedFor(side);
    return this.creators().map((c) => c.id).filter((id) => !excluded.has(id));
  }

  protected isExcluded(side: Side, id: number): boolean {
    return this.excludedFor(side).has(id);
  }

  protected toggle(side: Side, id: number): void {
    const sig = side === 'a' ? this.excludedA : this.excludedB;
    sig.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected readonly runDisabled = computed(() => {
    if (this.pending()) return true;
    if (this.rateLimitSvc.check(this.auth.tier()).blocked) return true;
    return this.idsFor('a').length === 0 || this.idsFor('b').length === 0;
  });

  protected setBudget(ev: Event): void {
    const v = Number((ev.target as HTMLInputElement).value);
    if (!Number.isNaN(v) && v >= 0) this.budget.set(v);
  }

  protected setGenre(ev: Event): void {
    this.genre.set((ev.target as HTMLSelectElement).value);
  }

  private effectiveGenre(): string {
    return this.genre() || this.initialGenre();
  }

  async run(): Promise<void> {
    if (this.runDisabled()) return;
    this.pending.set(true);
    try {
      // Two runs, two increments — a comparison honestly costs two simulations.
      this.rateLimitSvc.increment();
      this.rateLimitSvc.increment();
      const base = { budget: this.budget(), genre: this.effectiveGenre() };
      const [a, b] = await Promise.all([
        this.runSim.runFree({ creators: this.idsFor('a').map((id) => ({ id })), ...base }),
        this.runSim.runFree({ creators: this.idsFor('b').map((id) => ({ id })), ...base }),
      ]);
      this.error.set(null);
      this.resultA.set(a);
      this.resultB.set(b);
    } catch (e: unknown) {
      // A half-failed comparison is not a comparison — drop both sides.
      this.resultA.set(null);
      this.resultB.set(null);
      this.error.set(errorMessage(e));
    } finally {
      this.pending.set(false);
    }
  }

  protected resultFor(side: Side): W2Response | null {
    return side === 'a' ? this.resultA() : this.resultB();
  }

  protected readonly rows = computed<CompareRow[]>(() => {
    const a = this.resultA();
    const b = this.resultB();
    if (!a || !b) return [];
    return [
      { key: 'impressions', label: 'Impressions', unit: 'int', a: a.totals.impressions, b: b.totals.impressions },
      { key: 'uniqueReach', label: 'Unique reach', unit: 'int', a: a.totals.uniqueReach.value, b: b.totals.uniqueReach.value, upperBound: true },
      { key: 'engagedClicks', label: 'Eng. clicks', unit: 'int', a: a.totals.engagedClicks, b: b.totals.engagedClicks },
      { key: 'conversions', label: 'Conversions', unit: 'int', a: a.totals.conversions.value, b: b.totals.conversions.value, upperBound: true },
      { key: 'cost', label: 'Cost', unit: 'usd', a: a.totals.cost, b: b.totals.cost, lowerIsBetter: true },
      { key: 'costPerConversion', label: 'Cost per conversion', unit: 'usd2', a: a.totals.costPerConversion, b: b.totals.costPerConversion, lowerIsBetter: true },
    ];
  });

  protected readonly platRows = computed(() => {
    const a = this.resultA();
    const b = this.resultB();
    if (!a || !b) return [];
    const names = [...new Set([...a.platforms, ...b.platforms].map((p) => p.platform))];
    return names.map((platform) => {
      const pa = a.platforms.find((p) => p.platform === platform);
      const pb = b.platforms.find((p) => p.platform === platform);
      return {
        platform,
        imprA: pa?.impressions ?? null,
        imprB: pb?.impressions ?? null,
        cpcA: pa?.costPerConversion ?? null,
        cpcB: pb?.costPerConversion ?? null,
      };
    });
  });

  protected delta(r: CompareRow): number | null {
    return r.a != null && r.b != null && r.a !== 0 ? Math.round((r.b / r.a - 1) * 100) : null;
  }

  protected deltaLabel(d: number | null): string {
    if (d == null) return '—';
    return `${d > 0 ? '+' : ''}${d}%`;
  }

  protected deltaColor(d: number | null, lowerIsBetter = false): string {
    if (d == null || d === 0) return 'var(--color-text-muted)';
    const better = lowerIsBetter ? d < 0 : d > 0;
    return better ? 'var(--color-sf-green)' : 'var(--color-sf-orange)';
  }

  protected fmt(v: number | null, unit: CompareRow['unit']): string {
    if (v == null) return '—';
    if (unit === 'usd') return `$${Math.round(v).toLocaleString('en-US')}`;
    if (unit === 'usd2') return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return Math.round(v).toLocaleString('en-US');
  }
}
