import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { tierGuard } from './core/auth/tier.guard';
import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/app/dashboard' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/auth-shell.component').then((m) => m.AuthShellComponent),
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
        path: 'personas',
        canActivate: [tierGuard('silver')],
        loadComponent: () =>
          import('./features/personas/personas.component').then((m) => m.PersonasComponent),
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