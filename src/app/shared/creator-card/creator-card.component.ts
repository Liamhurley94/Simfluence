import { Component, computed, inject, input, output } from '@angular/core';
import { CREATOR_TIER_COLORS, Creator, tierForSubs } from '../../core/data/creator.types';
import { CreatorProfileService } from '../../core/creator-profile/creator-profile.service';
import { computeRateRanges } from '../../core/rates/rate-estimate';
import { Format } from '../../core/simulation/simulation.types';

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
        <button
          type="button"
          (click)="openProfile($event)"
          class="w-6 h-6 rounded text-xs flex items-center justify-center shrink-0"
          style="background: var(--color-bg-3); color: var(--color-text-muted);"
          aria-label="View creator profile"
          title="View profile"
          data-testid="creator-view-profile"
        >
          ⓘ
        </button>
      </div>

      <div class="flex flex-wrap gap-1 mb-3 items-center">
        <span
          class="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm uppercase tracking-wider"
          [style.background]="tierBg()"
          [style.color]="tierFg()"
          [style.border]="'1px solid ' + tierBorder()"
          data-testid="creator-tier-badge"
        >
          {{ tier() }}
        </span>
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

      @if (creator().ytStats; as yt) {
        <div class="grid grid-cols-3 gap-1 mb-1 text-center">
          <div>
            <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
              Subs
            </div>
            <div class="text-xs font-semibold" style="color: var(--color-sf-green);">
              {{ compact(yt.subscriberCount) }}
            </div>
          </div>
          <div>
            <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
              Avg Views
            </div>
            <div class="text-xs font-semibold" style="color: var(--color-text);">
              {{ compact(yt.avgViews) }}
            </div>
          </div>
          <div>
            <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
              Eng
            </div>
            <div class="text-xs font-semibold" style="color: var(--color-text);">
              {{ yt.engagementRate }}%
            </div>
          </div>
        </div>
        @if (freshness()) {
          <div class="text-[8px] text-right mb-2" style="color: var(--color-text-muted);">
            {{ freshness() }}
          </div>
        }
      } @else if (showAllMode()) {
        @if (showBothCpis()) {
          <div class="grid grid-cols-2 gap-1 mb-3 text-center" data-testid="creator-platform-cpis">
            <div class="p-1.5 rounded" style="background: var(--color-bg-3);">
              <div class="text-[9px] uppercase tracking-wider flex items-center justify-center gap-1" style="color: var(--color-text-muted);">
                <span style="color: #9146FF;">●</span> Twitch CPI
              </div>
              <div class="text-xs font-bold" [style.color]="scoreColor(twCpi()!)">
                {{ twCpi() }}
              </div>
            </div>
            <div class="p-1.5 rounded" style="background: var(--color-bg-3);">
              <div class="text-[9px] uppercase tracking-wider flex items-center justify-center gap-1" style="color: var(--color-text-muted);">
                <span style="color: #FF0000;">●</span> YouTube CPI
              </div>
              <div class="text-xs font-bold" [style.color]="scoreColor(ytCpi()!)">
                {{ ytCpi() }}
              </div>
            </div>
          </div>
        }
      } @else {
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
      }

      <div class="flex items-center gap-2 mb-2">
        <div class="flex-1 h-px" style="background: var(--color-border);"></div>
        <span class="text-[8px] uppercase tracking-widest whitespace-nowrap" style="color: var(--color-text-muted);">
          Simfluence Scores
        </span>
        <div class="flex-1 h-px" style="background: var(--color-border);"></div>
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
          @if (gfiDisplay() !== null) {
            <div class="text-sm font-bold" [style.color]="scoreColor(gfiDisplay()!)">
              {{ gfiDisplay() }}
            </div>
          } @else {
            <div
              class="text-sm font-bold"
              style="color: var(--color-text-muted); cursor: help;"
              title="Select a genre to compute Genre Fit Index"
              data-testid="creator-gfi-placeholder"
            >
              —
            </div>
          }
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
  private profile = inject(CreatorProfileService);

  readonly creator = input.required<Creator>();
  readonly selected = input(false);
  readonly canSeeRates = input(false);
  readonly format = input<Format>('Integrated');
  readonly gfiDisplay = input<number | null>(null);
  readonly toggle = output<number>();

  readonly platforms = computed(() => {
    const c = this.creator();
    return c.allPlatforms?.length ? c.allPlatforms : [c.platform];
  });

  // Show-all (CPI-only) display: the creator carries a dynamic best CPI and no
  // platform-filtered YouTube stats embed. In this mode we suppress the raw
  // subs/avg-views/eng block (no honest cross-platform number) and lead with CPI.
  readonly showAllMode = computed(() => {
    const c = this.creator();
    return c.bestCpi != null && !c.ytStats;
  });

  readonly bestCpi = computed(() => this.creator().bestCpi ?? null);
  readonly twCpi = computed(() => this.creator().twCpi ?? null);
  readonly ytCpi = computed(() => this.creator().ytCpi ?? null);

  // Show both per-platform CPIs only when the creator genuinely has both.
  readonly showBothCpis = computed(() => this.twCpi() != null && this.ytCpi() != null);

  readonly tier = computed(() => tierForSubs(this.creator().subsParsed));
  readonly tierFg = computed(() => CREATOR_TIER_COLORS[this.tier()]);
  readonly tierBg = computed(() => CREATOR_TIER_COLORS[this.tier()] + '22');
  readonly tierBorder = computed(() => CREATOR_TIER_COLORS[this.tier()] + '44');

  readonly initials = computed(() => {
    const parts = this.creator().name.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase();
  });

  readonly rateLabel = computed(() => {
    const ranges = computeRateRanges(this.creator());
    const key = this.format() === 'Dedicated' ? 'ded' : this.format() === 'Mixed' ? 'mix' : 'int';
    return this.formatRange(ranges[key]);
  });

  readonly freshness = computed(() => {
    const ts = this.creator().ytStats?.statsRefreshedAt;
    if (!ts) return '';
    const diffMs = Date.now() - new Date(ts).getTime();
    if (isNaN(diffMs)) return '';
    const hr = Math.round(diffMs / 3_600_000);
    if (hr < 1) return 'Updated just now';
    if (hr < 24) return `Updated ${hr}h ago`;
    return `Updated ${Math.round(hr / 24)}d ago`;
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

  openProfile(event: MouseEvent): void {
    event.stopPropagation();
    this.profile.open(this.creator());
  }

  compact(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return Math.round(n / 1_000) + 'K';
    return String(n);
  }

  private formatRange([lo, hi]: [number, number]): string {
    return `$${this.compact(lo)}–$${this.compact(hi)}`;
  }
}
