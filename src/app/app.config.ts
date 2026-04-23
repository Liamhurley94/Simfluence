import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import {
  CampaignsRepository,
  InMemoryCampaignsRepository,
} from './core/campaigns/campaigns.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),

    // Persistence stubs — swap for Supabase-backed implementations when the
    // backend repo provisions the tables.
    { provide: CampaignsRepository, useClass: InMemoryCampaignsRepository },
  ],
};