import { Injectable, inject, signal } from '@angular/core';
import { EdgeClient } from '../api/edge.client';
import { DEFAULT_AOV, DEFAULT_DURATION_WEEKS, Objective, SimInputs, SimResult } from './simulation.types';
import { partitionByLiveData } from './live-stats';
import { W2CampaignRequest, W2FreeRequest, W2Response } from './simulation-w2.types';

/**
 * Wraps the `/functions/v1/run-simulation` edge function.
 *
 * Returns `null` when the server responds with an error or throws. Callers
 * should fall back to the pure `SimulationService.compute()` in that case.
 */
@Injectable({ providedIn: 'root' })
export class RunSimulationService {
  private edge = inject(EdgeClient);

  readonly pending = signal(false);
  readonly latest = signal<SimResult | null>(null);

  /** @deprecated — W1 request shape; backend no longer honors aov/durationWeeks; delete at W2 merge */
  async run(inputs: SimInputs): Promise<SimResult | null> {
    this.pending.set(true);
    try {
      const included = partitionByLiveData(inputs.creators).included;
      // No creator has live data → nothing honest to forecast; don't call the edge fn.
      if (included.length === 0) {
        this.latest.set(null);
        return null;
      }
      const payload = {
        // GFI is no longer sent — the edge fn reads it from
        // `creator_genre_scores` (or falls back to score-creator on miss).
        // subs/avgViews come from LIVE stats (live-stats.ts); creators without
        // live data were dropped above and are reported by the panel.
        creators: included.map(({ creator: c, live }) => ({
          id: String(c.id),
          cpi: String(c.cpi || 50),
          genre: c.genre || '',
          platform: c.platform || '',
          subs: live.subs,
          avgViews: live.avgViews,
          language: c.language || 'English',
          // Per-creator sponsorship format when the caller mapped one; omitted
          // otherwise so the edge fn falls back to the top-level `format`.
          format: inputs.creatorFormats?.[c.id],
        })),
        budget: inputs.budget,
        format: inputs.format,
        genre: inputs.genre,
        objectives: inputs.objectives,
        subMode: inputs.subMode ?? '',
        aov: inputs.aov ?? DEFAULT_AOV,
        durationWeeks: inputs.durationWeeks ?? DEFAULT_DURATION_WEEKS,
      };

      const res = await this.edge
        .post<SimResult & { error?: string }>('run-simulation', payload)
        .catch(() => null);

      if (!res || res.error) {
        return null;
      }

      this.latest.set(res);
      return res;
    } finally {
      this.pending.set(false);
    }
  }

  clear(): void {
    this.latest.set(null);
  }

  // ── W2 rebuild ──────────────────────────────────────────────────────
  // Same edge function, `mode: 'free' | 'campaign'` (spec §1). The server
  // loads every stat, deliverable and modelling param itself (spec §2) — the
  // client sends ids only, never stats. Unlike `run()` above, these do not
  // catch: a failed request rejects, so the caller (Task 7's panel) can
  // distinguish "no forecast yet" from "the request failed" instead of both
  // collapsing to `null`.

  /** Free simulation: a roster + total budget, priced at rate-band midpoints. */
  runFree(request: {
    creators: Array<{ id: number }>;
    budget: number;
    genre: string;
    subMode?: string;
    objectives?: Objective[];
  }): Promise<W2Response> {
    const payload: W2FreeRequest = { mode: 'free', ...request };
    return this.edge.post<W2Response, W2FreeRequest>('run-simulation', payload);
  }

  /** Campaign forecast: a campaign's saved deliverable rows, priced at `agreed_fee` where entered. */
  runCampaign(
    campaignId: string,
    overrides?: { genre?: string; subMode?: string; objectives?: Objective[] },
  ): Promise<W2Response> {
    const payload: W2CampaignRequest = { mode: 'campaign', campaignId, ...overrides };
    return this.edge.post<W2Response, W2CampaignRequest>('run-simulation', payload);
  }
}
