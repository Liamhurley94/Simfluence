import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

// Same hard-reload race as tierGuard: is_admin arrives with the profile row,
// so wait for auth.ready() before deciding.
export const adminGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready();
  if (auth.isAdmin()) return true;
  return router.createUrlTree(['/app/dashboard']);
};
