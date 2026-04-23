export interface Creator {
  id: number;
  name: string;
  handle: string;
  platform: string;
  allPlatforms?: string[];
  subs: string;
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

export interface CreatorFilters {
  genre?: string;
  platforms?: string[];
  languages?: string[];
  search?: string;
}

export interface PagedCreators {
  creators: Creator[];
  total: number;
  pageCount: number;
  page: number;
}
