import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import {
  CreatorMatcherService,
  MatchResult,
  MatchedCreator,
} from '../../../core/creator-matcher/creator-matcher.service';

/**
 * Creator Matcher panel — in-campaign shortlist (planning only).
 * See simfluence-backend/docs/superpowers/specs/2026-07-03-creator-matcher-design.md §5.
 *
 * Self-contained (fetch + render + emit) so a future standalone surface can
 * reuse it without a shared/ promotion (YAGNI). Roster mutation stays with the
 * parent section — this component only emits an `add` for the chosen item.
 */
@Component({
  selector: 'app-creator-matcher-panel',
  standalone: true,
  template: `
    <div class="mt-2" data-testid="creator-matcher-panel">
      <div
        class="text-[10px] uppercase tracking-wider mb-3 flex items-center gap-2"
        style="color: var(--color-text-muted);"
      >
        <span>Creator Matcher</span>
      </div>

      @if (loading()) {
        <div class="flex flex-col gap-3" data-testid="matcher-skeletons">
          @for (i of [1, 2, 3, 4]; track i) {
            <div
              class="h-16 rounded animate-pulse"
              style="background: var(--color-bg-3);"
              data-testid="matcher-skeleton-card"
            ></div>
          }
        </div>
      } @else {
        <div
          class="rounded px-3 py-2 mb-3 text-xs font-medium"
          style="background: var(--color-bg-2); border: 1px solid var(--color-border); color: var(--color-text);"
          data-testid="matcher-why-banner"
        >
          {{ whyBanner() }}
        </div>

        @if (result().creators.length === 0) {
          <div
            class="p-6 rounded-lg text-xs text-center"
            style="background: var(--color-bg-3); color: var(--color-text-muted);"
            data-testid="matcher-empty"
          >
            No creator matches for these settings yet. Try "Browse all" to pick creators directly.
          </div>
        } @else {
          <div class="flex flex-col gap-3 max-h-[22rem] overflow-y-auto pr-1" data-testid="matcher-cards">
            @for (m of result().creators; track m.creator.id) {
              <div
                class="flex items-center gap-2.5 p-2.5 rounded"
                style="background: var(--color-bg-3);"
                [attr.data-testid]="'matcher-card-' + m.creator.id"
              >
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                  [style.background]="(m.creator.color || 'var(--color-sf-blue)') + '22'"
                  [style.color]="m.creator.color || 'var(--color-sf-blue)'"
                >
                  {{ initialsOf(m.creator.name) }}
                </div>

                <div class="flex-1 min-w-0">
                  <div class="text-xs font-semibold truncate" style="color: var(--color-text);">
                    {{ m.creator.name }}
                  </div>
                  <div class="text-[9px] truncate" style="color: var(--color-text-muted);">
                    {{ '@' + (m.creator.handle || '—') }} · {{ m.creator.platform }} ·
                    {{ reachLabel(m.reach) }} reach · ~{{ rateLabel(m) }}
                  </div>
                  <div class="text-[9px] mt-0.5 truncate" style="color: var(--color-text-muted);">
                    {{ m.why }}
                  </div>
                </div>

                <div class="flex items-center gap-3 shrink-0">
                  <div class="flex items-baseline gap-1">
                    <span class="text-[9px] uppercase tracking-wide" style="color: var(--color-text-muted);">CPI</span>
                    <span class="text-sm font-bold" [style.color]="cpiColor(m.best_cpi)">{{ m.best_cpi ?? '—' }}</span>
                  </div>
                  @if (m.gfi !== null) {
                    <div class="flex items-center gap-1">
                      <span class="text-[9px] uppercase tracking-wide" style="color: var(--color-text-muted);">GFI</span>
                      <span class="text-xs font-bold px-1.5 py-0.5 rounded" style="color: var(--color-bg);" [style.background]="gfiColor(m.gfi)">{{ m.gfi }}%</span>
                    </div>
                  }
                  <button type="button" (click)="add.emit(m)" [disabled]="disabled()" class="sf-btn sf-btn-ghost text-[9px] disabled:opacity-40" [attr.data-testid]="'matcher-add-' + m.creator.id">+ Add</button>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class CreatorMatcherPanelComponent {
  private matcher = inject(CreatorMatcherService);

  readonly genre = input.required<string>();
  readonly budget = input.required<number | null>();
  readonly objectives = input<string[]>([]);
  readonly excludeIds = input<number[]>([]);
  /** Roster-locked or read-only campaign → disable the add buttons. */
  readonly disabled = input(false);

  readonly add = output<MatchedCreator>();

  protected readonly loading = signal(false);
  protected readonly result = signal<MatchResult>({
    optimizedFor: 'fit',
    budgetConstrained: false,
    budget: null,
    creators: [],
  });

  // Refetch when the settings that affect matching change. Stringified so the
  // effect's signal read has stable equality (arrays are new references each render).
  private readonly fetchKey = computed(() => {
    return [
      this.genre(),
      this.budget() ?? '',
      (this.objectives() ?? []).join(','),
      (this.excludeIds() ?? []).slice().sort((a, b) => a - b).join(','),
    ].join('|');
  });

  constructor() {
    effect(() => {
      this.fetchKey(); // establish dependency
      void this.load();
    });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.matcher.match({
        genre: this.genre(),
        budget: this.budget(),
        objectives: this.objectives(),
        excludeIds: this.excludeIds(),
        limit: 12,
      });
      this.result.set(res);
    } finally {
      this.loading.set(false);
    }
  }

  /** One-line "why" copy from the derived axis + budget. */
  protected whyBanner(): string {
    const r = this.result();
    const axis = r.optimizedFor === 'reach' ? 'reach' : 'audience fit';
    const verb = `Maximizing ${axis}`;
    return r.budgetConstrained && r.budget != null
      ? `${verb} within your ${this.moneyLabel(r.budget)} budget`
      : verb;
  }

  protected moneyLabel(v: number): string {
    if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1) + 'm';
    if (v >= 1_000) return '$' + Math.round(v / 1_000) + 'k';
    return '$' + v;
  }

  protected reachLabel(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return Math.round(n / 1_000) + 'K';
    return String(n);
  }

  /** Midpoint of the mixed-format rate range, compactly formatted. */
  protected rateLabel(m: MatchedCreator): string {
    const mix = m.rateEstimate?.ranges?.mix;
    if (!mix || mix.length !== 2) return '—';
    return this.moneyLabel(Math.round((mix[0] + mix[1]) / 2));
  }

  protected cpiColor(cpi: number | null): string {
    if (cpi == null) return 'var(--color-text-muted)';
    if (cpi >= 80) return 'var(--color-sf-green)';
    if (cpi >= 60) return 'var(--color-sf-orange)';
    return 'var(--color-sf-red)';
  }

  protected gfiColor(gfi: number): string {
    if (gfi >= 70) return 'var(--color-sf-green)';
    if (gfi >= 55) return 'var(--color-sf-orange)';
    return 'var(--color-sf-red)';
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
