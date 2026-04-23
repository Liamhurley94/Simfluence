import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfileDropdownComponent } from './profile-dropdown.component';
import { AuthService } from '../../core/auth/auth.service';

describe('ProfileDropdownComponent', () => {
  let signOut: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    signOut = vi.fn().mockResolvedValue(undefined);
    navigate = vi.fn().mockResolvedValue(true);

    const authStub = {
      user: signal<{ email: string } | null>({ email: 'brandon@example.com' }),
      tier: signal('gold'),
      signOut,
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProfileDropdownComponent],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: Router, useValue: { navigateByUrl: navigate } },
      ],
    });
  });

  it('renders the email and tier', () => {
    const fixture = TestBed.createComponent(ProfileDropdownComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="profile-email"]').textContent).toContain(
      'brandon@example.com',
    );
    expect(fixture.nativeElement.querySelector('[data-testid="profile-tier"]').textContent).toContain(
      'Gold',
    );
  });

  it('signOut button calls auth.signOut and navigates to /login', async () => {
    const fixture = TestBed.createComponent(ProfileDropdownComponent);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="profile-signout"]');
    btn.click();
    // wait for the two awaits inside signOut
    await Promise.resolve();
    await Promise.resolve();
    expect(signOut).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
