import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

function runGuard(isAuthed: boolean, url: string): boolean | UrlTree {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AuthService,
        useValue: { isAuthenticated: () => isAuthed, tier: () => 'free' },
      },
      { provide: Router, useValue: { createUrlTree: (cmds: unknown[], extras?: unknown) => ({ cmds, extras }) } },
    ],
  });

  const route = {} as ActivatedRouteSnapshot;
  const state = { url } as RouterStateSnapshot;

  let result!: boolean | UrlTree;
  TestBed.runInInjectionContext(() => {
    result = authGuard(route, state) as boolean | UrlTree;
  });
  return result;
}

describe('authGuard', () => {
  beforeEach(() => {
    // noop
  });

  it('allows navigation when user is authenticated', () => {
    expect(runGuard(true, '/app/dashboard')).toBe(true);
  });

  it('redirects to /login with returnTo when unauthenticated', () => {
    const tree = runGuard(false, '/app/discovery') as unknown as {
      cmds: unknown[];
      extras: { queryParams: Record<string, string> };
    };
    expect(tree.cmds).toEqual(['/login']);
    expect(tree.extras.queryParams['returnTo']).toBe('/app/discovery');
  });
});