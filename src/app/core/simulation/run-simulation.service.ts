import { Injectable, inject, signal } from '@angular/core';
import { EdgeClient } from '../api/edge.client';
import { SimInputs, SimResult } from './simulation.types';
import { partitionByLiveData } from './live-stats';

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
}
