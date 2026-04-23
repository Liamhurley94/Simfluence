import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SignupComponent } from './signup.component';
import { AuthService } from '../../core/auth/auth.service';

function createAuthStub() {
  return {
    signIn: vi.fn(),
    signUp: vi.fn().mockResolvedValue(undefined),
    recover: vi.fn(),
    signOut: vi.fn(),
    user: () => null,
    tier: () => 'free',
    client: () => null,
    isAuthenticated: () => false,
  } as unknown as AuthService;
}

describe('SignupComponent', () => {
  let authStub: AuthService;

  beforeEach(() => {
    authStub = createAuthStub();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SignupComponent],
      providers: [{ provide: AuthService, useValue: authStub }],
    });
  });

  it('rejects password shorter than 8 chars', async () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const comp = fixture.componentInstance;
    comp.form.setValue({ email: 'a@b.com', password: 'short' });

    await comp.onSubmit();

    expect(comp.error()).toBe('Please enter a valid email and password (8+ chars).');
    expect(authStub.signUp).not.toHaveBeenCalled();
  });

  it('rejects malformed email', async () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const comp = fixture.componentInstance;
    comp.form.setValue({ email: 'not-an-email', password: 'supersecret' });

    await comp.onSubmit();

    expect(comp.error()).toBe('Please enter a valid email and password (8+ chars).');
    expect(authStub.signUp).not.toHaveBeenCalled();
  });

  it('calls auth.signUp and emits signedUp on valid submit', async () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const comp = fixture.componentInstance;

    let emitted = false;
    comp.signedUp.subscribe(() => (emitted = true));

    comp.form.setValue({ email: 'new@b.com', password: 'supersecret' });
    await comp.onSubmit();

    expect(authStub.signUp).toHaveBeenCalledWith('new@b.com', 'supersecret');
    expect(emitted).toBe(true);
    expect(comp.error()).toBeNull();
  });

  it('surfaces the supabase error message when signUp throws', async () => {
    (authStub.signUp as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('User already registered'),
    );
    const fixture = TestBed.createComponent(SignupComponent);
    const comp = fixture.componentInstance;
    comp.form.setValue({ email: 'new@b.com', password: 'supersecret' });

    await comp.onSubmit();

    expect(comp.error()).toBe('User already registered');
  });
});