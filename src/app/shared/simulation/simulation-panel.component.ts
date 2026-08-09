import { Component, computed, effect, inject, input, linkedSignal, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';
import { SimCreatorBreakdownComponent } from './sim-creator-breakdown.component';
import { SimBenchmarkPanelComponent } from './sim-benchmark-panel.component';
import { AuthService } from '../../core/auth/auth.service';
import { RunSimulationService } from '../../core/simulation/run-simulation.service';
import { RateLimitService } from '../../core/simulation/rate-limit.service';
import {
  DEFAULT_AOV,
  DEFAULT_DURATION_WEEKS,
  Format,
  OBJECTIVES,
  Objective,
  SimResult,
} from '../../core/simulation/simulation.types';
import { Creator } from '../../core/data/creator.types';
import { partitionByLiveData } from '../../core/simulation/live-stats';

const FORMATS: Format[] = ['Integrated', 'Mixed', 'Dedicated'];

@Component({
  selector: 'app-simulation-panel',
  standalone: true,
  imports: [DecimalPipe, FormsModule, IconComponent, SimCreatorBreakdownComponent, SimBenchmarkPanelComponent],
  template: `
    @if (!readonly()) {
      <!-- Controls -->
      <div
        class="sf-panel p-4 mb-6 grid gap-4"
        style="grid-template-columns: repeat(3, minmax(0,1fr));"
        data-testid="sim-controls"
      >
        <div>
          <label
            class="text-[10px] uppercase tracking-wider mb-1 block"
            style="color: var(--color-text-muted);"
          >
            Budget (USD)
          </label>
          <input
            type="number"
            min="0"
            step="1000"
            [ngModel]="budget()"
            (ngModelChange)="budget.set($event || 0)"
            class="sf-input"
            data-testid="sim-budget"
          />
        </div>
        @if (!perCreatorFormat()) {
          <div>
            <label
              class="text-[10px] uppercase tracking-wider mb-1 block"
              style="color: var(--color-text-muted);"
            >
              Format
            </label>
            <select
              [ngModel]="format()"
              (ngModelChange)="format.set($event)"
              class="sf-select"
              data-testid="sim-format"
            >
              @for (f of formats; track f) {
                <option [ngValue]="f">{{ f }}</option>
              }
            </select>
          </div>
        }
        <div>
          <label
            class="text-[10px] uppercase tracking-wider mb-1 block"
            style="color: var(--color-text-muted);"
          >
            Genre
          </label>
          <select
            [ngModel]="genre()"
            (ngModelChange)="genre.set($event)"
            class="sf-select"
            data-testid="sim-genre"
          >
            @for (g of genres(); track g) {
              <option [ngValue]="g">{{ g }}</option>
            }
          </select>
        </div>
        <div>
          <label
            class="text-[10px] uppercase tracking-wider mb-1 block"
            style="color: var(--color-text-muted);"
          >
            Avg. conversion value (USD)
          </label>
          <input
            type="number"
            min="1"
            step="5"
            [ngModel]="aov()"
            (ngModelChange)="aov.set($event || defaultAov)"
            class="sf-input"
            data-testid="sim-aov"
          />
        </div>
        <div>
          <label
            class="text-[10px] uppercase tracking-wider mb-1 block"
            style="color: var(--color-text-muted);"
          >
            Duration –
            <span data-testid="sim-duration-label">
              {{ durationWeeks() }} week{{ durationWeeks() === 1 ? '' : 's' }}
            </span>
          </label>
          <input
            type="range"
            min="1"
            max="12"
            step="1"
            [ngModel]="durationWeeks()"
            (ngModelChange)="durationWeeks.set(+$event)"
            class="w-full"
            style="accent-color: var(--color-sf-blue);"
            data-testid="sim-duration"
          />
        </div>
      </div>

      <!-- Objectives -->
      <div class="mb-6" data-testid="sim-objectives">
        <div
          class="text-[10px] uppercase tracking-wider mb-2"
          style="color: var(--color-text-muted);"
        >
          Campaign objectives
        </div>
        <div class="flex flex-wrap gap-1">
          @for (o of objectives; track o) {
            <button
              type="button"
              (click)="toggleObjective(o)"
              class="sf-chip cursor-pointer"
              [style.background]="selectedObjectives().includes(o) ? 'var(--color-sf-blue)' : ''"
              [style.color]="selectedObjectives().includes(o) ? 'white' : ''"
              [style.border-color]="selectedObjectives().includes(o) ? 'var(--color-sf-blue)' : ''"
              [attr.data-testid]="'sim-obj-' + slug(o)"
            >
              {{ o }}
            </button>
          }
        </div>
      </div>

      <!-- Rate limit banner -->
      @if (limit().blocked) {
        <div
          class="p-3 mb-4 rounded-lg text-xs"
          style="background: color-mix(in srgb, var(--color-sf-red) 8%, transparent); border: 1px solid var(--color-sf-red); color: var(--color-sf-red);"
          data-testid="sim-rate-limit"
        >
          You've used all {{ limit().limit }} simulations for this month. Upgrade your tier for more
          runs.
        </div>
      } @else if (!isUnlimited()) {
        <div
          class="text-xs mb-4"
          style="color: var(--color-text-muted);"
          data-testid="sim-rate-usage"
        >
          {{ limit().remaining }} of {{ limit().limit }} simulations remaining this month.
        </div>
      }

      <!-- Actions -->
      <div class="flex items-center justify-end gap-2 mb-6" data-testid="sim-actions">
        <button
          type="button"
          (click)="run()"
          [disabled]="runDisabled()"
          class="sf-btn text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
          style="background: var(--color-sf-orange); color: var(--color-bg);"
          data-testid="sim-run"
        >
          @if (!pending()) {
            <app-icon name="play" [size]="12" style="display:inline-block;vertical-align:middle;" />
          }
          {{ pending() ? 'Running…' : result() ? 'Re-run' : 'Run simulation' }}
        </button>
        <ng-content></ng-content>
      </div>
    }

    @if (excludedNoData().length > 0) {
      <p class="text-xs mb-3" style="color: var(--color-text-muted);" data-testid="sim-excluded-note">
        {{ excludedNoData().length }} creator{{ excludedNoData().length === 1 ? '' : 's' }} excluded — no live data yet (pending sync).
      </p>
    }

    @if (result(); as r) {
      @if (unaffordableCount() > 0) {
        <div
          class="p-3 mb-4 rounded-lg text-xs"
          style="background: color-mix(in srgb, var(--color-sf-red) 8%, transparent); border: 1px solid var(--color-sf-red); color: var(--color-sf-red);"
          data-testid="sim-budget-warning"
        >
          Budget covers {{ r.reachableCount }} of {{ forecastRosterSize() }}
          creators – {{ unaffordableCount() }} were left out of this forecast. Raise the budget or
          remove creators.
        </div>
      }

      <!-- Bands -->
      <div class="grid grid-cols-3 gap-3 mb-6" data-testid="sim-bands">
        <div
          class="sf-card p-4"
          style="border-color: var(--color-sf-red); border-width: 2px;"
          data-testid="sim-p10"
        >
          <div class="text-[10px] uppercase tracking-wider mb-2" style="color: var(--color-sf-red);">
            P10 · Worst case
          </div>
          <div class="text-3xl font-bold" style="color: var(--color-text);">
            {{ r.p10.impressions | number: '1.0-0' }}
          </div>
          <div class="text-xs mb-3" style="color: var(--color-text-muted);">impressions</div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">CTR</div>
              <div class="font-bold" style="color: var(--color-text);">{{ r.p10.ctr }}%</div>
            </div>
            <div>
              <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">ROAS</div>
              <div class="font-bold" style="color: var(--color-text);">{{ r.p10.roas }}×</div>
            </div>
          </div>
        </div>
        <div
          class="sf-card p-4"
          style="border-color: var(--color-sf-gold); border-width: 2px;"
          data-testid="sim-p50"
        >
          <div
            class="text-[10px] uppercase tracking-wider mb-2"
            style="color: var(--color-sf-gold);"
          >
            P50 · Base case
          </div>
          <div class="text-3xl font-bold" style="color: var(--color-text);">
            {{ r.p50.impressions | number: '1.0-0' }}
          </div>
          <div class="text-xs mb-3" style="color: var(--color-text-muted);">impressions</div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">CTR</div>
              <div class="font-bold" style="color: var(--color-text);">{{ r.p50.ctr }}%</div>
            </div>
            <div>
              <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">ROAS</div>
              <div class="font-bold" style="color: var(--color-text);">{{ r.p50.roas }}×</div>
            </div>
          </div>
        </div>
        <div
          class="sf-card p-4"
          style="border-color: var(--color-sf-green); border-width: 2px;"
          data-testid="sim-p90"
        >
          <div
            class="text-[10px] uppercase tracking-wider mb-2"
            style="color: var(--color-sf-green);"
          >
            P90 · Best case
          </div>
          <div class="text-3xl font-bold" style="color: var(--color-text);">
            {{ r.p90.impressions | number: '1.0-0' }}
          </div>
          <div class="text-xs mb-3" style="color: var(--color-text-muted);">impressions</div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">CTR</div>
              <div class="font-bold" style="color: var(--color-text);">{{ r.p90.ctr }}%</div>
            </div>
            <div>
              <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">ROAS</div>
              <div class="font-bold" style="color: var(--color-text);">{{ r.p90.roas }}×</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Core metrics grid -->
      <div
        class="sf-card overflow-hidden"
        data-testid="sim-metrics"
      >
        <div
          class="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold"
          style="background: var(--color-sf-blue); color: var(--color-bg);"
        >
          Base case metrics
        </div>
        <div class="grid grid-cols-6 gap-0">
          <div class="p-4 border-r" style="border-color: var(--color-border);">
            <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">
              Impressions
            </div>
            <div class="text-lg font-bold" style="color: var(--color-text);">
              {{ r.impressions | number: '1.0-0' }}
            </div>
          </div>
          <div class="p-4 border-r" style="border-color: var(--color-border);">
            <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">Clicks</div>
            <div class="text-lg font-bold" style="color: var(--color-text);">
              {{ r.clicks | number: '1.0-0' }}
            </div>
          </div>
          <div class="p-4 border-r" style="border-color: var(--color-border);">
            <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">CTR</div>
            <div class="text-lg font-bold" style="color: var(--color-text);">{{ r.ctr }}%</div>
          </div>
          <div class="p-4 border-r" style="border-color: var(--color-border);">
            <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">CVR</div>
            <div class="text-lg font-bold" style="color: var(--color-text);">{{ r.cvr }}%</div>
          </div>
          <div class="p-4 border-r" style="border-color: var(--color-border);">
            <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">
              Conversions
            </div>
            <div class="text-lg font-bold" style="color: var(--color-text);">
              {{ r.conversions | number: '1.0-0' }}
            </div>
          </div>
          <div class="p-4">
            <div class="text-[10px] uppercase" style="color: var(--color-text-muted);">
              ROAS (indicative)
            </div>
            <div class="text-lg font-bold" style="color: var(--color-sf-gold);" data-testid="sim-roas-range">
              {{ r.roasRange }}
            </div>
            <div class="text-[9px] mt-0.5" style="color: var(--color-text-muted);">
              Range — depends on attribution &amp; product price
            </div>
          </div>
        </div>
      </div>

      @if (r.creatorBreakdowns?.length) {
        <app-sim-creator-breakdown [breakdowns]="r.creatorBreakdowns!" [creators]="creators()" />
      }

      <app-sim-benchmark-panel [result]="r" />
    }
  `,
})
export class SimulationPanelComponent {
  private runSim = inject(RunSimulationService);
  private rateLimitSvc = inject(RateLimitService);
  private auth = inject(AuthService);

  readonly creators = input.required<Creator[]>();
  // Creators with no live view metric are excluded from the forecast (no stale
  // fallback); surfaced so the omission is explicit to the user.
  protected readonly excludedNoData = computed(() => partitionByLiveData(this.creators()).excluded);
  // Snapshot of how many creators were actually sent to the edge fn on the last
  // run, captured in run() before the await. `creators()` is live and can change
  // while a result sits on screen (e.g. the campaign roster is edited elsewhere
  // without re-running) – pairing that live count with the frozen `reachableCount`
  // from an old result would describe a forecast that was never actually run.
  protected readonly forecastRosterSize = signal(0);
  // The forecast's greedy budget fit drops creators the budget can't cover.
  // Without this the omission is invisible – the headline just quietly shrinks.
  protected readonly unaffordableCount = computed(() => {
    const r = this.result();
    if (!r) return 0;
    return Math.max(0, this.forecastRosterSize() - r.reachableCount);
  });
  readonly initialBudget = input<number>(85_000);
  readonly initialGenre = input<string>('');
  readonly initialObjectives = input<string[]>([]);
  readonly initialAov = input<number>(DEFAULT_AOV);
  readonly initialDurationWeeks = input<number>(DEFAULT_DURATION_WEEKS);
  readonly genres = input<string[]>([]);
  readonly subMode = input<string | undefined>(undefined);
  readonly readonly = input<boolean>(false);
  readonly autoRun = input<boolean>(false);
  // Per-creator format mode (campaign forecast): hides the global Format dropdown
  // and sends each creator's own format instead. `creatorFormats` maps creatorId
  // → format; the top-level format stays the default fallback. Standalone sim
  // leaves both defaulted (global dropdown, single format).
  readonly perCreatorFormat = input<boolean>(false);
  readonly creatorFormats = input<Record<number, string>>({});
  readonly simulated = output<SimResult>();

  protected readonly objectives = OBJECTIVES;
  protected readonly formats = FORMATS;

  protected readonly budget = linkedSignal(() => this.initialBudget());
  protected readonly genre = linkedSignal(() => this.initialGenre());
  protected readonly format = signal<Format>('Integrated');
  protected readonly defaultAov = DEFAULT_AOV;
  protected readonly aov = linkedSignal(() => this.initialAov());
  protected readonly durationWeeks = linkedSignal(() => this.initialDurationWeeks());
  // Seeded from the campaign's persisted objectives (mirrors budget/genre).
  // Filter to the canonical buckets so stale/legacy values are ignored.
  protected readonly selectedObjectives = linkedSignal<Objective[]>(() =>
    OBJECTIVES.filter((o) => this.initialObjectives().includes(o)),
  );
  protected readonly result = signal<SimResult | null>(null);

  protected readonly pending = this.runSim.pending;
  protected readonly limit = computed(() => this.rateLimitSvc.check(this.auth.tier()));
  protected readonly isUnlimited = computed(() => !Number.isFinite(this.limit().limit));
  protected readonly runDisabled = computed(
    () => this.readonly() || this.limit().blocked || this.pending() || this.creators().length === 0,
  );

  // Fire one automatic run when the host opts in (autoRun) and the creators have
  // loaded — e.g. arriving from Discovery's "Simulate selected". Deferred to a
  // microtask so `pending` isn't written synchronously inside the effect, and
  // guarded so it never fires twice or while the rate limit blocks it.
  private autoRan = false;
  constructor() {
    effect(() => {
      if (this.autoRun() && !this.autoRan && this.creators().length > 0 && !this.runDisabled()) {
        this.autoRan = true;
        queueMicrotask(() => void this.run());
      }
    });
  }

  async run(): Promise<void> {
    if (this.runDisabled()) return;
    this.rateLimitSvc.increment();
    // Snapshot before the await – `creators()` can change while the request is
    // in flight, and the count paired with this result's `reachableCount` must
    // describe what was actually sent, not whatever the roster is by the time
    // the response lands.
    const rosterSize = partitionByLiveData(this.creators()).included.length;
    const r = await this.runSim.run({
      creators: this.creators(),
      budget: this.budget(),
      // In per-creator mode the top-level format is only the fallback; each
      // creator's own format rides on `creatorFormats`. Otherwise the global
      // dropdown's format applies to everyone (no per-creator formats sent).
      format: this.format(),
      genre: this.genre(),
      objectives: this.selectedObjectives(),
      subMode: this.subMode(),
      aov: this.aov(),
      durationWeeks: this.durationWeeks(),
      creatorFormats: this.perCreatorFormat() ? this.creatorFormats() : undefined,
    });
    if (r) {
      this.result.set(r);
      this.forecastRosterSize.set(rosterSize);
      this.simulated.emit(r);
    }
  }

  toggleObjective(o: Objective): void {
    this.selectedObjectives.update((l) => (l.includes(o) ? l.filter((x) => x !== o) : [...l, o]));
  }
  slug(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
}
