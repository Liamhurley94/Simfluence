import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { TwitchLiveService } from '../../core/twitch/twitch-live.service';
import { AuthService } from '../../core/auth/auth.service';
import { StorageService } from '../../core/storage/storage.service';
import { UpgradePromptService } from '../../core/upgrade/upgrade-prompt.service';
import { Tier, tierRank } from '../../core/types';
import { Creator } from '../../core/data/creator.types';

// Visible-count caps per tier, ported from the legacy app's "Live Channels"
// monetization model. Free + bronze get the same baseline.
const TIER_CAPS: Record<Tier, number> = {
  free: 10,
  bronze: 10,
  silver: 20,
  gold: 50,
  platinum: Infinity,
  diamond: Infinity,
  admin: Infinity,
};

// Next paid tier to prompt for, when capped. Keyed by current tier.
const NEXT_TIER: Partial<Record<Tier, Tier>> = {
  free: 'silver',
  bronze: 'silver',
  silver: 'gold',
  gold: 'platinum',
};

const COLLAPSED_STORAGE_KEY = 'sf_live_panel_collapsed';

@Component({
  selector: 'app-live-channels-panel',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div
      class="rounded-lg overflow-hidden"
      style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
      data-testid="live-panel"
    >
      <!-- Header (toggles collapse) -->
      <button
        type="button"
        (click)="toggleCollapsed()"
        class="w-full px-3 py-2 flex items-center gap-2 cursor-pointer"
        [attr.aria-expanded]="!collapsed()"
        data-testid="live-panel-toggle"
      >
        <span
          class="inline-block rounded-full"
          [style.background]="liveCount() > 0 ? 'var(--color-sf-red)' : 'var(--color-bg-3)'"
          [style.width.px]="8"
          [style.height.px]="8"
          [style.animation]="liveCount() > 0 ? 'livePulse 1.4s ease-in-out infinite' : 'none'"
        ></span>
        <span
          class="text-[10px] uppercase tracking-wider flex-1 text-left"
          style="color: var(--color-text);"
        >
          Live Channels
        </span>
        @if (liveCount() > 0) {
          <span
            class="text-[9px] uppercase tracking-wider font-bold"
            style="color: var(--color-sf-red);"
            data-testid="live-count"
          >
            {{ liveCount() }} Live
          </span>
        }
        <span class="text-xs" style="color: var(--color-text-muted);">
          {{ collapsed() ? '▸' : '▾' }}
        </span>
      </button>

      @if (!collapsed()) {
        <div class="overflow-y-auto border-t" style="max-height: 320px; border-color: var(--color-border);">
          @if (entries().length === 0) {
            <div
              class="px-3 py-4 text-[10px] text-center"
              style="color: var(--color-text-muted);"
              data-testid="live-empty"
            >
              No creators live right now — check back later.
            </div>
          } @else {
            @for (entry of visible(); track entry.creator.id) {
              <div
                class="px-3 py-2 flex items-center gap-2 border-t"
                style="border-color: var(--color-border);"
                [attr.data-testid]="'live-row-' + entry.creator.id"
              >
                <div
                  class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  [style.background]="entry.creator.color"
                  style="color: white;"
                >
                  {{ initialsOf(entry.creator) }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-semibold truncate" style="color: var(--color-text);">
                    {{ entry.creator.name }}
                  </div>
                  <div class="text-[9px] truncate" style="color: var(--color-text-muted);">
                    {{ entry.stream.gameName || entry.creator.genre }}
                  </div>
                  <div class="text-[9px]" style="color: var(--color-sf-red);">
                    {{ entry.stream.viewerCount | number }} watching
                  </div>
                </div>
                <a
                  [attr.href]="'https://twitch.tv/' + entry.stream.login"
                  target="_blank"
                  rel="noopener"
                  class="text-xs px-2 py-1 rounded shrink-0"
                  style="background: #9146FF; color: white;"
                  data-testid="live-twitch-link"
                  (click)="$event.stopPropagation()"
                >
                  ▶
                </a>
              </div>
            }
            @if (capped()) {
              <button
                type="button"
                (click)="onUpgradeClick()"
                class="w-full px-3 py-2 text-[9px] text-center border-t cursor-pointer"
                style="background: var(--color-bg-3); border-color: var(--color-border); color: var(--color-sf-gold);"
                data-testid="live-upgrade"
              >
                Showing {{ visible().length }} of {{ entries().length }} — upgrade to {{ nextTier() }}
              </button>
            }
          }
        </div>
      }
    </div>
  `,
})
export class LiveChannelsPanelComponent {
  private live = inject(TwitchLiveService);
  private auth = inject(AuthService);
  private storage = inject(StorageService);
  private upgrade = inject(UpgradePromptService);

  protected readonly entries = this.live.liveEntries;
  protected readonly liveCount = this.live.liveCount;

  protected readonly collapsed = signal(this.storage.getItem(COLLAPSED_STORAGE_KEY) === 'true');

  // The cap for the current user's tier. Used to slice the visible list.
  private readonly cap = computed(() => TIER_CAPS[this.auth.tier() ?? 'free'] ?? 10);

  // Sliced view shown in the UI.
  protected readonly visible = computed(() => {
    const all = this.entries();
    const cap = this.cap();
    return Number.isFinite(cap) ? all.slice(0, cap) : all;
  });

  // True when there are more live entries than the tier cap allows.
  protected readonly capped = computed(() => this.entries().length > this.visible().length);

  // What tier to nudge the user toward when capped. Returns null at top tiers.
  protected readonly nextTier = computed<Tier | null>(
    () => NEXT_TIER[this.auth.tier() ?? 'free'] ?? null,
  );

  toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    this.storage.setItem(COLLAPSED_STORAGE_KEY, String(next));
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

  onUpgradeClick(): void {
    const next = this.nextTier();
    if (!next) return;
    this.upgrade.open('Live Channels', next);
  }
}
