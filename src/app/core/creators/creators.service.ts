import { Injectable, computed, inject, signal } from '@angular/core';
import { CREATOR_TIER_RANGES, Creator, CreatorFilters, PagedCreators, SortKey, TwitchStats, YoutubeStats, maxSubsForBudget } from '../data/creator.types';
import { SupabaseService } from '../supabase/supabase.service';

const DEFAULT_PAGE_SIZE = 24;

// Embedded-resource select fragments for fresh per-platform stats. Reused across
// the platform-filtered list embed and the byId/byIds view embed so the column
// sets stay in lockstep. NOTE: column names are bare here; callers add the
// `youtube_creators(...)` / `twitch_creators(...)` wrapper (and any !inner).
const YT_STATS_COLS = 'subscriber_count, avg_views, engagement_rate, sponsor_freq_pct, stats_refreshed_at';
const TW_LIVE_COLS = 'avg_ccv, peak_ccv, streams_30d, hours_streamed_30d, last_stream_at, primary_game_name, live_refreshed_at';

const PLATFORM_TABLES: Record<string, string> = {
  YouTube: 'youtube_creators',
  Twitch: 'twitch_creators',
  Instagram: 'instagram_creators',
  TikTok: 'tiktok_creators',
  Facebook: 'facebook_creators',
  'Facebook Gaming': 'facebook_creators',
  Twitter: 'twitter_creators',
};

// Show-all sentinel: the filter panel's "All platforms" option (see filter-panel.component.ts).
// When the platform filter is this (or absent), `list()` runs the view-backed show-all mode.
const ALL_PLATFORMS = 'All platforms';

// Re-exported for SimulatorComponent's local subscriber-count math; the DB
// has a generated subs_parsed column that does the same thing server-side.
export function parseSubs(raw: string): number {
  if (!raw) return 0;
  const n = parseFloat(raw);
  if (isNaN(n)) return 0;
  if (/M/i.test(raw)) return n * 1_000_000;
  if (/K/i.test(raw)) return n * 1_000;
  return n;
}

// Compact display formatter — the write-side counterpart to parseSubs (16_900_000
// -> "16.9M", 913_385 -> "913K", 950 -> "950"). Used by the live-stat overlay
// below: downstream code (Discovery) parses these strings back via parseSubs,
// so output must roundtrip to ≈ the same magnitude.
export function formatCompact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${Math.round(n)}`;
}

function parseYtStats(row: Record<string, any>): YoutubeStats | undefined {
  const yt = row['youtube_creators'];
  if (!yt || (Array.isArray(yt) && yt.length === 0)) return undefined;
  const d = Array.isArray(yt) ? yt[0] : yt;
  if (typeof d?.subscriber_count !== 'number') return undefined;
  return {
    subscriberCount: d.subscriber_count,
    avgViews: d.avg_views ?? 0,
    engagementRate: d.engagement_rate ?? 0,
    sponsorFreqPct: d.sponsor_freq_pct ?? 0,
    statsRefreshedAt: d.stats_refreshed_at ?? null,
  };
}

// Mirror of parseYtStats for the live Twitch aggregates. Gated on avg_ccv being
// a number: a twitch_creators row with no finalized sessions has all live
// columns NULL, which means "no live data yet" — return undefined rather than a
// row of zeros so the rendering phase can distinguish "never live" from "0 CCV".
function parseTwitchStats(row: Record<string, any>): TwitchStats | undefined {
  const tw = row['twitch_creators'];
  if (!tw || (Array.isArray(tw) && tw.length === 0)) return undefined;
  const d = Array.isArray(tw) ? tw[0] : tw;
  if (typeof d?.avg_ccv !== 'number') return undefined;
  return {
    avgCcv: d.avg_ccv,
    peakCcv: d.peak_ccv ?? 0,
    streams30d: d.streams_30d ?? 0,
    hoursStreamed30d: d.hours_streamed_30d ?? 0,
    lastStreamAt: d.last_stream_at ?? null,
    primaryGameName: d.primary_game_name ?? null,
    liveRefreshedAt: d.live_refreshed_at ?? null,
  };
}

function fromDb(row: Record<string, any>, cpiSource: 'best' | 'yt' | 'tw' = 'best'): Creator {
  // GFI lives in `creator_genre_scores` keyed on (creator_id, campaign_genre)
  // and is only populated on `list()` queries with a genre filter. PostgREST
  // returns the embedded resource as an array — flatten to the single row's
  // gfi (filtered upstream to the requested campaign_genre).
  const scores = row['creator_genre_scores'];
  const gfi: number | null = Array.isArray(scores) && scores.length > 0 && typeof scores[0]?.gfi === 'number'
    ? scores[0].gfi
    : null;

  // Per-platform CPIs. In show-all they arrive as plain view columns (tw_cpi/yt_cpi/
  // best_cpi). In platform-filtered mode the platform's cpi rides in on the embedded
  // resource (youtube_creators[].yt_cpi / twitch_creators[].tw_cpi); pull it out.
  const ytEmbed = row['youtube_creators'];
  const ytEmbedRow = Array.isArray(ytEmbed) ? ytEmbed[0] : ytEmbed;
  const twEmbed = row['twitch_creators'];
  const twEmbedRow = Array.isArray(twEmbed) ? twEmbed[0] : twEmbed;

  const ytCpi: number | null = row['yt_cpi'] ?? (typeof ytEmbedRow?.yt_cpi === 'number' ? ytEmbedRow.yt_cpi : null);
  const twCpi: number | null = row['tw_cpi'] ?? (typeof twEmbedRow?.tw_cpi === 'number' ? twEmbedRow.tw_cpi : null);
  const bestCpi: number | null = row['best_cpi'] ?? null;

  // The `cpi` field carries the mode-appropriate CPI: best_cpi in show-all, the
  // filtered platform's CPI in platform-filtered mode (spec §5). Falls back to the
  // static creators.cpi only if the dynamic value is absent.
  const dynamicCpi =
    cpiSource === 'yt' ? ytCpi :
    cpiSource === 'tw' ? twCpi :
    bestCpi;
  const cpi = dynamicCpi ?? row['cpi'];

  const ytStats = parseYtStats(row);
  const twitchStats = parseTwitchStats(row);

  // Live-first overlay, static fallback. `creators.subs/avg_views/eng` (and the
  // subs_parsed generated column) are vestigial: empty for admin-added creators,
  // since live stats live in the per-platform tables (ytStats/twitchStats above).
  // Left untouched, the cards' raw-stat blocks display empty/zero values as-is.
  // (Rate estimates no longer derive from these fields — `rateRanges` below is a
  // materialized column, computed server-side and stored in creators.rate_ranges.)
  // Mirrors the platform semantics of live-stats.ts#liveStatsFor: YouTube-primary
  // overlays all four fields from ytStats; Twitch/Kick-primary overlays only
  // avgViews (CCV) — there's no live subs/engagement source for Twitch. Pending
  // retirement of the static columns — see backend migration 20260711140000
  // (benchmarks RPC got the same treatment) and ARCHITECTURE.md §12.
  let subs = row['subs'];
  let subsParsed = Number(row['subs_parsed'] ?? 0);
  let avgViews = row['avg_views'];
  let eng = row['eng'];

  const platform = (row['platform'] || '').toLowerCase();
  if (platform.includes('twitch') || platform.includes('kick')) {
    if (twitchStats && twitchStats.avgCcv > 0) {
      avgViews = formatCompact(twitchStats.avgCcv);
    }
  } else if (ytStats) {
    subs = formatCompact(ytStats.subscriberCount);
    subsParsed = ytStats.subscriberCount;
    avgViews = formatCompact(ytStats.avgViews);
    eng = `${ytStats.engagementRate}%`;
  }

  return {
    id: row['id'],
    name: row['name'],
    handle: row['handle'],
    platform: row['platform'],
    allPlatforms: Array.isArray(row['all_platforms']) ? row['all_platforms'] : undefined,
    subs,
    subsParsed,
    avgViews,
    eng,
    genre: row['genre'],
    cpi,
    gfi,
    color: row['color'],
    verifiedDeals: row['verified_deals'],
    sponsorHistory: Array.isArray(row['sponsor_history']) ? row['sponsor_history'] : [],
    bio: row['bio'],
    language: row['language'],
    rateRanges: row['rate_ranges'] ?? undefined,
    ytStats,
    twitchStats,
    twCpi,
    ytCpi,
    bestCpi,
  };
}

// Escape % and _ wildcards so user search input is treated literally.
function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => '\\' + m);
}

@Injectable({ providedIn: 'root' })
export class CreatorsService {
  private readonly supabase = inject(SupabaseService);

  // Filter dropdown values (small lists, fetched once via RPCs at app boot).
  // Exposed as readonly signals so components stay reactive when load completes.
  private readonly _genres = signal<string[]>([]);
  private readonly _platforms = signal<string[]>([]);
  // `languages` = all supported (admin add form + display map); `usedLanguages` = only
  // those with ≥1 creator (Discovery filter — no dead options). Both { code, name }.
  private readonly _languages = signal<{ code: string; name: string }[]>([]);
  private readonly _usedLanguages = signal<{ code: string; name: string }[]>([]);
  private readonly _submodesByGenre = signal<Record<string, { subMode: string; hasKeywords: boolean }[]>>({});

  readonly genres = this._genres.asReadonly();
  readonly platforms = this._platforms.asReadonly();
  readonly languages = this._languages.asReadonly();
  readonly usedLanguages = this._usedLanguages.asReadonly();
  readonly submodesByGenre = this._submodesByGenre.asReadonly();
  readonly loaded = signal(false);

  private readonly _languageMap = computed(() => new Map(this._languages().map((l) => [l.code, l.name])));
  /** English display name for a language code; falls back to the code itself. */
  languageName(code: string | null | undefined): string {
    return (code ? this._languageMap().get(code) : undefined) ?? code ?? '';
  }

  /** Called by APP_INITIALIZER on boot. Populates filter dropdowns. */
  async loadFilterOptions(): Promise<void> {
    const [g, p, allLang, usedLang, sm] = await Promise.all([
      this.supabase.client.rpc('get_creator_genres'),
      this.supabase.client.rpc('get_creator_platforms'),
      this.supabase.client.rpc('get_languages'),
      this.supabase.client.rpc('get_creator_languages'),
      this.supabase.client.rpc('get_genre_submodes'),
    ]);
    this._genres.set((g.data as string[] | null) ?? []);
    this._platforms.set((p.data as string[] | null) ?? []);
    this._languages.set((allLang.data as { code: string; name: string }[] | null) ?? []);
    this._usedLanguages.set((usedLang.data as { code: string; name: string }[] | null) ?? []);
    const byGenre: Record<string, { subMode: string; hasKeywords: boolean }[]> = {};
    for (const row of (sm.data as Array<{ genre: string; sub_mode: string; has_keywords: boolean }> | null) ?? []) {
      (byGenre[row.genre] ??= []).push({ subMode: row.sub_mode, hasKeywords: row.has_keywords });
    }
    this._submodesByGenre.set(byGenre);
    this.loaded.set(true);
  }

  /** Server-side filtered + sorted + paginated creator query.
   *
   * Two modes (CPI Consumer Wiring §5):
   *  - **Show-all** (no platform filter): queries the `creator_cpi` view and uses
   *    `best_cpi = greatest(tw_cpi, yt_cpi)` for the minCpi filter and the cpi sort.
   *    Embeds `creator_genre_scores(gfi)`. No raw per-platform stats (cards show CPI only).
   *  - **Platform-filtered**: queries the `creators` base table with the existing
   *    platform `!inner` embed plus that platform's cpi column; filters/sorts cpi on
   *    the embedded column. Raw platform stats flow through the embed exactly as before.
   *
   * Branching lives here so it ports cleanly to a server-side RPC later (white-label).
   */
  async list(
    filters: CreatorFilters = {},
    sort: SortKey = 'cpi',
    page = 0,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Promise<PagedCreators> {
    const showAll = !filters.platform || filters.platform === ALL_PLATFORMS;
    return showAll
      ? this.listShowAll(filters, sort, page, pageSize)
      : this.listPlatformFiltered(filters, sort, page, pageSize);
  }

  /** Show-all: view-backed, best_cpi-driven, no raw-stat embed. */
  private async listShowAll(
    filters: CreatorFilters,
    sort: SortKey,
    page: number,
    pageSize: number,
  ): Promise<PagedCreators> {
    const hasGenre = !!filters.genre;
    const minGfiActive = hasGenre && !!filters.minGfi && filters.minGfi > 0;
    const sortByGfi = sort === 'gfi' && hasGenre;
    const gfiJoin = minGfiActive || sortByGfi ? '!inner' : '!left';

    const selectParts = ['*'];
    if (hasGenre) selectParts.push(`creator_genre_scores${gfiJoin}(gfi)`);

    let q = this.supabase.client.from('creator_cpi').select(selectParts.join(', '), { count: 'exact' });

    if (filters.genre) {
      q = q.eq('genre', filters.genre);
      q = q.eq('creator_genre_scores.campaign_genre', filters.genre);
      q = q.eq('creator_genre_scores.sub_mode', filters.subMode || '');
    }
    if (filters.languages?.length) {
      q = q.in('language', filters.languages);
    }
    if (filters.search?.trim()) {
      const s = escapeIlike(filters.search.trim());
      q = q.or(`name.ilike.%${s}%,handle.ilike.%${s}%,bio.ilike.%${s}%`);
    }
    if (filters.tier) {
      const [lo, hi] = CREATOR_TIER_RANGES[filters.tier];
      q = q.gte('subs_parsed', lo);
      if (Number.isFinite(hi)) q = q.lt('subs_parsed', hi);
    }
    if (filters.minCpi && filters.minCpi > 0) q = q.gte('best_cpi', filters.minCpi);
    if (hasGenre && filters.minGfi && filters.minGfi > 0) {
      q = q.gte('creator_genre_scores.gfi', filters.minGfi);
    }
    if (filters.maxBudget && filters.maxBudget > 0) {
      const maxSubs = maxSubsForBudget(filters.maxBudget);
      if (Number.isFinite(maxSubs)) q = q.lt('subs_parsed', maxSubs);
    }

    if (sort === 'gfi') {
      if (hasGenre) {
        q = q.order('gfi', { ascending: false, referencedTable: 'creator_genre_scores' });
      } else {
        q = q.order('subs_parsed', { ascending: false });
      }
    } else if (sort === 'cpi') {
      // NULLS LAST: DESC puts NULLs first by default, which would float null-CPI
      // creators to the top. Keep them last.
      q = q.order('best_cpi', { ascending: false, nullsFirst: false });
    } else {
      const sortCol = sort === 'subs' ? 'subs_parsed' : sort;
      const ascending = sort === 'name';
      q = q.order(sortCol, { ascending });
    }

    const start = page * pageSize;
    q = q.range(start, start + pageSize - 1);

    const { data, error, count } = await q;
    if (error) {
      console.error('[CreatorsService] listShowAll failed:', error);
      return { creators: [], total: 0, pageCount: 1, page: 0 };
    }
    return this.toPaged(data ?? [], count, page, pageSize, 'best');
  }

  /** Platform-filtered: base-table, embedded platform cpi column, raw stats as before. */
  private async listPlatformFiltered(
    filters: CreatorFilters,
    sort: SortKey,
    page: number,
    pageSize: number,
  ): Promise<PagedCreators> {
    const platform = filters.platform!;
    const hasGenre = !!filters.genre;
    const minGfiActive = hasGenre && !!filters.minGfi && filters.minGfi > 0;
    const sortByGfi = sort === 'gfi' && hasGenre;
    const gfiJoin = minGfiActive || sortByGfi ? '!inner' : '!left';

    const platformTable = PLATFORM_TABLES[platform];
    const cpiSource: 'yt' | 'tw' = platform === 'Twitch' ? 'tw' : 'yt';

    const selectParts = ['*'];
    if (hasGenre) selectParts.push(`creator_genre_scores${gfiJoin}(gfi)`);
    if (platform === 'YouTube') {
      selectParts.push(`youtube_creators!inner(${YT_STATS_COLS}, yt_cpi)`);
    } else if (platform === 'Twitch') {
      selectParts.push(`twitch_creators!inner(handle, tw_cpi, ${TW_LIVE_COLS})`);
    } else if (platformTable) {
      selectParts.push(`${platformTable}!inner(handle)`);
    }

    let q = this.supabase.client.from('creators').select(selectParts.join(', '), { count: 'exact' });

    if (!platformTable) {
      q = q.overlaps('all_platforms', [platform]);
    }

    if (filters.genre) {
      q = q.eq('genre', filters.genre);
      q = q.eq('creator_genre_scores.campaign_genre', filters.genre);
      q = q.eq('creator_genre_scores.sub_mode', filters.subMode || '');
    }
    if (filters.languages?.length) {
      q = q.in('language', filters.languages);
    }
    if (filters.search?.trim()) {
      const s = escapeIlike(filters.search.trim());
      q = q.or(`name.ilike.%${s}%,handle.ilike.%${s}%,bio.ilike.%${s}%`);
    }
    if (filters.tier) {
      const [lo, hi] = CREATOR_TIER_RANGES[filters.tier];
      q = q.gte('subs_parsed', lo);
      if (Number.isFinite(hi)) q = q.lt('subs_parsed', hi);
    }
    if (filters.minCpi && filters.minCpi > 0) {
      // Filter on the embedded platform cpi column via PostgREST dot-notation
      // (filters have NO referencedTable option — that's order()-only). Only
      // YouTube/Twitch have a cpi column; other platform tables (handle-only
      // embed) fall back to the static creators.cpi.
      if (platform === 'YouTube') q = q.gte('youtube_creators.yt_cpi', filters.minCpi);
      else if (platform === 'Twitch') q = q.gte('twitch_creators.tw_cpi', filters.minCpi);
      else q = q.gte('cpi', filters.minCpi);
    }
    if (hasGenre && filters.minGfi && filters.minGfi > 0) {
      q = q.gte('creator_genre_scores.gfi', filters.minGfi);
    }
    if (filters.maxBudget && filters.maxBudget > 0) {
      const maxSubs = maxSubsForBudget(filters.maxBudget);
      if (Number.isFinite(maxSubs)) q = q.lt('subs_parsed', maxSubs);
    }

    if (sort === 'gfi') {
      if (hasGenre) {
        q = q.order('gfi', { ascending: false, referencedTable: 'creator_genre_scores' });
      } else {
        q = q.order('subs_parsed', { ascending: false });
      }
    } else if (sort === 'subs' && platform === 'YouTube') {
      q = q.order('subscriber_count', { ascending: false, referencedTable: 'youtube_creators' });
    } else if (sort === 'cpi' && platform === 'YouTube') {
      q = q.order('yt_cpi', { ascending: false, nullsFirst: false, referencedTable: 'youtube_creators' });
    } else if (sort === 'cpi' && platform === 'Twitch') {
      q = q.order('tw_cpi', { ascending: false, nullsFirst: false, referencedTable: 'twitch_creators' });
    } else {
      const sortCol = sort === 'subs' ? 'subs_parsed' : sort;
      const ascending = sort === 'name';
      q = q.order(sortCol, { ascending });
    }

    const start = page * pageSize;
    q = q.range(start, start + pageSize - 1);

    const { data, error, count } = await q;
    if (error) {
      console.error('[CreatorsService] listPlatformFiltered failed:', error);
      return { creators: [], total: 0, pageCount: 1, page: 0 };
    }
    return this.toPaged(data ?? [], count, page, pageSize, cpiSource);
  }

  /** Shared paging + row-mapping tail for both list modes. */
  private toPaged(
    rows: Record<string, any>[],
    count: number | null,
    page: number,
    pageSize: number,
    cpiSource: 'best' | 'yt' | 'tw',
  ): PagedCreators {
    const total = count ?? 0;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(0, page), pageCount - 1);
    return {
      creators: rows.map((r) => fromDb(r, cpiSource)),
      total,
      pageCount,
      page: safePage,
    };
  }

  // byId/byIds read the creator_cpi VIEW (not the base creators table) so the
  // hydrated Creator carries the dynamic best_cpi/tw_cpi/yt_cpi. This keeps the
  // hydrate-known-creators paths (scoring, simulator, campaign creator/outreach
  // lists, profile modal) on the dynamic CPI — mirrors campaign-suggest.
  //
  // The embed below pulls FRESH per-platform stats onto the hydrated Creator so
  // these paths stop showing the stale static creators.subs/avg_views/eng
  // snapshot. EMPIRICALLY VERIFIED: the creator_cpi view exposes PostgREST
  // relationships to both youtube_creators and twitch_creators — a probe
  // (select=id,youtube_creators(subscriber_count),twitch_creators(avg_ccv))
  // returned 200 with embedded objects (null when the creator has no row /
  // stats on that platform). So no base-table fallback is needed.
  private static readonly STATS_EMBED =
    `*, youtube_creators(${YT_STATS_COLS}), twitch_creators(${TW_LIVE_COLS})`;

  async byId(id: number): Promise<Creator | undefined> {
    const { data, error } = await this.supabase.client
      .from('creator_cpi')
      .select(CreatorsService.STATS_EMBED)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return undefined;
    return fromDb(data);
  }

  async byIds(ids: Iterable<number>): Promise<Creator[]> {
    const arr = Array.from(ids);
    if (arr.length === 0) return [];
    const { data, error } = await this.supabase.client
      .from('creator_cpi')
      .select(CreatorsService.STATS_EMBED)
      .in('id', arr);
    if (error) {
      console.error('[CreatorsService] byIds failed:', error);
      return [];
    }
    return (data ?? []).map((r) => fromDb(r));
  }
}
