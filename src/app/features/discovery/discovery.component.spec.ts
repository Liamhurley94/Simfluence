import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DiscoveryComponent } from './discovery.component';
import { AuthService } from '../../core/auth/auth.service';
import { SelectionService } from '../../core/selection/selection.service';

describe('DiscoveryComponent', () => {
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };
  let tier: ReturnType<typeof signal<string>>;

  beforeEach(() => {
    router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    tier = signal('free');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DiscoveryComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { tier, user: () => null, isAuthenticated: () => true },
        },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('renders the filter panel, creator grid, and pagination', () => {
    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-filter-panel')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="creator-grid"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-pagination')).toBeTruthy();
  });

  it('shows total creator count', () => {
    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
    const count = fixture.nativeElement.querySelector('[data-testid="results-count"]');
    expect(count.textContent).toMatch(/\d[\d,]* creators/);
  });

  it('selection bar appears once at least one creator is selected', () => {
    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="selection-bar"]')).toBeNull();

    const selection = TestBed.inject(SelectionService);
    selection.add(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="selection-bar"]')).toBeTruthy();
  });

  it('clear selection button empties the selection service', () => {
    const selection = TestBed.inject(SelectionService);
    selection.add(1);
    selection.add(2);

    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
    const clear: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="selection-clear"]',
    );
    clear.click();
    expect(selection.count()).toBe(0);
  });

  it('score-selected button routes to /app/scoring', () => {
    const selection = TestBed.inject(SelectionService);
    selection.add(1);

    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="selection-score"]',
    );
    btn.click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/scoring');
  });

  it('free tier shows blurred rate labels on cards', () => {
    tier.set('free');
    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
    const firstRate = fixture.nativeElement.querySelector('[data-testid="creator-rate"]');
    expect(firstRate?.classList.contains('blur-sm')).toBe(true);
  });

  it('silver+ tier shows unblurred rates', () => {
    tier.set('silver');
    const fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
    const firstRate = fixture.nativeElement.querySelector('[data-testid="creator-rate"]');
    expect(firstRate?.classList.contains('blur-sm')).toBe(false);
  });
});
