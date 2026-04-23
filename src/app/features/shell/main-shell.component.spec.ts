import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { MainShellComponent } from './main-shell.component';
import { AuthService } from '../../core/auth/auth.service';
import { UpgradePromptService } from '../../core/upgrade/upgrade-prompt.service';

describe('MainShellComponent', () => {
  let queryParamMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    queryParamMap$ = new BehaviorSubject(convertToParamMap({}));

    const authStub = {
      user: signal<{ email: string } | null>({ email: 'brandon@example.com' }),
      tier: signal('free'),
      signOut: async () => {},
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MainShellComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMap$ } },
      ],
    });
  });

  it('renders top-nav, side-nav, and upgrade-prompt placeholder', () => {
    const fixture = TestBed.createComponent(MainShellComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-top-nav')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-side-nav')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-upgrade-prompt')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });

  it('opens the upgrade prompt when ?upgrade=silver is present on the route', () => {
    const upgrade = TestBed.inject(UpgradePromptService);
    queryParamMap$.next(convertToParamMap({ upgrade: 'silver' }));

    const fixture = TestBed.createComponent(MainShellComponent);
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(upgrade.current()).toEqual({ feature: 'This feature', requiredTier: 'silver' });
  });

  it('ignores an invalid tier value in ?upgrade', () => {
    const upgrade = TestBed.inject(UpgradePromptService);
    queryParamMap$.next(convertToParamMap({ upgrade: 'bogus' }));

    const fixture = TestBed.createComponent(MainShellComponent);
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(upgrade.current()).toBeNull();
  });
});
