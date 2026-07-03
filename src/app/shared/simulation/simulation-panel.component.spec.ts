// src/app/shared/simulation/simulation-panel.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimulationPanelComponent } from './simulation-panel.component';
import { AuthService } from '../../core/auth/auth.service';
import { EdgeClient } from '../../core/api/edge.client';
import { RateLimitService } from '../../core/simulation/rate-limit.service';
import { Creator } from '../../core/data/creator.types';
import { SimResult } from '../../core/simulation/simulation.types';

function mkCreator(id: number): Creator {
  return { id, name: `C${id}`, handle: `@c${id}`, platform: 'YouTube', allPlatforms: ['YouTube'],
    subs: '100K', subsParsed: 100_000, avgViews: '20K', eng: '3.0%', genre: 'Gaming & Esports',
    cpi: 80, gfi: 75, color: '#fff', verifiedDeals: 0, sponsorHistory: [], bio: '' };
}
const RESULT: SimResult = { impressions: 100, ctr: 2, cpM: 6, cvr: 0.5, conversions: 1, roas: 0.1,
  roasP10: 0.07, roasP50: 0.1, roasP90: 0.15, roasRange: '0.1–0.4×', engRate: 3, clicks: 2,
  budget: 85_000, reachableCount: 1, bench: { ctrBase: 2, cpmBase: 8, cvrBase: 0.5, roasBase: 2, engBase: 4 },
  p10: { impressions: 68, ctr: 1.3, roas: 0.07 }, p50: { impressions: 100, ctr: 2, roas: 0.1 },
  p90: { impressions: 142, ctr: 2.8, roas: 0.15 } };

@Component({
  standalone: true, imports: [SimulationPanelComponent],
  template: `<app-simulation-panel [creators]="creators()" [initialGenre]="'Gaming & Esports'"
    [genres]="['Gaming & Esports']" [readonly]="readonly()" [autoRun]="autoRun()" (simulated)="last.set($event)" />`,
})
class Host { creators = signal<Creator[]>([mkCreator(1)]); readonly = signal(false); autoRun = signal(false); last = signal<SimResult | null>(null); }

function setup(tier = 'silver') {
  localStorage.clear();
  const post = vi.fn().mockResolvedValue(RESULT);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [Host],
    providers: [
      { provide: AuthService, useValue: { tier: signal(tier) } },
      { provide: EdgeClient, useValue: { post, get: vi.fn() } },
    ],
  });
  return { post };
}

describe('SimulationPanelComponent', () => {
  it('renders controls + run button for a non-empty creator set', () => {
    setup();
    const f = TestBed.createComponent(Host); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-controls"]')).toBeTruthy();
    const run: HTMLButtonElement = f.nativeElement.querySelector('[data-testid="sim-run"]');
    expect(run.disabled).toBe(false);
  });

  it('run() posts to the edge fn, renders bands, increments rate limit, and emits the result', async () => {
    const { post } = setup();
    const f = TestBed.createComponent(Host); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="sim-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    expect(post).toHaveBeenCalledOnce();
    expect(f.nativeElement.querySelector('[data-testid="sim-bands"]')).toBeTruthy();
    expect(TestBed.inject(RateLimitService).read()).toBe(1);
    expect(f.componentInstance.last()?.impressions).toBe(100);
  });

  it('renders exactly the 3 objective buckets', () => {
    setup();
    const f = TestBed.createComponent(Host); f.detectChanges();
    const chips = f.nativeElement.querySelectorAll('[data-testid^="sim-obj-"]');
    expect([...chips].map((c: HTMLElement) => c.textContent?.trim())).toEqual([
      'Awareness', 'Sales', 'Engagement',
    ]);
    expect(f.nativeElement.querySelector('[data-testid="sim-obj-awareness"]')).toBeTruthy();
    expect(f.nativeElement.querySelector('[data-testid="sim-obj-sales"]')).toBeTruthy();
    expect(f.nativeElement.querySelector('[data-testid="sim-obj-engagement"]')).toBeTruthy();
  });

  it('readonly hides the controls/run', () => {
    setup();
    const f = TestBed.createComponent(Host);
    f.componentInstance.readonly.set(true); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-controls"]')).toBeNull();
    expect(f.nativeElement.querySelector('[data-testid="sim-run"]')).toBeNull();
  });

  it('auto-runs once when autoRun is set and creators are present', async () => {
    const { post } = setup();
    const f = TestBed.createComponent(Host);
    f.componentInstance.autoRun.set(true);
    f.detectChanges();
    // Macrotask flush drains the whole deferred chain (queueMicrotask -> run ->
    // edge post -> result.set) before we assert the rendered bands.
    await new Promise((r) => setTimeout(r));
    f.detectChanges();
    expect(post).toHaveBeenCalledOnce();
    expect(f.nativeElement.querySelector('[data-testid="sim-bands"]')).toBeTruthy();
  });
});
