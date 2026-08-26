import { Injectable, inject } from '@angular/core';
import { EdgeClient } from '../api/edge.client';
import { Objective } from './simulation.types';
import { W2CampaignRequest, W2FreeRequest, W2Response } from './simulation-w2.types';

/**
 * Wraps the `/functions/v1/run-simulation` edge function.
 *
 * Same edge function for both modes, `mode: 'free' | 'campaign'` (spec §1).
 * The server loads every stat, deliverable and modelling param itself (spec
 * §2) – the client sends ids only, never stats. Neither call catches: a failed
 * request rejects, so the caller (the simulation panel) can distinguish "no
 * forecast yet" from "the request failed" instead of both collapsing to
 * `null`. Pending state lives on the panel, not here.
 */
@Injectable({ providedIn: 'root' })
export class RunSimulationService {
  private edge = inject(EdgeClient);

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
