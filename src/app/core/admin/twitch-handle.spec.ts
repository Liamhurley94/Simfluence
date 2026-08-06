import { describe, expect, it } from 'vitest';
import { isValidTwitchHandleInput } from './twitch-handle';

describe('isValidTwitchHandleInput', () => {
  it('accepts real handles with @ prefix and mixed case', () => {
    expect(isValidTwitchHandleInput('@LinusTech')).toBe(true);
    expect(isValidTwitchHandleInput('linustech')).toBe(true);
    expect(isValidTwitchHandleInput(' @Foo_Bar1 ')).toBe(true);
  });

  it('rejects what Twitch rejects', () => {
    expect(isValidTwitchHandleInput('@bmsjoël')).toBe(false); // the 2026-08 batch poisoner
    expect(isValidTwitchHandleInput('name with space')).toBe(false);
    expect(isValidTwitchHandleInput('dash-name')).toBe(false);
    expect(isValidTwitchHandleInput('')).toBe(false);
    expect(isValidTwitchHandleInput('a'.repeat(26))).toBe(false);
  });
});
