import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { tierGuard } from './core/auth/tier.guard';

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
        path: 'outreach',
        canActivate: [tierGuard('silver')],
        loadComponent: () =>
          import('./features/outreach/outreach.component').then((m) => m.OutreachComponent),
      },
    ],
  },
  { path: '**', redirectTo: '/app/dashboard' },
];