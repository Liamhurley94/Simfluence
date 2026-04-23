import { Injectable, inject, signal } from '@angular/core';
import { EdgeClient } from '../api/edge.client';
import { SimInputs, SimResult } from './simulation.types';

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
      const payload = {
        creators: inputs.creators.map((c) => ({
          id: String(c.id),
          cpi: String(c.cpi || 50),
          gfi: String(c.gfi || 70),
          genre: c.genre || '',
          platform: c.platform || '',
          subs: c.subs || '',
          avgViews: c.avgViews || '',
          language: c.language || 'English',
          realCVR: c.realCVR !== undefined ? String(c.realCVR) : undefined,
          realCPA: c.realCPA !== undefined ? String(c.realCPA) : undefined,
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
