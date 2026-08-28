import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { tierGuard } from './tier.guard';
import { AuthService } from './auth.service';
import { Tier } from '../types';

/**
 * The guard must await AuthService.ready() before reading the tier — on a hard
 * page load the session rehydrates from localStorage almost instantly while
 * the profile row (which carries the tier) is still a network round-trip away.
 * Reading the signal synchronously bounced real silver users to
 * dashboard?upgrade=silver on every refresh of a gated route.
 */
function runGuard(opts: { tierAtCall: Tier; tierAfterReady: Tier }): Promise<boolean | UrlTree> {
  let tier: Tier = opts.tierAtCall;
  const auth = {
    tier: () => tier,
    ready: () => {
      tier = opts.tierAfterReady;
      return Promise.resolve();
    },
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: { createUrlTree: (cmds: unknown[], extras?: unknown) => ({ cmds, extras }) } },
    ],
  });
  let result!: Promise<boolean | UrlTree>;
  TestBed.runInInjectionContext(() => {
    result = tierGuard('silver')({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Promise<boolean | UrlTree>;
  });
  return result;
}

describe('tierGuard', () => {
  it('allows a silver user whose profile is already loaded', async () => {
    expect(await runGuard({ tierAtCall: 'silver', tierAfterReady: 'silver' })).toBe(true);
  });

  it('allows a silver user whose profile only loads during ready() — the hard-reload race', async () => {
    expect(await runGuard({ tierAtCall: 'free', tierAfterReady: 'silver' })).toBe(true);
  });

  it('redirects a genuinely free user to the upgrade dashboard', async () => {
    const tree = (await runGuard({ tierAtCall: 'free', tierAfterReady: 'free' })) as unknown as {
      cmds: unknown[];
      extras: { queryParams: Record<string, string> };
    };
    expect(tree.cmds).toEqual(['/app/dashboard']);
    expect(tree.extras.queryParams['upgrade']).toBe('silver');
  });
});
