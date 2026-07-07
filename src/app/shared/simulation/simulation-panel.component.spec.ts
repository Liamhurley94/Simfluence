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
    cpi: 80, gfi: 75, color: '#fff', verifiedDeals: 0, sponsorHistory: [], bio: '',
    ytStats: { subscriberCount: 100_000, avgViews: 20_000, engagementRate: 3, sponsorFreqPct: 5, statsRefreshedAt: null } };
}
const RESULT: SimResult = { impressions: 100, ctr: 2, cpM: 6, cvr: 0.5, conversions: 1, roas: 0.1,
  roasP10: 0.07, roasP50: 0.1, roasP90: 0.15, roasRange: '0.1–0.4×', engRate: 3, clicks: 2,
  budget: 85_000, reachableCount: 1, bench: { ctrBase: 2, cpmBase: 8, cvrBase: 0.5, roasBase: 2, engBase: 4 },
  p10: { impressions: 68, ctr: 1.3, roas: 0.07 }, p50: { impressions: 100, ctr: 2, roas: 0.1 },
  p90: { impressions: 142, ctr: 2.8, roas: 0.15 } };

@Component({
  standalone: true, imports: [SimulationPanelComponent],
  template: `<app-simulation-panel [creators]="creators()" [initialGenre]="'Gaming & Esports'"
    [genres]="['Gaming & Esports']" [initialObjectives]="initialObjectives()"
    [readonly]="readonly()" [autoRun]="autoRun()"
    [perCreatorFormat]="perCreatorFormat()" [creatorFormats]="creatorFormats()"
    (simulated)="last.set($event)" />`,
})
class Host { creators = signal<Creator[]>([mkCreator(1)]); readonly = signal(false); autoRun = signal(false);
  initialObjectives = signal<string[]>([]); last = signal<SimResult | null>(null);
  perCreatorFormat = signal(false); creatorFormats = signal<Record<number, string>>({}); }

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

  it('seeds selectedObjectives from initialObjectives (chips render selected)', () => {
    setup();
    const f = TestBed.createComponent(Host);
    f.componentInstance.initialObjectives.set(['Awareness', 'Engagement']);
    f.detectChanges();
    const awareness: HTMLButtonElement = f.nativeElement.querySelector('[data-testid="sim-obj-awareness"]');
    const sales: HTMLButtonElement = f.nativeElement.querySelector('[data-testid="sim-obj-sales"]');
    const engagement: HTMLButtonElement = f.nativeElement.querySelector('[data-testid="sim-obj-engagement"]');
    expect(awareness.style.background).toContain('color-sf-blue');
    expect(engagement.style.background).toContain('color-sf-blue');
    expect(sales.style.background).not.toContain('color-sf-blue');
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

  it('shows the global Format dropdown by default (perCreatorFormat false)', () => {
    setup();
    const f = TestBed.createComponent(Host); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-format"]')).toBeTruthy();
  });

  it('hides the global Format dropdown when perCreatorFormat is true', () => {
    setup();
    const f = TestBed.createComponent(Host);
    f.componentInstance.perCreatorFormat.set(true);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-format"]')).toBeNull();
  });

  it('per-creator mode: payload carries each creator\'s format from creatorFormats, top-level stays Integrated', async () => {
    const { post } = setup();
    const f = TestBed.createComponent(Host);
    f.componentInstance.creators.set([mkCreator(1), mkCreator(2)]);
    f.componentInstance.perCreatorFormat.set(true);
    f.componentInstance.creatorFormats.set({ 1: 'Dedicated' }); // 2 has none
    f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="sim-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();

    const body = post.mock.calls[0][1] as { creators: Array<Record<string, unknown>>; format: string };
    const c1 = body.creators.find((e) => e['id'] === '1')!;
    const c2 = body.creators.find((e) => e['id'] === '2')!;
    expect(c1['format']).toBe('Dedicated');
    expect(c2['format']).toBeUndefined();
    // Top-level fallback stays the default in per-creator mode.
    expect(body.format).toBe('Integrated');
  });

  it('standalone mode: no per-creator formats sent even if creatorFormats is set', async () => {
    const { post } = setup();
    const f = TestBed.createComponent(Host);
    // perCreatorFormat stays false; creatorFormats provided but must be ignored.
    f.componentInstance.creatorFormats.set({ 1: 'Dedicated' });
    f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="sim-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();

    const body = post.mock.calls[0][1] as { creators: Array<Record<string, unknown>> };
    expect(body.creators[0]['format']).toBeUndefined();
  });
});
