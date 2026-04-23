import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Attaches Supabase auth headers to requests hitting the Supabase origin only.
 * External URLs pass through untouched.
 *
 * Falls back to the project anon key when no user token is present — matches
 * the hybrid behavior of the edge functions (they accept either).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.supabaseUrl)) {
    return next(req);
  }

  const supabase = inject(SupabaseService);
  const token = supabase.accessToken ?? environment.supabaseAnonKey;

  return next(
    req.clone({
      setHeaders: {
        apikey: environment.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};