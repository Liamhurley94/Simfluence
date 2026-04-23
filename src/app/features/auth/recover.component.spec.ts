import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RecoverComponent } from './recover.component';
import { AuthService } from '../../core/auth/auth.service';

function createAuthStub() {
  return {
    signIn: vi.fn(),
    signUp: vi.fn(),
    recover: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn(),
    user: () => null,
    tier: () => 'free',
    client: () => null,
    isAuthenticated: () => false,
  } as unknown as AuthService;
}

describe('RecoverComponent', () => {
  let authStub: AuthService;

  beforeEach(() => {
    authStub = createAuthStub();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [RecoverComponent],
      providers: [{ provide: AuthService, useValue: authStub }],
    });
  });

  it('rejects empty email', async () => {
    const fixture = TestBed.createComponent(RecoverComponent);
    const comp = fixture.componentInstance;
    await comp.onSubmit();
    expect(authStub.recover).not.toHaveBeenCalled();
    expect(comp.error()).toBe('Enter a valid email address.');
  });

  it('calls auth.recover on valid email and shows success banner', async () => {
    const fixture = TestBed.createComponent(RecoverComponent);
    const comp = fixture.componentInstance;
    comp.form.setValue({ email: 'a@b.com' });

    await comp.onSubmit();
    fixture.detectChanges();

    expect(authStub.recover).toHaveBeenCalledWith('a@b.com');
    expect(comp.sent()).toBe(true);
    const banner = fixture.nativeElement.querySelector('[data-testid="recover-success"]');
    expect(banner?.textContent).toContain('Reset email sent');
  });

  it('surfaces a generic error when recover throws', async () => {
    (authStub.recover as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    const fixture = TestBed.createComponent(RecoverComponent);
    const comp = fixture.componentInstance;
    comp.form.setValue({ email: 'a@b.com' });

    await comp.onSubmit();

    expect(comp.sent()).toBe(false);
    expect(comp.error()).toBe('Something went wrong. Try again in a moment.');
  });
});