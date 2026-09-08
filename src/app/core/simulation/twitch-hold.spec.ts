import { describe, expect, it } from 'vitest';
import { blendedHeld, platformHeld } from './twitch-hold';

describe('twitch-hold (LIAM-QA (a))', () => {
  it('holds Twitch from non-admins only', () => {
    expect(platformHeld('Twitch', false)).toBe(true);
    expect(platformHeld('Twitch', true)).toBe(false);
    expect(platformHeld('YouTube', false)).toBe(false);
  });

  it('holds a blend whenever any Twitch row feeds it, unless admin', () => {
    const mixed = [{ platform: 'YouTube' }, { platform: 'Twitch' }];
    expect(blendedHeld(mixed, false)).toBe(true);
    expect(blendedHeld(mixed, true)).toBe(false);
    expect(blendedHeld([{ platform: 'YouTube' }], false)).toBe(false);
    expect(blendedHeld([], false)).toBe(false);
  });
});
