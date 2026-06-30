/**
 * Canonical YouTube API III.E.4h compliance copy — single source of truth.
 *
 * YouTube's compliance team (project 11401102800) requires a clear disclaimer
 * that Simfluence's scores are independently calculated and not derived from
 * YouTube. These two strings are the ONE place that wording lives — the app-shell
 * footer and the per-zone "proprietary" caption both read from here so the
 * phrasing can't drift out of compliance.
 *
 * See docs/superpowers/specs/2026-06-30-youtube-compliance-card-redesign-design.md
 */

/** Wording A — app-shell footer, always visible on every authenticated page. */
export const COMPLIANCE_FOOTER =
  'Simfluence scores — CPI, GFI, rate estimates and category benchmarks — are ' +
  'independently calculated by Simfluence and are not derived from YouTube or ' +
  'other source platforms. They are Simfluence proprietary metrics, not provided ' +
  'by, endorsed by, or affiliated with YouTube / Google.';

/** Wording B — per-zone caption beside Simfluence scores (card + profile modal). */
export const PROPRIETARY_NOTE =
  'Proprietary — independently calculated by Simfluence, not a platform-provided metric.';
