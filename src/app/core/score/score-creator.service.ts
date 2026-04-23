import { Injectable, inject, signal } from '@angular/core';
import { EdgeClient } from '../api/edge.client';
import { Creator } from '../data/creator.types';

export interface CpiFactor {
  label: string;
  value: string | number;
  score: number | string;
  max: number;
  note: string;
}

export interface CpiBreakdown {
  factors: CpiFactor[];
}

export interface ScoreResult {
  id: number | string;
  gfi: number;
  cpiBreakdown?: CpiBreakdown;
}

export interface ScoreBulkInput {
  creators: Creator[];
  campaignGenre: string;
  subMode?: string;
  secondaryGenres?: string[];
}

interface EdgePayload {
  creators: Array<{
    id: string;
    genre: string;
    bio: string;
    handle: string;
    name: string;
    platform: string;
    subs: string;
    avgViews: string;
    eng: string;
    language: string;
    verifiedDeals: string;
    cpi: string;
  }>;
  campaignGenre: string;
  subMode: string;
  secondaryGenres: string[];
}

interface EdgeResponse {
  results?: ScoreResult[];
}

@Injectable({ providedIn: 'root' })
export class ScoreCreatorService {
  private edge = inject(EdgeClient);

  private gfiCache = new Map<number, number>();
  private cpiBreakdownCache = new Map<number, CpiBreakdown>();

  readonly pending = signal(false);
  /** Bumps on each completed fetch so consumers can bind to reactive signals. */
  readonly version = signal(0);

  clear(): void {
    this.gfiCache.clear();
    this.cpiBreakdownCache.clear();
    this.version.update((v) => v + 1);
  }

  getGfi(id: number): number | undefined {
    return this.gfiCache.get(id);
  }

  getBreakdown(id: number): CpiBreakdown | undefined {
    return this.cpiBreakdownCache.get(id);
  }

  async scoreBulk(input: ScoreBulkInput): Promise<Map<number, number>> {
    this.pending.set(true);
    try {
      const payload: EdgePayload = {
        creators: input.creators.map((c) => ({
          id: String(c.id),
          genre: c.genre ?? '',
          bio: c.bio ?? '',
          handle: c.handle ?? '',
          name: c.name ?? '',
          platform: c.platform ?? '',
          subs: c.subs ?? '',
          avgViews: c.avgViews ?? '',
          eng: c.eng ?? '',
          language: c.language ?? 'English',
          verifiedDeals: String(c.verifiedDeals ?? 0),
          cpi: String(c.cpi ?? 50),
        })),
        campaignGenre: input.campaignGenre || 'Gaming & Esports',
        subMode: input.subMode ?? '',
        secondaryGenres: input.secondaryGenres ?? [],
      };

      const res = await this.edge.post<EdgeResponse>('score-creator', payload);
      const map = new Map<number, number>();

      for (const r of res.results ?? []) {
        const id = Number(r.id);
        if (!Number.isFinite(id)) continue;
        if (typeof r.gfi === 'number') {
          this.gfiCache.set(id, r.gfi);
          map.set(id, r.gfi);
        }
        if (r.cpiBreakdown) {
          this.cpiBreakdownCache.set(id, r.cpiBreakdown);
        }
      }

      this.version.update((v) => v + 1);
      return map;
    } finally {
      this.pending.set(false);
    }
  }
}
