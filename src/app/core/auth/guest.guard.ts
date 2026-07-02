import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

// Inverse of authGuard: keeps already-authenticated users OFF the public auth
// screen (/login). Without it, an authed user who opens /login sees the sign-in
// form paint for one frame before AuthShellComponent's redirect effect bounces
// them to the app — the "form flashes then vanishes" flicker. Resolving the
// redirect in the guard (pre-render) means the form never mounts.
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return true;
  return router.createUrlTree(['/app/dashboard']);
};
