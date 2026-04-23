import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';

import { AuthShellComponent } from './auth-shell.component';
import { AuthService } from '../../core/auth/auth.service';

function createAuthStub(isAuthed = false) {
  const authed = signal(isAuthed);
  return {
    signIn: vi.fn(),
    signUp: vi.fn(),
    recover: vi.fn(),
    signOut: vi.fn(),
    user: () => null,
    tier: () => 'free',
    client: () => null,
    isAuthenticated: authed,
    _authed: authed,
  };
}

describe('AuthShellComponent', () => {
  let authStub: ReturnType<typeof createAuthStub>;
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authStub = createAuthStub();
    router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AuthShellComponent],
      providers: [
        { provide: AuthService, useValue: authStub as unknown as AuthService },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('defaults to the signin tab', () => {
    const fixture = TestBed.createComponent(AuthShellComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.tab()).toBe('signin');
    const signinTab = fixture.nativeElement.querySelector('[data-testid="tab-signin"]');
    expect(signinTab).toBeTruthy();
  });

  it('switches to signup when the signup tab is clicked', () => {
    const fixture = TestBed.createComponent(AuthShellComponent);
    fixture.detectChanges();
    const signupTab: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="tab-signup"]',
    );
    signupTab.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.tab()).toBe('signup');
  });

  it('redirects to /app/dashboard when user is already authenticated', () => {
    authStub._authed.set(true);
    const fixture = TestBed.createComponent(AuthShellComponent);
    fixture.detectChanges();
    TestBed.flushEffects();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/dashboard');
  });

  it('navigates after onAuthed() is called', () => {
    const fixture = TestBed.createComponent(AuthShellComponent);
    fixture.detectChanges();
    fixture.componentInstance.onAuthed();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/dashboard');
  });
});