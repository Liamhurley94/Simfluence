import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AdminUsageService } from '../../core/admin/admin-usage.service';
import { BarChartComponent } from '../../shared/bar-chart/bar-chart.component';
import { SpinnerComponent } from '../../shared/spinner/spinner.component';
import { DailyUsage, YoutubeQuotaStatus } from '../../core/admin/admin-usage.types';

const RANGES: Array<7 | 14 | 30> = [7, 14, 30];

@Component({
  selector: 'app-admin-usage',
  standalone: true,
  imports: [BarChartComponent, SpinnerComponent, DecimalPipe],
  template: `
    <div data-testid="admin-usage" class="flex flex-col gap-6">
      <!-- Range toggle -->
      <div class="flex items-center gap-2">
        <span class="text-xs" style="color: var(--color-text-muted);">Last</span>
        @for (n of ranges; track n) {
          <button
            type="button"
            (click)="setRange(n)"
            class="sf-btn sf-btn-ghost text-xs"
            [style.border-color]="range() === n ? 'var(--color-sf-gold)' : 'var(--color-border)'"
            [style.color]="range() === n ? 'var(--color-text)' : 'var(--color-text-muted)'"
            [attr.data-testid]="'usage-range-' + n"
          >{{ n }} days</button>
        }
      </div>

      @if (loading() && daily().length === 0) {
        <div class="sf-card p-6"><app-spinner label="Loading usage…" /></div>
      } @else if (error()) {
        <p class="sf-card p-4 text-sm" style="color: var(--color-sf-red);">{{ error() }}</p>
      } @else {
        <!-- YouTube -->
        <section class="sf-card p-4 flex flex-col gap-3">
          <header class="flex items-baseline justify-between">
            <h2 class="text-sm font-bold uppercase tracking-wider" style="color: var(--color-text);">YouTube quota</h2>
            <span class="text-xs" style="color: var(--color-text-muted);">
              today <strong style="color: var(--color-text);">{{ (status()?.used_today ?? 0) | number }}</strong>
              / {{ (status()?.effective_ceiling ?? 0) | number }} units
            </span>
          </header>

          <div class="h-1.5 rounded-sm overflow-hidden" style="background: var(--color-bg-3);">
            <div class="h-full transition-all" [style.width.%]="budgetPct()" [style.background]="budgetColor()" data-testid="yt-budget-bar"></div>
          </div>

          <app-bar-chart [values]="ytValues()" [labels]="labels()" [scaleMax]="status()?.effective_ceiling" [showAxis]="true" [colorFor]="ytColor" [height]="100" />

          <p class="text-xs" style="color: var(--color-text-muted);" data-testid="yt-limit-line">
            @if (isElevated()) {
              Limit: <strong style="color: var(--color-text);">{{ status()?.effective_ceiling | number }}</strong> units/day
              <span style="color: var(--color-sf-gold);">(temporarily raised)</span> — reverts to
              {{ status()?.default_limit | number }} in {{ revertDays() }} days.
            } @else {
              Limit: <strong style="color: var(--color-text);">{{ (status()?.default_limit ?? 9500) | number }}</strong> units/day.
            }
          </p>
        </section>

        <!-- Twitch -->
        <section class="sf-card p-4 flex flex-col gap-3">
          <header class="flex items-baseline justify-between">
            <h2 class="text-sm font-bold uppercase tracking-wider" style="color: var(--color-text);">Twitch calls</h2>
            <span class="text-xs" style="color: var(--color-text-muted);">
              today <strong style="color: var(--color-text);">{{ twToday() | number }}</strong> calls
            </span>
          </header>
          <app-bar-chart [values]="twValues()" [labels]="labels()" color="#8b5cf6" [height]="100" />
          <p class="text-xs" style="color: var(--color-text-muted);">
            Informational — Twitch is rate-limited per-minute, not per-day, so there's no daily budget to track.
          </p>
        </section>

        <p class="text-[11px]" style="color: var(--color-text-muted);">Days are Pacific time (YouTube's quota reset).</p>
      }
    </div>
  `,
})
export class AdminUsageComponent {
  private svc = inject(AdminUsageService);

  protected readonly ranges = RANGES;

  readonly range = signal<7 | 14 | 30>(7);
  readonly daily = signal<DailyUsage[]>([]);
  readonly status = signal<YoutubeQuotaStatus | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly ytValues = computed(() => this.daily().map((d) => d.yt_units));
  readonly twValues = computed(() => this.daily().map((d) => d.tw_calls));
  readonly labels = computed(() => this.daily().map((d) => d.day));
  readonly twToday = computed(() => {
    const list = this.daily();
    return list.length ? list[list.length - 1].tw_calls : 0;
  });

  readonly budgetPct = computed(() => {
    const s = this.status();
    return s && s.effective_ceiling > 0 ? Math.round((s.used_today / s.effective_ceiling) * 100) : 0;
  });
  readonly isElevated = computed(() => {
    const s = this.status();
    return !!s && s.effective_ceiling > s.default_limit;
  });
  readonly revertDays = computed(() => {
    const s = this.status();
    if (!s) return 0;
    const ms = new Date(s.elevated_until).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 86_400_000));
  });

  protected budgetColor(): string {
    const p = this.budgetPct();
    return p >= 95 ? 'var(--color-sf-red)' : p >= 80 ? 'var(--color-sf-gold)' : 'var(--color-sf-green)';
  }

  // Per-bar colour for the YouTube chart — shades each day by its % of the ceiling.
  protected readonly ytColor = (v: number): string => {
    const s = this.status();
    const pct = s && s.effective_ceiling > 0 ? (v / s.effective_ceiling) * 100 : 0;
    return pct >= 95 ? 'var(--color-sf-red)' : pct >= 80 ? 'var(--color-sf-gold)' : 'var(--color-sf-green)';
  };

  constructor() {
    void this.load();
  }

  async setRange(n: 7 | 14 | 30): Promise<void> {
    this.range.set(n);
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [daily, status] = await Promise.all([this.svc.usage(this.range()), this.svc.youtubeQuotaStatus()]);
      this.daily.set(daily);
      this.status.set(status);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load usage');
    } finally {
      this.loading.set(false);
    }
  }
}
