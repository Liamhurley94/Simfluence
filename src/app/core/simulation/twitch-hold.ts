// src/app/core/simulation/twitch-hold.ts
//
// LIAM-QA (a), 2026-08-31: the Twitch conversion forecast is NOT signed off
// for clients. It is D26's maths applied honestly (CCV unmultiplied,
// saturating hard), but D26 itself calls CCV a visibility floor with a known
// conservative bias, and the resulting cost per conversion reads as Twitch
// being ~50× worse value than YouTube. Held back from non-admin viewers until
// it has been checked against a real campaign's actuals; admins (internal
// views) still see everything.
//
// What is held: conversions AND cost per conversion. Hiding only the ratio
// would leave its two inputs side by side ("34 conversions · $37,550") for
// anyone to divide. Reach, impressions, engaged clicks and cost stay — Liam
// trusts CCV as a visibility figure; it is the conversion step he doesn't.
//
// The rule covers every figure whose denominator includes Twitch conversions,
// not just the Twitch row: a creator line and the campaign headline both
// blend, and a roster where only the Twitch creator is affordable makes the
// headline the held number verbatim. Blends are held outright rather than
// recomputed YouTube-only on the client — the forecast is server-side by
// design, and a client-side subtraction would put Twitch's number one step
// away.

export const TWITCH_HELD_TITLE =
  'Twitch conversion forecasts are held back until validated against campaign actuals';

/** A single platform's own conversions / cost per conversion. */
export function platformHeld(platform: string, isAdmin: boolean): boolean {
  return platform === 'Twitch' && !isAdmin;
}

/** A blended figure (creator line, campaign headline) — held whenever any Twitch row feeds it. */
export function blendedHeld(rows: ReadonlyArray<{ platform: string }>, isAdmin: boolean): boolean {
  return !isAdmin && rows.some((r) => r.platform === 'Twitch');
}
