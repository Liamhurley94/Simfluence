import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { SideNavComponent } from './side-nav.component';
import { AuthService } from '../../core/auth/auth.service';
import { UpgradePromptService } from '../../core/upgrade/upgrade-prompt.service';
import { Tier } from '../../core/types';

function setup(userTier: Tier) {
  const tier = signal<Tier>(userTier);
  const authStub = { tier, user: () => null } as unknown as AuthService;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [SideNavComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authStub },
    ],
  });

  const fixture = TestBed.createComponent(SideNavComponent);
  fixture.detectChanges();
  return { fixture, upgrade: TestBed.inject(UpgradePromptService) };
}

describe('SideNavComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders all 7 tabs', () => {
    const { fixture } = setup('free');
    const anchors = fixture.nativeElement.querySelectorAll('a[data-testid^="nav-"]');
    expect(anchors.length).toBe(7);
  });

  it('marks silver+ tabs as locked for free tier', () => {
    const { fixture } = setup('free');
    const lockedLabels = ['personas', 'campaigns', 'outreach'];
    for (const label of lockedLabels) {
      const anchor = fixture.nativeElement.querySelector(`[data-testid="nav-${label}"]`);
      expect(anchor?.getAttribute('aria-disabled')).toBe('true');
      expect(anchor?.querySelector('[data-testid="nav-lock"]')).toBeTruthy();
    }
  });

  it('does not lock silver+ tabs for silver tier', () => {
    const { fixture } = setup('silver');
    const anchor = fixture.nativeElement.querySelector('[data-testid="nav-personas"]');
    expect(anchor?.getAttribute('aria-disabled')).toBe('false');
    expect(anchor?.querySelector('[data-testid="nav-lock"]')).toBeNull();
  });

  it('onClick opens the upgrade prompt and preventsDefault for a locked tab', () => {
    const { fixture, upgrade } = setup('free');
    const event = new MouseEvent('click', { cancelable: true, bubbles: true });
    (fixture.componentInstance as unknown as {
      onClick: (tab: unknown, e: MouseEvent) => void;
    }).onClick({ label: 'Personas', route: '/app/personas', minTier: 'silver' }, event);

    expect(upgrade.current()).toEqual({ feature: 'Personas', requiredTier: 'silver' });
    expect(event.defaultPrevented).toBe(true);
  });

  it('onClick does nothing extra for an unlocked tab', () => {
    const { fixture, upgrade } = setup('free');
    const event = new MouseEvent('click', { cancelable: true, bubbles: true });
    (fixture.componentInstance as unknown as {
      onClick: (tab: unknown, e: MouseEvent) => void;
    }).onClick({ label: 'Discovery', route: '/app/discovery' }, event);

    expect(upgrade.current()).toBeNull();
    expect(event.defaultPrevented).toBe(false);
  });
});
