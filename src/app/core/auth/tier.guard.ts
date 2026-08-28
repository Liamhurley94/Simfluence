import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { Tier, tierRank } from '../types';

// Awaits auth.ready() before reading the tier: on a hard page load the
// session rehydrates from localStorage near-instantly while the profile row
// (which carries the tier) is still in flight — a synchronous read bounced
// real silver users to dashboard?upgrade on every refresh of a gated route.
export function tierGuard(min: Tier): CanActivateFn {
  return async (): Promise<boolean | UrlTree> => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.ready();
    if (tierRank(auth.tier()) >= tierRank(min)) return true;
    return router.createUrlTree(['/app/dashboard'], { queryParams: { upgrade: min } });
  };
}
