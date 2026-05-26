import { Component, computed, inject, resource } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { CreatorProfileService } from '../../core/creator-profile/creator-profile.service';
import { YoutubeCreatorService } from '../../core/youtube/youtube-creator.service';
import { TwitchLiveService } from '../../core/twitch/twitch-live.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Creator } from '../../core/data/creator.types';
import { YoutubeCreatorData, YoutubeVideo } from '../../core/youtube/youtube-creator.types';
import { TwitchEnrichment } from '../../core/twitch/twitch-live.types';
import { computeRateRanges } from '../../core/rates/rate-estimate';

interface GenreBenchmarks {
  genre: string;
  total_creators: number;
  creator_cpi: number;
  avg_cpi: number;
  cpi_percentile: number;
  creator_eng: number | null;
  avg_eng: number | null;
  eng_percentile: number | null;
  creator_gfi: number | null;
  avg_gfi: number | null;
  gfi_percentile: number | null;
}

function hasYoutube(c: Creator | null): c is Creator {
  if (!c) return false;
  if (c.platform === 'YouTube') return true;
  return !!c.allPlatforms?.includes('YouTube');
}

function hasTwitch(c: Creator | null): c is Creator {
  if (!c) return false;
  if (c.platform === 'Twitch') return true;
  return !!c.allPlatforms?.includes('Twitch');
}

// Activity classification ported from reference/app.html:12361-12366.
// > 90 days: inactive (red warning). 30-90: stale (amber). ≤ 30: active (green).
function activityClass(days: number | null): 'inactive' | 'stale' | 'active' | 'unknown' {
  if (days == null) return 'unknown';
  if (days > 90) return 'inactive';
  if (days > 30) return 'stale';
  return 'active';
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
                    YouTube Data
                  </span>
                  @if (yt.isLoading()) {
                    <span class="text-[9px]" style="color: var(--color-text-muted);">Loading…</span>
                  } @else if (data()?.stats_refreshed_at; as ts) {
                    <span class="text-[9px]" style="color: var(--color-text-muted);">Updated {{ rel(ts) }}</span>
                  }
                </div>

                <div class="p-3 flex flex-col gap-3">
                  @if (yt.error()) {
                    <div class="text-xs" style="color: var(--color-sf-red);">
                      Could not load data.
                    </div>
                  } @else if (!yt.isLoading() && !data()) {
                    <div class="text-xs" style="color: var(--color-text-muted);">
                      YouTube data refresh pending.
                    </div>
                  } @else if (data(); as d) {
                    <div class="grid grid-cols-2 gap-2">
                      <div class="p-2 rounded text-center" style="background: var(--color-bg-3);">
                        <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                          Subscribers
                        </div>
                        <div class="text-base font-bold" style="color: var(--color-sf-green);">
                          {{ (d.subscriber_count ?? 0) | number: '1.0-0' }}
                        </div>
                      </div>
                      <div class="p-2 rounded text-center" style="background: var(--color-bg-3);">
                        <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                          Avg views (top 5)
                        </div>
                        <div class="text-base font-bold" style="color: var(--color-text);">
                          {{ (d.avg_views ?? 0) | number: '1.0-0' }}
                        </div>
                      </div>
                    </div>

                    <div class="grid grid-cols-1 gap-2">
                      <div class="p-2 rounded text-center" style="background: var(--color-bg-3);">
                        <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                          Last upload
                        </div>
                        <div class="text-sm font-bold" style="color: var(--color-text);">
                          {{ d.last_upload_date ? rel(d.last_upload_date) : '—' }}
                        </div>
                      </div>
                    </div>

                    @if (videos().length > 0) {
                      <div>
                        <div class="text-[10px] uppercase tracking-wider mb-1" style="color: var(--color-text-muted);">
                          Recent videos
                        </div>
                        <ul class="flex flex-col gap-1">
                          @for (v of videos(); track $index) {
                            <li class="text-xs flex items-start gap-1.5" style="color: var(--color-text);">
                              <span class="shrink-0">•</span>
                              @if (v.url) {
                                <a
                                  [attr.href]="v.url"
                                  target="_blank"
                                  rel="noopener"
                                  class="truncate flex-1"
                                  style="color: var(--color-text); text-decoration: none;"
                                  [title]="v.title"
                                >{{ v.title }}</a>
                              } @else {
                                <span class="truncate flex-1" [title]="v.title">{{ v.title }}</span>
                              }
                            </li>
                          }
                        </ul>
                      </div>
                    }
                  }
                </div>
              </div>

              @if (!yt.isLoading() && data(); as d) {
                <div
                  class="rounded-lg overflow-hidden"
                  style="border: 1px solid var(--color-border);"
                  data-testid="creator-profile-analysis"
                >
                  <div
                    class="px-3 py-2"
                    style="background: var(--color-bg-3);"
                  >
                    <span class="text-[10px] uppercase tracking-wider font-bold" style="color: var(--color-sf-gold);">
                      Simfluence Analysis
                    </span>
                  </div>
                  <div class="p-3 flex flex-col gap-3">
                    <div class="grid grid-cols-3 gap-2">
                      <div class="p-2 rounded text-center" style="background: var(--color-bg-3);">
                        <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                          Engagement
                        </div>
                        <div class="text-sm font-bold" style="color: var(--color-text);">
                          {{ d.engagement_rate ?? 0 }}%
                        </div>
                      </div>
                      <div class="p-2 rounded text-center" style="background: var(--color-bg-3);">
                        <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                          Sponsor freq
                        </div>
                        <div class="text-sm font-bold" [style.color]="sponsorColor(d.sponsor_freq_pct ?? 0)">
                          {{ d.sponsor_freq_pct ?? 0 }}%
                        </div>
                      </div>
                      <div class="p-2 rounded text-center" style="background: var(--color-bg-3);">
                        <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                          Avg days between
                        </div>
                        <div class="text-sm font-bold" style="color: var(--color-text);">
                          {{ d.avg_days_between ?? '—' }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              }
            }

            <div
              class="rounded-lg overflow-hidden"
              style="border: 1px solid var(--color-border);"
              data-testid="creator-profile-budget"
            >
              <div
                class="px-3 py-2"
                style="background: var(--color-bg-3);"
              >
                <span class="text-[10px] uppercase tracking-wider font-bold" style="color: var(--color-sf-gold);">
                  Estimated Budget Range
                </span>
              </div>
              <div class="p-3">
                <div class="grid grid-cols-3 gap-2">
                  <div class="p-2 rounded text-center" style="background: var(--color-bg-3);">
                    <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                      Integrated
                    </div>
                    <div class="text-sm font-bold" style="color: var(--color-sf-green);">
                      {{ formatBudget(rates().int[0]) }}
                    </div>
                    <div class="text-[9px]" style="color: var(--color-text-muted);">
                      ~{{ formatBudget(rates().int[1]) }}
                    </div>
                  </div>
                  <div class="p-2 rounded text-center" style="background: var(--color-bg-3);">
                    <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                      Dedicated
                    </div>
                    <div class="text-sm font-bold" style="color: var(--color-sf-green);">
                      {{ formatBudget(rates().ded[0]) }}
                    </div>
                    <div class="text-[9px]" style="color: var(--color-text-muted);">
                      ~{{ formatBudget(rates().ded[1]) }}
                    </div>
                  </div>
                  <div class="p-2 rounded text-center" style="background: var(--color-bg-3);">
                    <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                      Mixed
                    </div>
                    <div class="text-sm font-bold" style="color: var(--color-sf-green);">
                      {{ formatBudget(rates().mix[0]) }}
                    </div>
                    <div class="text-[9px]" style="color: var(--color-text-muted);">
                      ~{{ formatBudget(rates().mix[1]) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            @if (bench.value(); as b) {
              <div
                class="rounded-lg overflow-hidden"
                style="border: 1px solid var(--color-border);"
                data-testid="creator-profile-benchmark"
              >
                <div
                  class="px-3 py-2 flex items-center justify-between"
                  style="background: var(--color-bg-3);"
                >
                  <span class="text-[10px] uppercase tracking-wider font-bold" style="color: var(--color-sf-gold);">
                    Category Benchmarking
                  </span>
                  <span class="text-[9px]" style="color: var(--color-text-muted);">
                    {{ b.genre }} ({{ b.total_creators | number }} creators)
                  </span>
                </div>
                <div class="p-3">
                  <div class="grid grid-cols-3 gap-2">
                    <div class="p-2 rounded flex flex-col gap-1" style="background: var(--color-bg-3);">
                      <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                        CPI vs Category
                      </div>
                      <div class="text-lg font-bold" style="color: var(--color-text);">
                        {{ b.creator_cpi }}
                      </div>
                      <div class="text-[9px]" style="color: var(--color-text-muted);">
                        Category avg: {{ b.avg_cpi }}
                      </div>
                      <div class="text-[9px] font-semibold" style="color: var(--color-sf-green);">
                        {{ b.creator_cpi - b.avg_cpi >= 0 ? '+' : '' }}{{ b.creator_cpi - b.avg_cpi }} pts
                      </div>
                      <div class="text-[8px]" style="color: var(--color-text-muted);">
                        Top {{ b.cpi_percentile }}% in category
                      </div>
                    </div>

                    <div class="p-2 rounded flex flex-col gap-1" style="background: var(--color-bg-3);">
                      <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                        Eng Rate vs Category
                      </div>
                      @if (b.creator_eng !== null) {
                        <div class="text-lg font-bold" style="color: var(--color-text);">
                          {{ b.creator_eng }}%
                        </div>
                        <div class="text-[9px]" style="color: var(--color-text-muted);">
                          Category avg: {{ b.avg_eng }}%
                        </div>
                        <div class="text-[9px] font-semibold" style="color: var(--color-sf-green);">
                          {{ b.creator_eng - b.avg_eng! >= 0 ? '+' : '' }}{{ (b.creator_eng - b.avg_eng!) | number: '1.0-1' }}%
                        </div>
                        <div class="text-[8px]" style="color: var(--color-text-muted);">
                          Top {{ b.eng_percentile }}% in category
                        </div>
                      } @else {
                        <div class="text-sm" style="color: var(--color-text-muted);">—</div>
                      }
                    </div>

                    <div class="p-2 rounded flex flex-col gap-1" style="background: var(--color-bg-3);">
                      <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
                        GFI vs Category
                      </div>
                      @if (b.creator_gfi !== null) {
                        <div class="text-lg font-bold" style="color: var(--color-text);">
                          {{ b.creator_gfi }}%
                        </div>
                        <div class="text-[9px]" style="color: var(--color-text-muted);">
                          Category avg: {{ b.avg_gfi }}%
                        </div>
                        <div class="text-[9px] font-semibold" style="color: var(--color-sf-green);">
                          {{ b.creator_gfi - b.avg_gfi! >= 0 ? '+' : '' }}{{ b.creator_gfi - b.avg_gfi! }}%
                        </div>
                        <div class="text-[8px]" style="color: var(--color-text-muted);">
                          Top {{ b.gfi_percentile }}% in category
                        </div>
                      } @else {
                        <div class="text-sm" style="color: var(--color-text-muted);">—</div>
                      }
                    </div>
                  </div>
                </div>
              </div>
            }

            @if (showTwitch()) {
              <div
                class="rounded-lg overflow-hidden"
                style="border: 1px solid var(--color-border);"
                data-testid="creator-profile-twitch"
              >
                <div
                  class="px-3 py-2 flex items-center justify-between"
                  style="background: var(--color-bg-3);"
                >
                  <span class="text-[10px] uppercase tracking-wider font-bold" style="color: #9146FF;">
                    ● Twitch
                  </span>
                  @if (tw.isLoading()) {
                    <span class="text-[9px]" style="color: var(--color-text-muted);">Fetching…</span>
                  }
                </div>

                <div class="p-3 flex flex-col gap-3">
                  @if (!tw.isLoading() && !twData()) {
                    <div class="text-xs" style="color: var(--color-text-muted);">
                      Twitch live info unavailable — API not configured.
                    </div>
                  } @else if (twData(); as d) {
                    @if (d.live) {
                      <!-- Live state -->
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-block rounded-full"
                          style="width: 8px; height: 8px; background: var(--color-sf-red); animation: livePulse 1.4s ease-in-out infinite;"
                        ></span>
                        <span class="text-xs font-bold uppercase tracking-wider" style="color: var(--color-sf-red);">
                          Live now · {{ d.viewerCount | number: '1.0-0' }} watching
                        </span>
                      </div>
                      @if (d.gameName) {
                        <div class="text-xs" style="color: var(--color-text);">
                          Playing: <strong>{{ d.gameName }}</strong>
                        </div>
                      }
                      @if (d.title) {
                        <div class="text-xs truncate" style="color: var(--color-text-muted);" [title]="d.title">
                          {{ d.title }}
                        </div>
                      }
                    } @else {
                      <div class="text-xs" style="color: var(--color-text-muted);">
                        Offline.
                      </div>
                    }

                    <!-- Inactivity badge — port of reference/app.html:12361-12366 -->
                    @if (activityState() === 'inactive') {
                      <div
                        class="flex items-center gap-2 px-3 py-2 rounded"
                        style="background: rgba(255,51,85,0.08); border: 1px solid rgba(255,51,85,0.3);"
                        data-testid="creator-profile-twitch-inactivity"
                      >
                        <span style="font-size: 16px;">⚠️</span>
                        <div>
                          <div class="text-[11px] font-bold" style="color: var(--color-sf-red);">
                            INACTIVE — {{ d.daysSinceStream }} days since last stream
                          </div>
                          <div class="text-[10px]" style="color: var(--color-text-muted);">
                            Verify activity before briefing.
                          </div>
                        </div>
                      </div>
                    } @else if (activityState() === 'stale') {
                      <div class="text-[10px]" style="color: var(--color-sf-gold);" data-testid="creator-profile-twitch-stale">
                        Last stream: {{ d.daysSinceStream }} days ago
                      </div>
                    } @else if (activityState() === 'active') {
                      <div class="text-[10px]" style="color: var(--color-sf-green);" data-testid="creator-profile-twitch-active">
                        ✓ Active — last stream {{ d.daysSinceStream }} days ago
                      </div>
                    }

                    <a
                      [attr.href]="'https://twitch.tv/' + d.login"
                      target="_blank"
                      rel="noopener"
                      class="text-xs px-3 py-1.5 rounded text-center"
                      style="background: #9146FF; color: white; text-decoration: none;"
                      data-testid="creator-profile-twitch-link"
                    >
                      ▶ View on Twitch
                    </a>
                  }
                </div>
              </div>
            }

            @if (c.sponsorHistory.length) {
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
  private twitch = inject(TwitchLiveService);
  private supabase = inject(SupabaseService);

  protected readonly creator = this.profile.current;
  protected readonly showYoutube = computed(() => hasYoutube(this.creator()));
  protected readonly showTwitch = computed(() => hasTwitch(this.creator()));

  // Reads from the `creator_youtube_stats` cache table via PostgREST. No
  // YouTube API call ever fires from this user action — see the no-user-
  // triggered-API rule in the project memory.
  protected readonly yt = resource<YoutubeCreatorData | null, Creator | null>({
    params: () => this.creator(),
    loader: ({ params }) => {
      if (!params || !hasYoutube(params)) return Promise.resolve(null);
      return this.youtube.fetch(params);
    },
    defaultValue: null,
  });

  // Async fetch of Twitch enrichment. Returns null when the upstream call
  // fails (API keys unset, network error) — modal renders an "unavailable"
  // message instead of an error.
  protected readonly tw = resource<TwitchEnrichment | null, Creator | null>({
    params: () => this.creator(),
    loader: ({ params }) => {
      if (!params || !hasTwitch(params)) return Promise.resolve(null);
      return this.twitch.fetchEnrichment(params);
    },
    defaultValue: null,
  });

  protected readonly data = computed(() => this.yt.value());
  protected readonly twData = computed(() => this.tw.value());
  protected readonly activityState = computed(() => activityClass(this.twData()?.daysSinceStream ?? null));

  protected readonly videos = computed<YoutubeVideo[]>(() => this.data()?.top_videos ?? []);
  protected readonly rates = computed(() => computeRateRanges(this.creator()!));

  protected readonly bench = resource<GenreBenchmarks | null, Creator | null>({
    params: () => this.creator(),
    loader: async ({ params }) => {
      if (!params) return null;
      const { data } = await this.supabase.client.rpc('get_genre_benchmarks', {
        p_creator_id: params.id,
        p_genre: params.genre,
      });
      return (data as GenreBenchmarks) ?? null;
    },
    defaultValue: null,
  });

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

  formatBudget(n: number): string {
    if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return '$' + Math.round(n / 1_000) + 'K';
    return '$' + n;
  }
}
