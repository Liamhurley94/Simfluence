import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/guest.guard';
import { tierGuard } from './core/auth/tier.guard';
import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  // Public marketing landing — the pre-auth face of the app. Lives at the root
  // so unauthenticated visitors see it instead of being bounced to /login.
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    // guestGuard redirects already-authenticated users to /app before the auth
    // shell mounts — prevents the sign-in form flashing then vanishing when a
    // logged-in user clicks "Log in" from the public landing.
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/auth-shell.component').then((m) => m.AuthShellComponent),
  },
  // Public pricing page — linked from the landing nav/footer, not inlined on the
  // landing (owner: "pricing should only be clicked to").
  {
    path: 'pricing',
    loadComponent: () =>
      import('./features/pricing/pricing.component').then((m) => m.PricingComponent),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/shell/main-shell.component').then((m) => m.MainShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'discovery',
        loadComponent: () =>
          import('./features/discovery/discovery.component').then((m) => m.DiscoveryComponent),
      },
      {
        path: 'scoring',
        loadComponent: () =>
          import('./features/scoring/scoring.component').then((m) => m.ScoringComponent),
      },
      {
        // Personas feature was retired (superseded by the Creator Matcher). Keep
        // the path as a redirect so any stale bookmarks/links land on Discovery.
        path: 'personas',
        redirectTo: '/app/discovery',
      },
      {
        path: 'simulator',
        loadComponent: () =>
          import('./features/simulator/simulator.component').then((m) => m.SimulatorComponent),
      },
      {
        path: 'campaigns',
        canActivate: [tierGuard('silver')],
        loadComponent: () =>
          import('./features/campaigns/campaigns.component').then((m) => m.CampaignsComponent),
      },
      {
        // Detail route inherits the same guard as the list route above.
        path: 'campaigns/:id',
        canActivate: [tierGuard('silver')],
        loadComponent: () =>
          import('./features/campaigns/campaign-detail.component').then((m) => m.CampaignDetailComponent),
      },
      {
        path: 'account',
        loadComponent: () =>
          import('./features/account/account.component').then((m) => m.AccountComponent),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin/admin.component').then((m) => m.AdminComponent),
        children: [
          {
            path: ':id',
            loadComponent: () =>
              import('./features/admin/enterprise-detail.component').then((m) => m.EnterpriseDetailComponent),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '/app/dashboard' },
];