import { Injectable } from '@angular/core';
import { GENRE_BENCHMARKS } from '../data/benchmarks.data';
import { NICHE_SPONSOR_CPM, DEFAULT_CPM } from '../data/cpm-tables.data';
import {
  AWARENESS_OBJECTIVES,
  ENGAGEMENT_OBJECTIVES,
  Objective,
  ObjectiveWeights,
  SALES_OBJECTIVES,
  SimInputs,
  SimResult,
} from './simulation.types';

const FALLBACK_GENRE = 'Gaming & Esports';

export function computeObjectiveWeights(objectives: Objective[]): ObjectiveWeights {
  const aW = objectives.filter((o) => AWARENESS_OBJECTIVES.includes(o)).length;
  const sW = objectives.filter((o) => SALES_OBJECTIVES.includes(o)).length;
  const eW = objectives.filter((o) => ENGAGEMENT_OBJECTIVES.includes(o)).length;
  const total = Math.max(aW + sW + eW, 1);
  return { awarenessW: aW / total, salesW: sW / total, engagementW: eW / total };
}

/**
 * Pure client-side fallback for the `run-simulation` edge function.
 * Ported from `computeSimResults` in reference/app.html (~line 13086).
 *
 * Pure function — no DI, no side effects. Feed the same inputs, get the same
 * numbers. Golden-tested against app.html to pin behavior.
 */
@Injectable({ providedIn: 'root' })
export class SimulationService {
  compute(inputs: SimInputs): SimResult | null {
    const { creators, budget, format, genre, objectives, subMode } = inputs;
    if (creators.length === 0) return null;

    const bench = GENRE_BENCHMARKS[genre] ?? GENRE_BENCHMARKS[FALLBACK_GENRE];
    const { awarenessW, salesW, engagementW } = computeObjectiveWeights(objectives);

    const formatMult = format === 'Dedicated' ? 1.4 : format === 'Mixed' ? 1.15 : 1.0;
    const subModeMult = subMode ? 1.08 : 1.0;
    const fmtCtrAdj = format === 'Dedicated' ? 1.35 : format === 'Mixed' ? 1.12 : 1.0;
    const fmtCvrAdj = format === 'Dedicated' ? 0.8 : format === 'Mixed' ? 0.95 : 1.15;

    const niche = NICHE_SPONSOR_CPM[genre] ?? DEFAULT_CPM;
    const cpmBase = niche.med * (format === 'Dedicated' ? niche.dedMult : 1.0);
    const avgCPI = creators.reduce((a, c) => a + c.cpi, 0) / creators.length / 100;
    const cpmActual = cpmBase * Math.max(0.6, avgCPI);
    const impressions = Math.round(
      (budget / Math.max(cpmActual, 1)) * 1000 * subModeMult * formatMult,
    );

    const ctrMult = avgCPI * (1 + awarenessW * 0.15 - salesW * 0.05) * fmtCtrAdj;
    const ctr = Math.min(bench.ctrBase * ctrMult, 15);
    const cvr = Math.min(
      bench.cvrBase * (1 + salesW * 0.3 - awarenessW * 0.1) * avgCPI * fmtCvrAdj,
      20,
    );
    const clicks = Math.round((impressions * ctr) / 100);
    const conversions = Math.round((clicks * cvr) / 100);
    const revenue = conversions * 30;
    const roas = budget > 0 ? revenue / budget : 0;
    const engRate = Math.min(bench.engBase * (1 + engagementW * 0.2) * avgCPI, 20);

    return {
      impressions,
      ctr: Math.round(ctr * 10) / 10,
      cpM: Math.round(cpmActual * 100) / 100,
      cvr: Math.round(cvr * 10) / 10,
      conversions,
      roas: Math.round(roas * 10) / 10,
      engRate: Math.round(engRate * 10) / 10,
      clicks,
      budget,
      bench,
      p10: {
        impressions: Math.round(impressions * 0.68),
        ctr: Math.round(ctr * 0.68 * 10) / 10,
        roas: Math.round(roas * 0.65 * 10) / 10,
      },
      p50: {
        impressions,
        ctr: Math.round(ctr * 10) / 10,
        roas: Math.round(roas * 10) / 10,
      },
      p90: {
        impressions: Math.round(impressions * 1.42),
        ctr: Math.round(ctr * 1.42 * 10) / 10,
        roas: Math.round(roas * 1.45 * 10) / 10,
      },
    };
  }
}
