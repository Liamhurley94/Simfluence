// Central feature flags — single source of truth so a feature can be fully
// shown/hidden from one place.
export const FEATURES = {
  // AI personas: the standalone Personas page/route/nav AND the campaign
  // "audience-aligned suggestions" block. Both are HIDDEN pending the product +
  // compliance review (simfluence-backend/docs/persona-feature-review.md).
  // Flip to `true` to re-enable everything in one move.
  personas: false,
} as const;
