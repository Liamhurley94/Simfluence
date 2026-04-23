import { TestBed } from '@angular/core/testing';
import { HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { of } from 'rxjs';

import { authInterceptor } from './auth.interceptor';
import { SupabaseService } from '../supabase/supabase.service';
import { environment } from '../../../environments/environment';

function interceptWith(
  req: HttpRequest<unknown>,
  supabaseStub: Partial<SupabaseService>,
): HttpRequest<unknown> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: SupabaseService, useValue: supabaseStub }],
  });

  let captured!: HttpRequest<unknown>;
  const next: HttpHandlerFn = (r) => {
    captured = r;
    return of(new HttpResponse({ status: 200 }));
  };

  TestBed.runInInjectionContext(() => {
    authInterceptor(req, next).subscribe();
  });

  return captured;
}

describe('authInterceptor', () => {
  it('attaches apikey + anon bearer to Supabase-origin requests when no session', () => {
    const req = new HttpRequest('GET', `${environment.supabaseUrl}/rest/v1/profiles`);
    const out = interceptWith(req, { accessToken: null });
    expect(out.headers.get('apikey')).toBe(environment.supabaseAnonKey);
    expect(out.headers.get('Authorization')).toBe(`Bearer ${environment.supabaseAnonKey}`);
  });

  it('attaches user access token when a session exists', () => {
    const req = new HttpRequest(
      'POST',
      `${environment.supabaseUrl}/functions/v1/run-simulation`,
      {},
    );
    const out = interceptWith(req, { accessToken: 'user-jwt-xyz' });
    expect(out.headers.get('Authorization')).toBe('Bearer user-jwt-xyz');
    expect(out.headers.get('apikey')).toBe(environment.supabaseAnonKey);
  });

  it('does not touch external URLs', () => {
    const req = new HttpRequest('GET', 'https://example.com/foo');
    const out = interceptWith(req, { accessToken: 'user-jwt-xyz' });
    expect(out.headers.get('apikey')).toBeNull();
    expect(out.headers.get('Authorization')).toBeNull();
  });
});