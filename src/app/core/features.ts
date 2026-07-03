// Central feature flags — single source of truth so a feature can be fully
// shown/hidden from one place.
export const FEATURES = {
  // AI personas: the standalone Personas page/route/nav AND the campaign
  // "audience-aligned suggestions" block. Both are HIDDEN pending the product +
  // compliance review (simfluence-backend/docs/persona-feature-review.md).
  // Flip to `true` to re-enable everything in one move.
  personas: false,

  // Creator Matcher: the in-campaign auto creator-selector that replaces the
  // hidden personas block (planning-only). Ships on; keep the flag for one
  // release then remove. See
  // simfluence-backend/docs/superpowers/specs/2026-07-03-creator-matcher-design.md.
  creatorMatcher: true,
} as const;
