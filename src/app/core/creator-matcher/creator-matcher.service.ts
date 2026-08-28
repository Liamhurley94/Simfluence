import { Injectable, inject } from '@angular/core';
import { EdgeClient } from '../api/edge.client';

/**
 * The Creator Matcher (`match-creators` edge fn).
 * See simfluence-backend/docs/superpowers/specs/2026-07-03-creator-matcher-design.md §4.
 *
 * Given an explicit `{ genre, budget?, objectives?, excludeIds? }`, returns a
 * ranked shortlist with the strategy auto-derived by the backend — there is NO
 * user-facing strategy picker, so the client never sends a `strategy`.
 */

/** Rate-estimate range triples (int / dedicated / mixed), each `[lo, hi]`. */
export interface MatchRateEstimate {
  ranges: {
    int?: [number, number];
    ded?: [number, number];
    mix?: [number, number];
  };
}

/**
 * A raw creator row as returned by the edge fn — the `creator_cpi` view shape
 * (snake_case DB columns), not the frontend camelCase `Creator`. Only the
 * fields the Matcher UI reads are declared; the row carries more.
 */
export interface MatchedCreatorRow {
  id: number;
  name: string;
  handle: string;
  platform: string;
  genre?: string;
  color?: string;
  subs?: string;
  subs_parsed?: number;
  avg_views?: string;
  eng?: string;
  cpi?: number;
  best_cpi?: number | null;
  [key: string]: unknown;
}

export interface MatchedCreator {
  creator: MatchedCreatorRow;
  best_cpi: number | null;
  gfi: number | null;
  reach: number;
  rateEstimate: MatchRateEstimate;
  why: string;
}

export interface MatchResult {
  optimizedFor: 'reach' | 'fit';
  budgetConstrained: boolean;
  budget: number | null;
  creators: MatchedCreator[];
}

export interface MatchInput {
  genre: string;
  budget?: number | null;
  objectives?: string[];
  excludeIds?: number[];
  limit?: number;
  /** Campaign context — when set, the backend logs this run's suggestions
   * against the campaign (D24 §5 booked-vs-recommended). */
  campaignId?: string | null;
}

interface MatchResponse extends Partial<MatchResult> {
  error?: string;
}

const EMPTY_RESULT: MatchResult = {
  optimizedFor: 'fit',
  budgetConstrained: false,
  budget: null,
  creators: [],
};

@Injectable({ providedIn: 'root' })
export class CreatorMatcherService {
  private edge = inject(EdgeClient);

  /** Ranked shortlist for the given settings. Empty result on error. */
  async match(input: MatchInput): Promise<MatchResult> {
    // Only send fields the caller supplied — the backend defaults the rest.
    const payload: Record<string, unknown> = { genre: input.genre };
    if (input.budget != null) payload['budget'] = input.budget;
    if (input.objectives) payload['objectives'] = input.objectives;
    if (input.excludeIds) payload['excludeIds'] = input.excludeIds;
    if (input.limit != null) payload['limit'] = input.limit;
    if (input.campaignId) payload['campaignId'] = input.campaignId;

    try {
      const res = await this.edge.post<MatchResponse>('match-creators', payload);
      if (res.error || !res.creators) return { ...EMPTY_RESULT };
      return {
        optimizedFor: res.optimizedFor ?? 'fit',
        budgetConstrained: res.budgetConstrained ?? false,
        budget: res.budget ?? null,
        creators: res.creators,
      };
    } catch (err) {
      console.error('[CreatorMatcherService] match failed:', err);
      return { ...EMPTY_RESULT };
    }
  }
}
