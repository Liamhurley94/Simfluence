import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { TopNavComponent } from './top-nav.component';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';

describe('TopNavComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.classList.remove('light');

    const authStub = {
      user: signal<{ email: string } | null>({ email: 'brandon@example.com' }),
      tier: signal('free'),
      signOut: async () => {},
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TopNavComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
      ],
    });
  });

  it('renders the short-label derived from email', () => {
    const fixture = TestBed.createComponent(TopNavComponent);
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector('[data-testid="profile-toggle"]');
    expect(toggle?.textContent).toContain('brandon');
  });

  it('theme toggle button flips the theme signal + body class', () => {
    const theme = TestBed.inject(ThemeService);
    const fixture = TestBed.createComponent(TopNavComponent);
    fixture.detectChanges();

    expect(theme.theme()).toBe('dark');
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="theme-toggle"]');
    btn.click();
    TestBed.flushEffects();
    expect(theme.theme()).toBe('light');
    expect(document.body.classList.contains('light')).toBe(true);
  });

  it('profile button toggles the dropdown visibility', () => {
    const fixture = TestBed.createComponent(TopNavComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="profile-dropdown"]')).toBeNull();

    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="profile-toggle"]');
    toggle.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="profile-dropdown"]')).toBeTruthy();

    toggle.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="profile-dropdown"]')).toBeNull();
  });
});
