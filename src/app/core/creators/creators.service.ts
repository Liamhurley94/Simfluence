import { Injectable, inject, signal } from '@angular/core';
import { CREATOR_TIER_RANGES, Creator, CreatorFilters, PagedCreators, SortKey, YoutubeStats, maxSubsForBudget } from '../data/creator.types';
import { SupabaseService } from '../supabase/supabase.service';

const DEFAULT_PAGE_SIZE = 24;

const PLATFORM_TABLES: Record<string, string> = {
  YouTube: 'youtube_creators',
  Twitch: 'twitch_creators',
  Instagram: 'instagram_creators',
  TikTok: 'tiktok_creators',
  Facebook: 'facebook_creators',
  'Facebook Gaming': 'facebook_creators',
  Twitter: 'twitter_creators',
};

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

function fromDb(row: Record<string, any>): Creator {
  // GFI lives in `creator_genre_scores` keyed on (creator_id, campaign_genre)
  // and is only populated on `list()` queries with a genre filter. PostgREST
  // returns the embedded resource as an array — flatten to the single row's
  // gfi (filtered upstream to the requested campaign_genre).
  const scores = row['creator_genre_scores'];
  const gfi: number | null = Array.isArray(scores) && scores.length > 0 && typeof scores[0]?.gfi === 'number'
    ? scores[0].gfi
    : null;
  return {
    id: row['id'],
    name: row['name'],
    handle: row['handle'],
    platform: row['platform'],
    allPlatforms: Array.isArray(row['all_platforms']) ? row['all_platforms'] : undefined,
    subs: row['subs'],
    subsParsed: Number(row['subs_parsed'] ?? 0),
    avgViews: row['avg_views'],
    eng: row['eng'],
    genre: row['genre'],
    cpi: row['cpi'],
    gfi,
    color: row['color'],
    verifiedDeals: row['verified_deals'],
    sponsorHistory: Array.isArray(row['sponsor_history']) ? row['sponsor_history'] : [],
    bio: row['bio'],
    language: row['language'],
    realCVR: row['real_cvr'],
    realCPA: row['real_cpa'],
    rates: row['rates'] ?? undefined,
    ytStats: parseYtStats(row),
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
  private readonly _languages = signal<string[]>([]);

  readonly genres = this._genres.asReadonly();
  readonly platforms = this._platforms.asReadonly();
  readonly languages = this._languages.asReadonly();
  readonly loaded = signal(false);

  /** Called by APP_INITIALIZER on boot. Populates filter dropdowns. */
  async loadFilterOptions(): Promise<void> {
    const [g, p, l] = await Promise.all([
      this.supabase.client.rpc('get_creator_genres'),
      this.supabase.client.rpc('get_creator_platforms'),
      this.supabase.client.rpc('get_creator_languages'),
    ]);
    this._genres.set((g.data as string[] | null) ?? []);
    this._platforms.set((p.data as string[] | null) ?? []);
    this._languages.set((l.data as string[] | null) ?? []);
    this.loaded.set(true);
  }

  /** Server-side filtered + sorted + paginated query against public.creators.
   *
   * When `filters.platform` is set, the query INNER JOINs the corresponding
   * platform table (e.g. `youtube_creators`). For YouTube this brings live
   * nightly-refreshed stats; for other platforms it filters to that platform's
   * creators (no live stats yet). The INNER JOIN handles platform filtering
   * implicitly — no manual `all_platforms` filter needed.
   *
   * When `filters.genre` is set, the query joins `creator_genre_scores` so
   * each row carries a per-genre `gfi`. Both joins can be active simultaneously.
   */
  async list(
    filters: CreatorFilters = {},
    sort: SortKey = 'cpi',
    page = 0,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Promise<PagedCreators> {
    const hasGenre = !!filters.genre;
    const minGfiActive = hasGenre && !!filters.minGfi && filters.minGfi > 0;
    const sortByGfi = sort === 'gfi' && hasGenre;
    const gfiJoin = minGfiActive || sortByGfi ? '!inner' : '!left';

    const selectParts = ['*'];
    if (hasGenre) selectParts.push(`creator_genre_scores${gfiJoin}(gfi)`);
    const platformTable = filters.platform ? PLATFORM_TABLES[filters.platform] : undefined;
    if (filters.platform === 'YouTube') {
      selectParts.push('youtube_creators!inner(subscriber_count, avg_views, engagement_rate, sponsor_freq_pct, stats_refreshed_at)');
    } else if (platformTable) {
      selectParts.push(`${platformTable}!inner(handle)`);
    }

    let q = this.supabase.client.from('creators').select(selectParts.join(', '), { count: 'exact' });

    if (filters.platform && !platformTable) {
      q = q.overlaps('all_platforms', [filters.platform]);
    }

    if (filters.genre) {
      q = q.eq('genre', filters.genre);
      q = q.eq('creator_genre_scores.campaign_genre', filters.genre);
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
    if (filters.minCpi && filters.minCpi > 0) q = q.gte('cpi', filters.minCpi);
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
    } else if (sort === 'subs' && filters.platform === 'YouTube') {
      q = q.order('subscriber_count', { ascending: false, referencedTable: 'youtube_creators' });
    } else {
      const sortCol = sort === 'subs' ? 'subs_parsed' : sort;
      const ascending = sort === 'name';
      q = q.order(sortCol, { ascending });
    }

    const start = page * pageSize;
    q = q.range(start, start + pageSize - 1);

    const { data, error, count } = await q;
    if (error) {
      console.error('[CreatorsService] list failed:', error);
      return { creators: [], total: 0, pageCount: 1, page: 0 };
    }

    const total = count ?? 0;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(0, page), pageCount - 1);
    return {
      creators: (data ?? []).map(fromDb),
      total,
      pageCount,
      page: safePage,
    };
  }

  async byId(id: number): Promise<Creator | undefined> {
    const { data, error } = await this.supabase.client
      .from('creators')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return undefined;
    return fromDb(data);
  }

  async byIds(ids: Iterable<number>): Promise<Creator[]> {
    const arr = Array.from(ids);
    if (arr.length === 0) return [];
    const { data, error } = await this.supabase.client
      .from('creators')
      .select('*')
      .in('id', arr);
    if (error) {
      console.error('[CreatorsService] byIds failed:', error);
      return [];
    }
    return (data ?? []).map(fromDb);
  }
}
