import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginComponent } from './login.component';
import { AuthService } from '../../core/auth/auth.service';

function createAuthStub() {
  return {
    signIn: vi.fn().mockResolvedValue(undefined),
    signUp: vi.fn(),
    recover: vi.fn(),
    signOut: vi.fn(),
    user: () => null,
    tier: () => 'free',
    client: () => null,
    isAuthenticated: () => false,
  } as unknown as AuthService;
}

describe('LoginComponent', () => {
  let authStub: AuthService;

  beforeEach(() => {
    authStub = createAuthStub();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [{ provide: AuthService, useValue: authStub }],
    });
  });

  it('shows an error and does not call signIn when form is empty', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    await fixture.componentInstance.onSubmit();
    expect(fixture.componentInstance.error()).toBe('Incorrect email or password. Try again.');
    expect(authStub.signIn).not.toHaveBeenCalled();
  });

  it('calls auth.signIn and emits signedIn on valid submit', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const comp = fixture.componentInstance;

    let emitted = false;
    comp.signedIn.subscribe(() => (emitted = true));

    comp.form.setValue({ email: 'a@b.com', password: 'secret' });
    await comp.onSubmit();

    expect(authStub.signIn).toHaveBeenCalledWith('a@b.com', 'secret');
    expect(emitted).toBe(true);
    expect(comp.error()).toBeNull();
  });

  it('sets error message when signIn throws', async () => {
    (authStub.signIn as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('bad'));
    const fixture = TestBed.createComponent(LoginComponent);
    const comp = fixture.componentInstance;
    comp.form.setValue({ email: 'a@b.com', password: 'secret' });

    await comp.onSubmit();

    expect(comp.error()).toBe('Incorrect email or password. Try again.');
    expect(comp.busy()).toBe(false);
  });

  it('emits forgot when forgot-password button clicked', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    let fired = false;
    fixture.componentInstance.forgot.subscribe(() => (fired = true));

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="login-forgot"]');
    btn.click();

    expect(fired).toBe(true);
  });
});