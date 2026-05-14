// Rate-estimate engine — ports prod's `computeCostEstimate` from `app.html`.
// Returns the three format ranges (Integrated / Dedicated / Mixed) for any
// creator, dynamically derived from genre, platform, language, follower count,
// and avg views. Stored `creator.rates.ded` is used only as a last-resort
// fallback when `avgViews` is also missing (YouTube branch only).
//
// IP note: these coefficients (CPV, CCV rates, niche multipliers, scale
// factors) come from prod's calibration of 80+ real creator deals. Currently
// mirrored client-side to match prod's location; can move server-side later
// if/when we do an IP audit.

import { Creator } from '../data/creator.types';
import { DEFAULT_CPM, NICHE_SPONSOR_CPM } from '../data/cpm-tables.data';
import { parseSubs } from '../creators/creators.service';

export interface RateRanges {
  int: [number, number];
  ded: [number, number];
  mix: [number, number];
}

// `parseSubs` already handles "180K" / "1.5M" strings; views use the same
// format so the same parser works.
const parseViews = parseSubs;

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function computeRateRanges(creator: Creator): RateRanges {
  const genre = creator.genre || 'Gaming & Esports';
  const cpms = NICHE_SPONSOR_CPM[genre] ?? DEFAULT_CPM;
  const platRaw = (creator.platform || 'YouTube').toLowerCase();
  const lang = (creator.language || 'English').toLowerCase();
  const subsN = creator.subsParsed || parseSubs(creator.subs);

  // ── TWITCH / KICK ─────────────────────────────────────────────────
  if (platRaw.includes('twitch') || platRaw.includes('kick')) {
    const ccv = parseViews(creator.avgViews) || 100;
    const baseRate = platRaw.includes('kick') ? 1.6 : lang === 'french' ? 2.25 : 2.65;
    const nicheMult = Math.max(1.0, (cpms.dedMult || 1.6) / 1.6);
    const streamBase = Math.max(650, ccv * baseRate * nicheMult);
    const intLo = Math.max(500, roundTo(streamBase * 0.72, 50));
    const intHi = roundTo(streamBase * 1.28, 50);
    const dedLo = roundTo(intLo * 1.3, 50);
    const dedHi = roundTo(intHi * 1.3, 50);
    const mixLo = roundTo((intLo + dedLo) / 2, 50);
    const mixHi = roundTo((intHi + dedHi) / 2, 50);
    return { int: [intLo, intHi], ded: [dedLo, dedHi], mix: [mixLo, mixHi] };
  }

  // ── INSTAGRAM ─────────────────────────────────────────────────────
  if (platRaw.includes('instagram')) {
    const igFollowers = subsN;
    const igEngRate = parseFloat((creator.eng || '0%').replace('%', '')) || 0.5;

    let igPostBase: number;
    if (igFollowers >= 10_000_000) igPostBase = 50_000;
    else if (igFollowers >= 1_000_000) igPostBase = 15_000;
    else if (igFollowers >= 500_000) igPostBase = 7_000;
    else if (igFollowers >= 100_000) igPostBase = 3_000;
    else if (igFollowers >= 50_000) igPostBase = 1_500;
    else igPostBase = 500;

    const igEngMult =
      igEngRate >= 3.0 ? 1.4 : igEngRate >= 1.5 ? 1.15 : igEngRate >= 0.5 ? 1.0 : 0.85;
    const igNicheMult = Math.max(1.0, (cpms.dedMult || 1.6) / 1.6);
    const igBase = igPostBase * igEngMult * igNicheMult;

    const intLo = roundTo(igBase * 0.7, 100);
    const intHi = roundTo(igBase * 1.3, 100);
    const dedLo = roundTo(igBase * 1.5, 100);
    const dedHi = roundTo(igBase * 3.0, 100);
    const mixLo = roundTo(igBase * 3.0, 100);
    const mixHi = roundTo(igBase * 6.0, 100);
    return { int: [intLo, intHi], ded: [dedLo, dedHi], mix: [mixLo, mixHi] };
  }

  // ── YOUTUBE / OTHER ───────────────────────────────────────────────
  const avgV = parseViews(creator.avgViews) || subsN * 0.08 || 0;
  let baseCPV = lang === 'german' ? 0.085 : lang === 'french' ? 0.072 : 0.085;
  const nicheAdj = Math.max(1.0, (cpms.dedMult || 1.6) / 1.6);
  baseCPV *= nicheAdj;

  const scaleFactor =
    avgV >= 500_000 ? 0.78 :
    avgV >= 200_000 ? 0.88 :
    avgV >= 50_000 ? 1.0 :
    avgV >= 15_000 ? 1.15 :
    1.4;

  // If avgViews unknown, fall back to stored rates mid-point if available.
  const storedDed = creator.rates?.ded;
  const storedDedMid = storedDed ? (storedDed[0] + storedDed[1]) / 2 : 0;
  const dedMid =
    avgV > 0
      ? Math.max(400, avgV * baseCPV * scaleFactor)
      : Math.max(400, storedDedMid || 400);

  const dedLo = Math.max(300, roundTo(dedMid * 0.72, 50));
  const dedHi = roundTo(dedMid * 1.35, 50);
  const intLo = Math.max(150, roundTo(dedLo * 0.55, 50));
  const intHi = roundTo(dedHi * 0.55, 50);
  const mixLo = roundTo(dedLo * 0.75, 50);
  const mixHi = roundTo(dedHi * 0.75, 50);

  return { int: [intLo, intHi], ded: [dedLo, dedHi], mix: [mixLo, mixHi] };
}
