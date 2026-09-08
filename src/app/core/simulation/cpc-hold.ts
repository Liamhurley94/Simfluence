// src/app/core/simulation/cpc-hold.ts
//
// LIAM-QA (a), 2026-08-31: Twitch cost per conversion is NOT signed off for
// clients. It is D26's maths applied honestly (CCV unmultiplied, saturating
// hard), but D26 itself calls CCV a visibility floor with a known conservative
// bias, and the figure reads as Twitch being ~50× worse value than YouTube.
// Held back from non-admin viewers until it has been checked against a real
// campaign's actuals; admins (internal views) still see it. Only the ratio is
// held — the conversions and cost it derives from still render.
//
// The rule has to cover every figure whose denominator includes Twitch
// conversions, not just the Twitch row: a creator line and the campaign
// headline both blend, and a roster where only the Twitch creator is
// affordable makes the headline the held number verbatim.

export const TWITCH_CPC_HELD_TITLE =
  'Twitch cost per conversion is held back until validated against campaign actuals';

/** A single platform's own cost per conversion. */
export function platformCpcHeld(platform: string, isAdmin: boolean): boolean {
  return platform === 'Twitch' && !isAdmin;
}

/** A blended figure (creator line, campaign headline) — held whenever any Twitch row feeds it. */
export function blendedCpcHeld(rows: ReadonlyArray<{ platform: string }>, isAdmin: boolean): boolean {
  return !isAdmin && rows.some((r) => r.platform === 'Twitch');
}
