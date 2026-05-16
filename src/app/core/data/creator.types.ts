export interface Creator {
  id: number;
  name: string;
  handle: string;
  platform: string;
  allPlatforms?: string[];
  subs: string;
  subsParsed: number;
  avgViews: string;
  eng: string;
  genre: string;
  cpi: number;
  // null when no campaign genre is in scope (Discovery without a genre filter,
  // or paths that don't go through CreatorsService.list — byId/byIds always
  // return null). Populated from `creator_genre_scores` join.
  gfi: number | null;
  color: string;
  verifiedDeals: number;
  sponsorHistory: string[];
  bio: string;

  // optional enrichment fields
  language?: string;
  ytUrl?: string;
  twUrl?: string;
  ytHandle?: string;
  ytSubs?: string;
  ytAvgViews?: string;
  ytCpi?: number;
  youtubeHandle?: string;
  realCVR?: number;
  realCPA?: number;
  rates?: {
    int?: [number, number];
    ded?: [number, number];
    mix?: [number, number];
  };
}

export type Platform = 'YouTube' | 'Twitch' | 'Instagram' | 'TikTok' | 'Kick' | 'X';
export type SortKey = 'cpi' | 'gfi' | 'subs' | 'name';

export type CreatorTier = 'Micro' | 'Mid-tier' | 'Established' | 'Megastar';

// Half-open subscriber-count ranges per tier: [lo, hi). Megastar's hi is Infinity.
export const CREATOR_TIER_RANGES: Record<CreatorTier, [number, number]> = {
  Micro: [0, 50_000],
  'Mid-tier': [50_000, 500_000],
  Established: [500_000, 2_000_000],
  Megastar: [2_000_000, Infinity],
};

export const CREATOR_TIER_COLORS: Record<CreatorTier, string> = {
  Megastar: '#FFD400',
  Established: '#FF7A00',
  'Mid-tier': '#0050FF',
  Micro: '#00C46A',
};

export function tierForSubs(subsParsed: number): CreatorTier {
  if (subsParsed >= 2_000_000) return 'Megastar';
  if (subsParsed >= 500_000) return 'Established';
  if (subsParsed >= 50_000) return 'Mid-tier';
  return 'Micro';
}

export interface CreatorFilters {
  genre?: string;
  platforms?: string[];
  languages?: string[];
  search?: string;
  tier?: CreatorTier;
  minCpi?: number;
  minGfi?: number;
  /**
   * Campaign-budget ceiling. Filters creators whose typical reach (subs) implies
   * a deal cost likely to fit within the budget. Heuristic — see
   * `maxSubsForBudget()` in CreatorsService for the mapping.
   */
  maxBudget?: number | null;
}

/**
 * Maps a campaign budget to a maximum creator size (subs_parsed) we'll surface
 * in discovery. Heuristic: bigger budgets unlock bigger creators. Anchored to
 * the legacy tier bands (Micro / Mid-tier / Established / Megastar).
 *
 * - <$10K     → Micro only (≤50K subs)
 * - $10K-50K  → Micro or low mid-tier (≤100K subs)
 * - $50K-250K → Mid-tier and smaller (≤500K subs)
 * - $250K-1M  → Up to Established (≤2M subs)
 * - $1M+      → No cap (Megastars included)
 */
export function maxSubsForBudget(budget: number): number {
  if (budget >= 1_000_000) return Number.POSITIVE_INFINITY;
  if (budget >= 250_000) return 2_000_000;
  if (budget >= 50_000) return 500_000;
  if (budget >= 10_000) return 100_000;
  return 50_000;
}

export interface PagedCreators {
  creators: Creator[];
  total: number;
  pageCount: number;
  page: number;
}
