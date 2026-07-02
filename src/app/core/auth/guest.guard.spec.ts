import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { guestGuard } from './guest.guard';
import { AuthService } from './auth.service';

function runGuard(isAuthed: boolean): boolean | UrlTree {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { isAuthenticated: () => isAuthed } },
      { provide: Router, useValue: { createUrlTree: (cmds: unknown[]) => ({ cmds }) } },
    ],
  });

  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/login' } as RouterStateSnapshot;

  let result!: boolean | UrlTree;
  TestBed.runInInjectionContext(() => {
    result = guestGuard(route, state) as boolean | UrlTree;
  });
  return result;
}

describe('guestGuard', () => {
  beforeEach(() => {
    // noop
  });

  it('allows navigation when the visitor is unauthenticated', () => {
    expect(runGuard(false)).toBe(true);
  });

  it('redirects already-authenticated users to /app/dashboard', () => {
    const tree = runGuard(true) as unknown as { cmds: unknown[] };
    expect(tree.cmds).toEqual(['/app/dashboard']);
  });
});
