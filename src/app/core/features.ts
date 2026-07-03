// Central feature flags — single source of truth so a feature can be fully
// shown/hidden from one place.
export const FEATURES = {
  // Creator Matcher: the in-campaign auto creator-selector that replaced the
  // retired personas feature (planning-only). Ships on; keep the flag for one
  // release then remove. See
  // simfluence-backend/docs/superpowers/specs/2026-07-03-creator-matcher-design.md.
  creatorMatcher: true,
} as const;
