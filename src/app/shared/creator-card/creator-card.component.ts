import { Component, computed, input, output } from '@angular/core';
import { Creator } from '../../core/data/creator.types';

const PLATFORM_COLORS: Record<string, string> = {
  YouTube: '#FF0000',
  Twitch: '#9146FF',
  Instagram: '#E1306C',
  TikTok: '#FFFFFF',
  Kick: '#53FC18',
  X: '#1DA1F2',
};

@Component({
  selector: 'app-creator-card',
  standalone: true,
  template: `
    <div
      class="rounded-lg p-4 transition cursor-pointer"
      [style.background]="'var(--color-bg-2)'"
      [style.border]="selected() ? '2px solid ' + creator().color : '1px solid var(--color-border)'"
      (click)="onToggle()"
      data-testid="creator-card"
    >
      <div class="flex items-start gap-3 mb-3">
        <div
          class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          [style.background]="creator().color"
          [style.color]="'#fff'"
        >
          {{ initials() }}
        </div>
        <div class="flex-1 min-w-0">
          <div
            class="font-semibold text-sm truncate"
            style="color: var(--color-text);"
            data-testid="creator-name"
          >
            {{ creator().name }}
          </div>
          <div class="text-xs truncate" style="color: var(--color-text-muted);">
            {{ creator().handle }}
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-1 mb-3">
        @for (p of platforms(); track p) {
          <span
            class="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider"
            [style.background]="platformColor(p)"
            [style.color]="p === 'TikTok' ? '#000' : '#fff'"
          >
            {{ p }}
          </span>
        }
      </div>

      <div class="grid grid-cols-3 gap-1 mb-3 text-center">
        <div>
          <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
            Subs
          </div>
          <div class="text-xs font-semibold" style="color: var(--color-text);">
            {{ creator().subs }}
          </div>
        </div>
        <div>
          <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
            Avg Views
          </div>
          <div class="text-xs font-semibold" style="color: var(--color-text);">
            {{ creator().avgViews }}
          </div>
        </div>
        <div>
          <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
            Eng
          </div>
          <div class="text-xs font-semibold" style="color: var(--color-text);">
            {{ creator().eng }}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-1 mb-3">
        <div class="text-center p-2 rounded" style="background: var(--color-bg-3);">
          <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
            CPI
          </div>
          <div class="text-sm font-bold" [style.color]="scoreColor(creator().cpi)">
            {{ creator().cpi }}
          </div>
        </div>
        <div class="text-center p-2 rounded" style="background: var(--color-bg-3);">
          <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
            GFI
          </div>
          <div class="text-sm font-bold" [style.color]="scoreColor(creator().gfi)">
            {{ creator().gfi }}
          </div>
        </div>
      </div>

      <div class="mb-3">
        <div class="text-[9px] uppercase tracking-wider mb-1" style="color: var(--color-text-muted);">
          Rate estimate
        </div>
        <div
          class="text-xs font-semibold"
          [class.blur-sm]="!canSeeRates()"
          [class.select-none]="!canSeeRates()"
          style="color: var(--color-sf-gold);"
          data-testid="creator-rate"
        >
          {{ rateLabel() }}
        </div>
      </div>

      <button
        type="button"
        class="w-full py-2 rounded text-xs font-semibold uppercase tracking-wider"
        [style.background]="selected() ? 'var(--color-sf-green)' : 'var(--color-sf-blue)'"
        [style.color]="'#fff'"
        (click)="onToggle(); $event.stopPropagation()"
        data-testid="creator-toggle"
      >
        {{ selected() ? '✓ Selected' : '+ Select' }}
      </button>
    </div>
  `,
})
export class CreatorCardComponent {
  readonly creator = input.required<Creator>();
  readonly selected = input(false);
  readonly canSeeRates = input(false);
  readonly toggle = output<number>();

  readonly platforms = computed(() => {
    const c = this.creator();
    return c.allPlatforms?.length ? c.allPlatforms : [c.platform];
  });

  readonly initials = computed(() => {
    const parts = this.creator().name.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase();
  });

  readonly rateLabel = computed(() => {
    const rates = this.creator().rates;
    if (rates?.mix) return this.formatRange(rates.mix);
    if (rates?.int) return this.formatRange(rates.int);
    if (rates?.ded) return this.formatRange(rates.ded);
    return '—';
  });

  platformColor(p: string): string {
    return PLATFORM_COLORS[p] ?? '#888';
  }

  scoreColor(score: number): string {
    if (score >= 80) return 'var(--color-sf-green)';
    if (score >= 60) return 'var(--color-sf-orange)';
    return 'var(--color-sf-red)';
  }

  onToggle(): void {
    this.toggle.emit(this.creator().id);
  }

  private formatRange([lo, hi]: [number, number]): string {
    return `$${this.compact(lo)}–$${this.compact(hi)}`;
  }

  private compact(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return Math.round(n / 1_000) + 'K';
    return String(n);
  }
}
