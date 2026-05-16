import { Injectable, inject, signal } from '@angular/core';
import { CREATOR_TIER_RANGES, Creator, CreatorFilters, PagedCreators, SortKey, maxSubsForBudget } from '../data/creator.types';
import { SupabaseService } from '../supabase/supabase.service';

const DEFAULT_PAGE_SIZE = 24;

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
    ytUrl: row['yt_url'],
    twUrl: row['tw_url'],
    ytHandle: row['yt_handle'],
    ytSubs: row['yt_subs'],
    ytAvgViews: row['yt_avg_views'],
    ytCpi: row['yt_cpi'],
    realCVR: row['real_cvr'],
    realCPA: row['real_cpa'],
    rates: row['rates'] ?? undefined,
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
   * When `filters.genre` is set, the query joins `creator_genre_scores` so
   * each row carries a per-genre `gfi`. Sort-by-gfi and minGfi filter both
   * operate on the join. When no genre is set, no join happens and `gfi` is
   * `null` on every returned creator (UI shows a placeholder).
   */
  async list(
    filters: CreatorFilters = {},
    sort: SortKey = 'cpi',
    page = 0,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Promise<PagedCreators> {
    const hasGenre = !!filters.genre;
    const selectExpr = hasGenre
      ? '*, creator_genre_scores!left(gfi)'
      : '*';
    let q = this.supabase.client.from('creators').select(selectExpr, { count: 'exact' });

    if (filters.genre) {
      q = q.eq('genre', filters.genre);
      // Restrict the embedded resource to the requested campaign genre. With
      // !left this preserves creators that have no score row yet — they get
      // gfi: null and the UI shows the "—" placeholder.
      q = q.eq('creator_genre_scores.campaign_genre', filters.genre);
    }
    if (filters.platforms?.length) {
      q = q.overlaps('all_platforms', filters.platforms);
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
    // minGfi only meaningful when a campaign genre is in scope. Filter is
    // applied on the joined column; UI hides the slider when no genre.
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
        // UI prevents this case (sort='gfi' disabled when no genre). Defensive
        // fallback so a stale URL/state doesn't blow up the query.
        q = q.order('subs_parsed', { ascending: false });
      }
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
