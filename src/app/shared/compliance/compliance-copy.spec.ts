import { describe, expect, it } from 'vitest';
import { COMPLIANCE_FOOTER, PROPRIETARY_NOTE } from './compliance-copy';

// These strings are the YouTube API III.E.4h compliance disclaimers shown in the
// app and screenshotted for YouTube. The assertions below guard against wording
// drift — if someone weakens the phrasing, these fail. See the YouTube email:
// "This metric is independently calculated ... and is not derived from YouTube."
describe('compliance copy', () => {
  it('footer asserts independence, denies derivation, and disclaims affiliation', () => {
    expect(COMPLIANCE_FOOTER).toContain('independently calculated by Simfluence');
    expect(COMPLIANCE_FOOTER).toContain('not derived from YouTube');
    expect(COMPLIANCE_FOOTER).toMatch(/not.*affiliated with YouTube/i);
  });

  it('per-zone note asserts the metric is Simfluence-calculated, not platform-provided', () => {
    expect(PROPRIETARY_NOTE).toContain('independently calculated by Simfluence');
    expect(PROPRIETARY_NOTE).toContain('not a platform-provided metric');
    expect(PROPRIETARY_NOTE.toLowerCase()).toContain('proprietary');
  });
});
