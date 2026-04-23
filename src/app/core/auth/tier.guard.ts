import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { Tier, tierRank } from '../types';

export function tierGuard(min: Tier): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (tierRank(auth.tier()) >= tierRank(min)) return true;
    return router.createUrlTree(['/app/dashboard'], { queryParams: { upgrade: min } });
  };
}