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
  gfi: number;
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
}

export interface PagedCreators {
  creators: Creator[];
  total: number;
  pageCount: number;
  page: number;
}
