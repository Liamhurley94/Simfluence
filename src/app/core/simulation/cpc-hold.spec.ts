import { describe, expect, it } from 'vitest';
import { blendedCpcHeld, platformCpcHeld } from './cpc-hold';

describe('cpc-hold (LIAM-QA (a))', () => {
  it('holds Twitch from non-admins only', () => {
    expect(platformCpcHeld('Twitch', false)).toBe(true);
    expect(platformCpcHeld('Twitch', true)).toBe(false);
    expect(platformCpcHeld('YouTube', false)).toBe(false);
  });

  it('holds a blend whenever any Twitch row feeds it, unless admin', () => {
    const mixed = [{ platform: 'YouTube' }, { platform: 'Twitch' }];
    expect(blendedCpcHeld(mixed, false)).toBe(true);
    expect(blendedCpcHeld(mixed, true)).toBe(false);
    expect(blendedCpcHeld([{ platform: 'YouTube' }], false)).toBe(false);
    expect(blendedCpcHeld([], false)).toBe(false);
  });
});
