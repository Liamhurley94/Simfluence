import { describe, expect, it } from 'vitest';
import { UpgradePromptService } from './upgrade-prompt.service';

describe('UpgradePromptService', () => {
  it('starts with no current request', () => {
    const svc = new UpgradePromptService();
    expect(svc.current()).toBeNull();
  });

  it('open() sets feature and tier', () => {
    const svc = new UpgradePromptService();
    svc.open('Personas', 'silver');
    expect(svc.current()).toEqual({ feature: 'Personas', requiredTier: 'silver' });
  });

  it('close() resets to null', () => {
    const svc = new UpgradePromptService();
    svc.open('Campaigns', 'silver');
    svc.close();
    expect(svc.current()).toBeNull();
  });

  it('open() overwrites prior request', () => {
    const svc = new UpgradePromptService();
    svc.open('A', 'silver');
    svc.open('B', 'gold');
    expect(svc.current()).toEqual({ feature: 'B', requiredTier: 'gold' });
  });
});
