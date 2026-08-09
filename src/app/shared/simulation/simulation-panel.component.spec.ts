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
  budget: 85_000, aov: 30, durationWeeks: 4, reachableCount: 1,
  bench: { ctrBase: 2, cpmBase: 8, cvrBase: 0.5, roasBase: 2, engBase: 4 },
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

  it('shows an excluded-no-live-data note counting creators dropped for missing live stats', () => {
    setup();
    const f = TestBed.createComponent(Host);
    f.componentInstance.creators.set([mkCreator(1), { ...mkCreator(2), ytStats: undefined }]);
    f.detectChanges();
    const note = f.nativeElement.querySelector('[data-testid="sim-excluded-note"]');
    expect(note).toBeTruthy();
    expect(note.textContent).toContain('1 creator');
  });

  it('shows no excluded note when every creator has live stats', () => {
    setup();
    const f = TestBed.createComponent(Host);
    f.componentInstance.creators.set([mkCreator(1)]);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-excluded-note"]')).toBeNull();
  });

  it('sends the default average conversion value and duration', async () => {
    const { post } = setup();
    const f = TestBed.createComponent(Host); f.detectChanges();
    f.nativeElement.querySelector('[data-testid="sim-run"]').click();
    await f.whenStable();
    expect(post.mock.calls[0][1]).toMatchObject({ aov: 30, durationWeeks: 4 });
  });

  it('sends edited average conversion value and duration', async () => {
    const { post } = setup();
    const f = TestBed.createComponent(Host); f.detectChanges();
    const aov: HTMLInputElement = f.nativeElement.querySelector('[data-testid="sim-aov"]');
    aov.value = '150'; aov.dispatchEvent(new Event('input')); f.detectChanges();
    const dur: HTMLInputElement = f.nativeElement.querySelector('[data-testid="sim-duration"]');
    dur.value = '8'; dur.dispatchEvent(new Event('input')); f.detectChanges();
    f.nativeElement.querySelector('[data-testid="sim-run"]').click();
    await f.whenStable();
    expect(post.mock.calls[0][1]).toMatchObject({ aov: 150, durationWeeks: 8 });
  });

  it('labels the duration slider with its current value', () => {
    setup();
    const f = TestBed.createComponent(Host); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-duration-label"]').textContent).toContain('4 weeks');
  });

  it('warns when the budget could not cover every selected creator', async () => {
    const { post } = setup();
    post.mockResolvedValue({ ...RESULT, reachableCount: 1 });
    const f = TestBed.createComponent(Host);
    f.componentInstance.creators.set([mkCreator(1), mkCreator(2), mkCreator(3)]);
    f.detectChanges();
    f.nativeElement.querySelector('[data-testid="sim-run"]').click();
    await f.whenStable(); f.detectChanges();
    const warn = f.nativeElement.querySelector('[data-testid="sim-budget-warning"]');
    expect(warn).toBeTruthy();
    expect(warn.textContent).toContain('2');   // 3 selected − 1 affordable
  });

  it('shows no budget warning when every creator is affordable', async () => {
    const { post } = setup();
    post.mockResolvedValue({ ...RESULT, reachableCount: 1 });
    const f = TestBed.createComponent(Host); f.detectChanges();
    f.nativeElement.querySelector('[data-testid="sim-run"]').click();
    await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-budget-warning"]')).toBeFalsy();
  });

  it('nets out both no-live-data exclusions and unaffordable creators in the warning count', async () => {
    // 3 selected: creator 3 has no live stats (never reaches the edge fn), leaving
    // 2 eligible; the edge fn can only afford 1 of those – 1 should read as
    // unaffordable, not 2 (which is what a roster-length-only subtraction would give).
    const { post } = setup();
    post.mockResolvedValue({ ...RESULT, reachableCount: 1 });
    const f = TestBed.createComponent(Host);
    f.componentInstance.creators.set([mkCreator(1), mkCreator(2), { ...mkCreator(3), ytStats: undefined }]);
    f.detectChanges();
    f.nativeElement.querySelector('[data-testid="sim-run"]').click();
    await f.whenStable(); f.detectChanges();
    const warn = f.nativeElement.querySelector('[data-testid="sim-budget-warning"]');
    expect(warn).toBeTruthy();
    expect(warn.textContent).toContain('Budget covers 1 of 2');
    expect(warn.textContent).toContain('1 were left out');
  });

  it('keeps describing the roster that was actually run when creators() changes afterward', async () => {
    // Run against 3 creators (reachableCount: 1 -> 2 unaffordable). Then edit the
    // roster to 5 creators WITHOUT re-running. The warning must still describe the
    // forecast that was actually run ("of 3" / "2 left out"), not silently
    // recompute against the new, never-simulated roster ("of 5" / "4 left out").
    const { post } = setup();
    post.mockResolvedValue({ ...RESULT, reachableCount: 1 });
    const f = TestBed.createComponent(Host);
    f.componentInstance.creators.set([mkCreator(1), mkCreator(2), mkCreator(3)]);
    f.detectChanges();
    f.nativeElement.querySelector('[data-testid="sim-run"]').click();
    await f.whenStable(); f.detectChanges();

    let warn = f.nativeElement.querySelector('[data-testid="sim-budget-warning"]');
    expect(warn.textContent).toContain('Budget covers 1 of 3');
    expect(warn.textContent).toContain('2 were left out');

    // Roster changes after the run – no re-run.
    f.componentInstance.creators.set([
      mkCreator(1), mkCreator(2), mkCreator(3), mkCreator(4), mkCreator(5),
    ]);
    f.detectChanges();

    warn = f.nativeElement.querySelector('[data-testid="sim-budget-warning"]');
    expect(warn).toBeTruthy();
    expect(warn.textContent).toContain('Budget covers 1 of 3');
    expect(warn.textContent).toContain('2 were left out');
    expect(warn.textContent).not.toContain('of 5');
    expect(post).toHaveBeenCalledOnce();
  });
});
