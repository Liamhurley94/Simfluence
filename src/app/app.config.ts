import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import {
  CampaignsRepository,
  SupabaseCampaignsRepository,
} from './core/campaigns/campaigns.repository';
import { CreatorsService } from './core/creators/creators.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),

    // Populate filter dropdown values (genres/platforms/languages) at app boot.
    // List/byId/byIds queries run on-demand against PostgREST per page render.
    provideAppInitializer(() => inject(CreatorsService).loadFilterOptions()),

    { provide: CampaignsRepository, useClass: SupabaseCampaignsRepository },
  ],
};