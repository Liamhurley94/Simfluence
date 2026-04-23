import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SimulatorComponent } from './simulator.component';
import { AuthService } from '../../core/auth/auth.service';
import { SelectionService } from '../../core/selection/selection.service';
import { EdgeClient } from '../../core/api/edge.client';
import { RateLimitService } from '../../core/simulation/rate-limit.service';

function setup({ selectedIds = [] as number[], tier = 'silver' } = {}) {
  localStorage.clear();
  sessionStorage.clear();

  const tierSignal = signal(tier);
  const authStub = {
    tier: tierSignal,
    user: () => null,
    isAuthenticated: () => true,
  };

  const post = vi.fn().mockResolvedValue({ error: 'no server in tests' });
  const edgeStub = { post, get: vi.fn() } as unknown as EdgeClient;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [SimulatorComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authStub },
      { provide: EdgeClient, useValue: edgeStub },
    ],
  });

  const selection = TestBed.inject(SelectionService);
  for (const id of selectedIds) selection.add(id);

  return { post, selection, tier: tierSignal };
}

describe('SimulatorComponent', () => {
  beforeEach(() => {
    /* noop */
  });

  it('shows empty state when no creators are selected', () => {
    setup({ selectedIds: [] });
    const fixture = TestBed.createComponent(SimulatorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-empty"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-controls"]')).toBeNull();
  });

  it('renders controls + objectives + run button when creators are selected', () => {
    setup({ selectedIds: [2, 14] });
    const fixture = TestBed.createComponent(SimulatorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-controls"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-objectives"]')).toBeTruthy();
    const runBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="sim-run"]');
    expect(runBtn).toBeTruthy();
    expect(runBtn.disabled).toBe(false);
  });

  it('clicking run computes a local result (bands render instantly) and increments rate limit', () => {
    const { post } = setup({ selectedIds: [2, 14] });
    const fixture = TestBed.createComponent(SimulatorComponent);
    fixture.detectChanges();

    const runBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="sim-run"]');
    runBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="sim-bands"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-p10"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-p50"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-p90"]')).toBeTruthy();
    expect(post).toHaveBeenCalledOnce();

    const rateLimit = TestBed.inject(RateLimitService);
    expect(rateLimit.read()).toBe(1);
  });

  it('free tier hitting limit disables the run button and shows banner', () => {
    setup({ selectedIds: [2], tier: 'free' });
    const rate = TestBed.inject(RateLimitService);
    rate.increment();
    rate.increment();
    rate.increment();

    const fixture = TestBed.createComponent(SimulatorComponent);
    fixture.detectChanges();

    const runBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="sim-run"]');
    expect(runBtn.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="sim-rate-limit"]')).toBeTruthy();
  });

  it('gold tier has no rate-limit indicator and no blocking', () => {
    setup({ selectedIds: [2], tier: 'gold' });
    const fixture = TestBed.createComponent(SimulatorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-rate-usage"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="sim-rate-limit"]')).toBeNull();
  });

  it('toggling an objective updates the selected set', () => {
    setup({ selectedIds: [2] });
    const fixture = TestBed.createComponent(SimulatorComponent);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="sim-obj-direct-sales"]',
    );
    btn.click();
    fixture.detectChanges();
    // Style flips background — inspect the attr for the blue class indicator.
    expect(btn.style.background).toContain('color-sf-blue');
  });
});
