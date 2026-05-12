import { Component, computed, inject, resource } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { CreatorProfileService } from '../../core/creator-profile/creator-profile.service';
import { YoutubeCreatorService } from '../../core/youtube/youtube-creator.service';
import { Creator } from '../../core/data/creator.types';
import { YoutubeCreatorData } from '../../core/youtube/youtube-creator.types';

function hasYoutube(c: Creator | null): c is Creator {
  if (!c) return false;
  if (c.platform === 'YouTube') return true;
  return !!c.allPlatforms?.includes('YouTube');
}

function topGenres(signals: Record<string, number> | undefined, n: number): { genre: string; pct: number }[] {
  if (!signals) return [];
  const total = Object.values(signals).reduce((s, v) => s + v, 0);
  if (total === 0) return [];
  return Object.entries(signals)
    .map(([genre, count]) => ({ genre, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, n);
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

function sponsorColor(pct: number): string {
  if (pct < 20) return 'var(--color-sf-green)';
  if (pct < 40) return 'var(--color-sf-gold)';
  return 'var(--color-sf-orange)';
}

@Component({
  selector: 'app-creator-profile-modal',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    @if (creator(); as c) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-6"
        style="background: rgba(0,0,0,0.7);"
        (click)="close()"
        data-testid="creator-profile-backdrop"
      >
        <div
          class="max-w-xl w-full rounded-lg overflow-hidden flex flex-col"
          style="background: var(--color-bg-2); border: 1px solid var(--color-border-strong); max-height: 90vh;"
          (click)="$event.stopPropagation()"
          data-testid="creator-profile-modal"
        >
          <!-- Header -->
          <div
            class="px-5 py-4 flex items-center gap-3 border-b"
            style="border-color: var(--color-border);"
          >
            <div
              class="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
              [style.background]="c.color"
              style="color: white;"
            >
              {{ initialsOf(c) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-lg font-bold truncate" style="color: var(--color-text);">{{ c.name }}</div>
              <div class="text-xs truncate" style="color: var(--color-text-muted);">
                {{ c.handle }} · {{ c.platform }} · {{ c.subs }} subs · {{ c.genre }}
              </div>
            </div>
            <button
              type="button"
              (click)="close()"
              class="text-xs"
              style="color: var(--color-text-muted);"
              data-testid="creator-profile-close"
            >
              ✕
            </button>
          </div>

          <!-- Body (scrollable) -->
          <div class="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            @if (c.bio) {
              <div>
                <div class="text-[10px] uppercase tracking-wider mb-1" style="color: var(--color-text-muted);">Bio</div>
                <div class="text-sm" style="color: var(--color-text);">{{ c.bio }}</div>
              </div>
            }

            @if (showYoutube()) {
              <div
                class="rounded-lg overflow-hidden"
                style="border: 1px solid var(--color-border);"
                data-testid="creator-profile-youtube"
              >
                <div
                  class="px-3 py-2 flex items-center justify-between"
                  style="background: var(--color-bg-3);"
                >
                  <span class="text-[10px] uppercase tracking-wider font-bold" style="color: var(--color-sf-green);">
                    ● Live YouTube Data
                  </span>
                  @if (yt.isLoading()) {
                    <span class="text-[9px]" style="color: var(--color-text-muted);">Fetching…</span>
                  } @else if (data()?.fetched_at; as ts) {
                    <span class="text-[9px]" style="color: var(--color-text-muted);">{{ rel(ts) }}</span>
                  }
                </div>

                <div class="p-3 flex flex-col gap-3">
                  @if (yt.error()) {
                    <div class="text-xs" style="color: var(--color-sf-red);">
                      Could not load live data.
                    </div>
                  } @else if (!yt.isLoading() && !data()) {
                    <div class="text-xs" style="color: var(--color-text-muted);">
                      Channel ID not yet mapped — live data coming soon.
                    </div>
                  } @else if (data(); as d) {
                    <!-- Headline stats -->
                    <div class="grid grid-cols-3 gap-2">
                      <div class="p-2 rounded text-center" style="background: var(--color-bg-3);">
                        <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                          ● Live Subs
                        </div>
                        <div class="text-base font-bold" style="color: var(--color-sf-green);">
                          {{ d.subs_live | number: '1.0-0' }}
                        </div>
                      </div>
                      <div class="p-2 rounded text-center" style="background: var(--color-bg-3);">
                        <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                          ● 20 vid avg
                        </div>
                        <div class="text-base font-bold" style="color: var(--color-text);">
                          {{ d.avg_views_20 | number: '1.0-0' }}
                        </div>
                      </div>
                      <div class="p-2 rounded text-center" style="background: var(--color-bg-3);">
                        <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                          Sponsor freq
                        </div>
                        <div class="text-base font-bold" [style.color]="sponsorColor(d.sponsor_freq_pct)">
                          {{ d.sponsor_freq_pct }}%
                        </div>
                      </div>
                    </div>

                    <!-- Thumbnail -->
                    @if (d.thumbnail_url) {
                      <img
                        [src]="d.thumbnail_url"
                        [alt]="c.name + ' thumbnail'"
                        class="w-full rounded"
                        style="max-height: 200px; object-fit: cover; border: 1px solid var(--color-border);"
                      />
                    }

                    <!-- Genre signals -->
                    @if (topSignals().length > 0) {
                      <div>
                        <div class="text-[10px] uppercase tracking-wider mb-1" style="color: var(--color-text-muted);">
                          Content signals (top 5)
                        </div>
                        <div class="flex flex-col gap-1.5">
                          @for (sig of topSignals(); track sig.genre) {
                            <div>
                              <div class="flex items-center justify-between text-[10px] mb-0.5">
                                <span style="color: var(--color-text);">{{ sig.genre }}</span>
                                <span style="color: var(--color-text-muted);">{{ sig.pct }}%</span>
                              </div>
                              <div class="h-1 rounded-full overflow-hidden" style="background: var(--color-bg-3);">
                                <div
                                  class="h-full"
                                  [style.width.%]="sig.pct"
                                  style="background: var(--color-sf-blue);"
                                ></div>
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    }

                    <!-- Recent video titles -->
                    @if (d.top_titles?.length) {
                      <div>
                        <div class="text-[10px] uppercase tracking-wider mb-1" style="color: var(--color-text-muted);">
                          Recent videos
                        </div>
                        <ul class="flex flex-col gap-1">
                          @for (title of d.top_titles; track $index) {
                            <li class="text-xs truncate" style="color: var(--color-text);">• {{ title }}</li>
                          }
                        </ul>
                      </div>
                    }
                  }
                </div>
              </div>
            }

            @if (c.sponsorHistory?.length) {
              <div>
                <div class="text-[10px] uppercase tracking-wider mb-1" style="color: var(--color-text-muted);">
                  Verified sponsors
                </div>
                <div class="flex flex-wrap gap-1">
                  @for (s of c.sponsorHistory; track s) {
                    <span class="text-[10px] px-2 py-0.5 rounded" style="background: var(--color-bg-3); color: var(--color-text);">{{ s }}</span>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class CreatorProfileModalComponent {
  private profile = inject(CreatorProfileService);
  private youtube = inject(YoutubeCreatorService);

  protected readonly creator = this.profile.current;
  protected readonly showYoutube = computed(() => hasYoutube(this.creator()));

  // Async fetch of YouTube enrichment, keyed off the currently-open creator.
  // Loader short-circuits to null for non-YouTube creators or when the modal
  // is closed; otherwise hits the edge fn (which has its own 24h DB cache).
  protected readonly yt = resource<YoutubeCreatorData | null, Creator | null>({
    params: () => this.creator(),
    loader: ({ params }) => {
      if (!params || !hasYoutube(params)) return Promise.resolve(null);
      return this.youtube.fetch(params);
    },
    defaultValue: null,
  });

  protected readonly data = computed(() => this.yt.value());
  protected readonly topSignals = computed(() => topGenres(this.data()?.genre_signals, 5));

  close(): void {
    this.profile.close();
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

  rel(iso: string): string {
    return relativeTime(iso);
  }

  sponsorColor(pct: number): string {
    return sponsorColor(pct);
  }
}
