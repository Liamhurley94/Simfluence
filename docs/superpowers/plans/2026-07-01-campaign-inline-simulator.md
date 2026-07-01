# Campaign Inline Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the campaign→simulator empty-selection bug by making a campaign's Forecast section its own inline simulator (scoped to the campaign's creators, explicit Save), via a shared `SimulationPanelComponent`; freeze the forecast once the campaign is `active`.

**Architecture:** Extract the simulator's UI guts (controls + run + rate-limit + P10/P50/P90 bands) into a reusable, presentational-ish `SimulationPanelComponent` that takes a resolved `Creator[]` + starting params and emits each `SimResult`. The standalone `/app/simulator` becomes a thin host over it (creators from `SelectionService`). A new `CampaignSimulatorComponent` hosts the same panel scoped to the campaign's creators and saves results to `campaign.forecast`. Build standalone-first so the working simulator never breaks.

**Tech Stack:** Angular 21 standalone components + signals (`input`/`output`/`linkedSignal`/`computed`), Vitest + `@angular/build:unit-test`, Tailwind + CSS theme tokens.

## Global Constraints

- Standalone components, signal inputs/outputs; no NgModules. (verbatim codebase pattern)
- **Preserve all existing `data-testid`s** when lifting the simulator template (`sim-controls`, `sim-objectives`, `sim-obj-*`, `sim-rate-limit`, `sim-rate-usage`, `sim-run`, `sim-bands`, `sim-p10/p50/p90`, `sim-metrics`, `sim-roas-range`). The standalone simulator spec asserts on them.
- Sim math is server-only (`RunSimulationService.run()` → edge fn); never re-implement it client-side.
- Colors via theme tokens (`var(--color-…)`); no hardcoded hex.
- Tests: Vitest via `npx ng test --watch=false --include='<glob>'`. Green build via `npx ng build`.
- No new dependencies.

---

## File Structure

- **Create** `src/app/shared/simulation/simulation-panel.component.ts` — reusable simulator UI (controls + run + rate-limit + bands). Owns run/rate-limit; emits `SimResult`.
- **Create** `src/app/shared/simulation/simulation-panel.component.spec.ts` — panel unit tests.
- **Modify** `src/app/features/simulator/simulator.component.ts` — becomes a thin host: resolve creators from `SelectionService`, render the panel, keep empty-state + "Save to campaigns" (create-new).
- **Modify** `src/app/features/simulator/simulator.component.spec.ts` — keep green against the new structure.
- **Create** `src/app/features/campaigns/sections/campaign-simulator.component.ts` — campaign-scoped host: creators from `CampaignCreatorsService`, seeds budget/genre, "Save forecast", forecast lock.
- **Create** `src/app/features/campaigns/sections/campaign-simulator.component.spec.ts`.
- **Modify** `src/app/features/campaigns/campaign-detail.component.ts` — swap `SectionForecastComponent` → `CampaignSimulatorComponent`.
- **Delete** `src/app/features/campaigns/sections/section-forecast.component.ts` — replaced.
- **Modify** `src/app/features/simulator/simulator.component.ts` (Task 4) — remove now-dead `?campaign=` attach path.

---

### Task 1: `SimulationPanelComponent` (new, shared)

**Files:**
- Create: `src/app/shared/simulation/simulation-panel.component.ts`
- Test: `src/app/shared/simulation/simulation-panel.component.spec.ts`

**Interfaces:**
- Consumes: `RunSimulationService.run(inputs: SimInputs): Promise<SimResult|null>` + `.pending` signal; `RateLimitService.check(tier): {used,limit,remaining,blocked}` + `.increment()`; `AuthService.tier()`; types `SimInputs`, `SimResult`, `Format`, `Objective`, `OBJECTIVES`, `Creator`.
- Produces (later tasks rely on these exact names):
  - selector `app-simulation-panel`
  - `creators = input.required<Creator[]>()`
  - `initialBudget = input<number>(85_000)`
  - `initialGenre = input<string>('')`
  - `genres = input<string[]>([])`
  - `subMode = input<string | undefined>(undefined)`
  - `readonly = input<boolean>(false)`
  - `simulated = output<SimResult>()`  ← emitted on each successful run

- [ ] **Step 1: Write the failing test**

```ts
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
    [genres]="['Gaming & Esports']" [readonly]="readonly()" (simulated)="last.set($event)" />`,
})
class Host { creators = signal<Creator[]>([mkCreator(1)]); readonly = signal(false); last = signal<SimResult | null>(null); }

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

  it('readonly hides the controls/run', () => {
    setup();
    const f = TestBed.createComponent(Host);
    f.componentInstance.readonly.set(true); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-controls"]')).toBeNull();
    expect(f.nativeElement.querySelector('[data-testid="sim-run"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ../Simfluence && npx ng test --watch=false --include='src/app/shared/simulation/**/*.spec.ts'`
Expected: FAIL — cannot resolve `./simulation-panel.component`.

- [ ] **Step 3: Write the panel component**

Create `simulation-panel.component.ts`. The **template** is lifted from `features/simulator/simulator.component.ts` lines **62–337** (the `@else {` interactive block: controls grid, objectives, rate-limit banner, actions, and the `@if (result())` bands + metrics), wrapped so the whole interactive area is gated on `!readonly()`. Apply exactly these binding changes during the lift:
- Wrap the controls+objectives+rate-limit+run in `@if (!readonly()) { … }` (bands `@if (result())` stay outside so a saved result can show read-only if ever needed).
- Genre `<select>`: bind `[ngModel]="genre()"` / `(ngModelChange)="genre.set($event)"` (was `context.genre()` / `context.setGenre`).
- Remove the **"Save to campaigns"** button (`sim-save`) and the "Last run:" span — the host owns save now. Keep the run button (`sim-run`).
- Remove the `sf-appear` wrapper + the `<h1>Simulator</h1>` header + the selection-count line + the empty-state block + the `creatorsLoading` spinner — the **host** owns those.

Class:

```ts
import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';
import { AuthService } from '../../core/auth/auth.service';
import { RunSimulationService } from '../../core/simulation/run-simulation.service';
import { RateLimitService } from '../../core/simulation/rate-limit.service';
import { Format, OBJECTIVES, Objective, SimResult } from '../../core/simulation/simulation.types';
import { Creator } from '../../core/data/creator.types';

const FORMATS: Format[] = ['Integrated', 'Mixed', 'Dedicated'];

@Component({
  selector: 'app-simulation-panel',
  standalone: true,
  imports: [DecimalPipe, FormsModule, IconComponent],
  template: `<!-- lifted from simulator.component.ts:62-337 per Step 3 notes -->`,
})
export class SimulationPanelComponent {
  private runSim = inject(RunSimulationService);
  private rateLimitSvc = inject(RateLimitService);
  private auth = inject(AuthService);

  readonly creators = input.required<Creator[]>();
  readonly initialBudget = input<number>(85_000);
  readonly initialGenre = input<string>('');
  readonly genres = input<string[]>([]);
  readonly subMode = input<string | undefined>(undefined);
  readonly readonly = input<boolean>(false);
  readonly simulated = output<SimResult>();

  protected readonly objectives = OBJECTIVES;
  protected readonly formats = FORMATS;

  protected readonly budget = linkedSignal(() => this.initialBudget());
  protected readonly genre = linkedSignal(() => this.initialGenre());
  protected readonly format = signal<Format>('Integrated');
  protected readonly selectedObjectives = signal<Objective[]>([]);
  protected readonly result = signal<SimResult | null>(null);

  protected readonly pending = this.runSim.pending;
  protected readonly limit = computed(() => this.rateLimitSvc.check(this.auth.tier()));
  protected readonly isUnlimited = computed(() => !Number.isFinite(this.limit().limit));
  protected readonly runDisabled = computed(
    () => this.readonly() || this.limit().blocked || this.pending() || this.creators().length === 0,
  );

  async run(): Promise<void> {
    if (this.runDisabled()) return;
    this.rateLimitSvc.increment();
    const r = await this.runSim.run({
      creators: this.creators(),
      budget: this.budget(),
      format: this.format(),
      genre: this.genre(),
      objectives: this.selectedObjectives(),
      subMode: this.subMode(),
    });
    if (r) { this.result.set(r); this.simulated.emit(r); }
  }

  toggleObjective(o: Objective): void {
    this.selectedObjectives.update((l) => (l.includes(o) ? l.filter((x) => x !== o) : [...l, o]));
  }
  slug(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --watch=false --include='src/app/shared/simulation/**/*.spec.ts'`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/simulation/simulation-panel.component.ts src/app/shared/simulation/simulation-panel.component.spec.ts
git commit -m "feat(sim): extract reusable SimulationPanelComponent"
```

---

### Task 2: Standalone simulator → thin host over the panel

**Files:**
- Modify: `src/app/features/simulator/simulator.component.ts`
- Modify: `src/app/features/simulator/simulator.component.spec.ts`

**Interfaces:**
- Consumes: `SimulationPanelComponent` (Task 1). Keeps `SelectionService`, `CreatorsService.byIds`, `CampaignsService`, `CampaignCreatorsService`, `CampaignContextService`.

- [ ] **Step 1: Update the simulator to compose the panel**

Replace the interactive `@else { … }` block (template lines 62–337) with:

```html
} @else {
  <app-simulation-panel
    [creators]="creators()"
    [initialGenre]="context.genre()"
    [genres]="genres()"
    [subMode]="context.subMode() || undefined"
    (simulated)="onSimulated($event)"
  />
  <div class="flex items-center gap-2 mt-4" data-testid="sim-actions">
    <button type="button" (click)="saveToCampaigns()" [disabled]="!result()"
      class="sf-btn text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
      style="background: var(--color-sf-green); color: var(--color-bg);" data-testid="sim-save">
      Save to campaigns
    </button>
  </div>
}
```

Class changes:
- Add `import { SimulationPanelComponent } from '../../shared/simulation/simulation-panel.component';` and add it to `imports`. Remove `FormsModule`, `RateLimitService`, `OBJECTIVES/Objective/Format` imports if now unused (keep `SimResult`).
- Keep the `creatorsRes` resource + `creators`/`creatorsLoading` (host owns them).
- Add `protected readonly result = signal<SimResult | null>(null);` and `onSimulated(r: SimResult) { this.result.set(r); }`.
- Delete the moved members: `budget`, `format`, `selectedObjectives`, `limit`, `isUnlimited`, `runDisabled`, `run()`, `toggleObjective()`, `slug()`, `objectives`, `formats`, and the `RateLimitService`/`RunSimulationService`/`pending` bits used only by the moved template. (`saveToCampaigns()` stays; it reads `this.result()` + `this.creators()`.)

- [ ] **Step 2: Update the spec to the new structure**

In `simulator.component.spec.ts`, the run test now clicks the button rendered by the panel — the testids still resolve via `querySelector` on the host element (child-component DOM is in the host tree), so keep the assertions. Only change: after the run, assert the **save** button enables:

```ts
// append to the 'clicking run …' test, after bands asserts:
const save: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="sim-save"]');
expect(save.disabled).toBe(false);
```

The genre-write-back is gone (panel owns genre); no existing test asserts it, so no change needed there.

- [ ] **Step 3: Run tests**

Run: `npx ng test --watch=false --include='src/app/features/simulator/**/*.spec.ts' --include='src/app/shared/simulation/**/*.spec.ts'`
Expected: PASS (all simulator + panel tests).

- [ ] **Step 4: Commit**

```bash
git add src/app/features/simulator/simulator.component.ts src/app/features/simulator/simulator.component.spec.ts
git commit -m "refactor(sim): standalone simulator hosts SimulationPanelComponent"
```

---

### Task 3: Campaign inline simulator + forecast lock

**Files:**
- Create: `src/app/features/campaigns/sections/campaign-simulator.component.ts`
- Test: `src/app/features/campaigns/sections/campaign-simulator.component.spec.ts`
- Modify: `src/app/features/campaigns/campaign-detail.component.ts`
- Delete: `src/app/features/campaigns/sections/section-forecast.component.ts`

**Interfaces:**
- Consumes: `SimulationPanelComponent`; `CampaignCreatorsService.records()` (each has `creatorId: number`); `CreatorsService.byIds(ids): Promise<Creator[]>` + `.genres` signal; `CampaignsService.update(id, { forecast })`; types `Campaign`, `CampaignForecast`, `SimResult`.
- Produces: selector `app-campaign-simulator`, input `campaign = input.required<Campaign>()`.

- [ ] **Step 1: Write the failing test**

```ts
// campaign-simulator.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignSimulatorComponent } from './campaign-simulator.component';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import { CreatorsService } from '../../../core/creators/creators.service';
import { CampaignsService } from '../../../core/campaigns/campaigns.service';
import { AuthService } from '../../../core/auth/auth.service';
import { EdgeClient } from '../../../core/api/edge.client';
import { Campaign } from '../../../core/campaigns/campaign.types';
import { Creator } from '../../../core/data/creator.types';

function mkCreator(id: number): Creator {
  return { id, name: `C${id}`, handle: `@c${id}`, platform: 'YouTube', allPlatforms: ['YouTube'],
    subs: '100K', subsParsed: 100_000, avgViews: '20K', eng: '3.0%', genre: 'Gaming & Esports',
    cpi: 80, gfi: 75, color: '#fff', verifiedDeals: 0, sponsorHistory: [], bio: '' };
}
function mkCampaign(status: Campaign['status'] = 'planning'): Campaign {
  return { id: 'c1', createdBy: 'u', enterpriseId: null, status, name: 'Acme', client: null,
    genre: 'Gaming & Esports', budget: 50_000, notes: null, objectives: [], forecast: null,
    startedAt: null, completedAt: null, createdAt: '', updatedAt: '' };
}
const RESULT = { impressions: 100, ctr: 2, cpM: 6, cvr: 0.5, conversions: 1, roas: 0.1, roasP10: 0.07,
  roasP50: 0.1, roasP90: 0.15, roasRange: '0.1–0.4×', engRate: 3, clicks: 2, budget: 50_000, reachableCount: 1,
  bench: { ctrBase: 2, cpmBase: 8, cvrBase: 0.5, roasBase: 2, engBase: 4 },
  p10: { impressions: 68, ctr: 1.3, roas: 0.07 }, p50: { impressions: 100, ctr: 2, roas: 0.1 },
  p90: { impressions: 142, ctr: 2.8, roas: 0.15 } };

function setup(status: Campaign['status'] = 'planning') {
  localStorage.clear();
  const update = vi.fn().mockResolvedValue(mkCampaign(status));
  const records = signal([{ id: 'cc1', campaignId: 'c1', creatorId: 7, status: 'shortlisted' }]);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CampaignSimulatorComponent],
    providers: [
      { provide: CampaignCreatorsService, useValue: { records } },
      { provide: CreatorsService, useValue: { byIds: vi.fn(async (ids: number[]) => ids.map(mkCreator)), genres: signal(['Gaming & Esports']) } },
      { provide: CampaignsService, useValue: { update } },
      { provide: AuthService, useValue: { tier: signal('silver') } },
      { provide: EdgeClient, useValue: { post: vi.fn().mockResolvedValue(RESULT), get: vi.fn() } },
    ],
  });
  return { update };
}

describe('CampaignSimulatorComponent', () => {
  it('planning: runs the campaign creators and Save writes the forecast', async () => {
    const { update } = setup('planning');
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', mkCampaign('planning'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="sim-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="campaign-forecast-save"]') as HTMLButtonElement).click();
    await f.whenStable();
    expect(update).toHaveBeenCalledWith('c1', expect.objectContaining({ forecast: expect.objectContaining({ impressions: 100 }) }));
  });

  it('active: forecast is locked — no run/save controls', async () => {
    setup('active');
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', mkCampaign('active'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-run"]')).toBeNull();
    expect(f.nativeElement.querySelector('[data-testid="campaign-forecast-save"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --watch=false --include='src/app/features/campaigns/sections/campaign-simulator.component.spec.ts'`
Expected: FAIL — cannot resolve `./campaign-simulator.component`.

- [ ] **Step 3: Write `CampaignSimulatorComponent`**

```ts
import { Component, computed, inject, input, resource } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SimulationPanelComponent } from '../../../shared/simulation/simulation-panel.component';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import { CreatorsService } from '../../../core/creators/creators.service';
import { CampaignsService } from '../../../core/campaigns/campaigns.service';
import { Campaign, CampaignForecast } from '../../../core/campaigns/campaign.types';
import { Creator } from '../../../core/data/creator.types';
import { SimResult } from '../../../core/simulation/simulation.types';
import { signal } from '@angular/core';

@Component({
  selector: 'app-campaign-simulator',
  standalone: true,
  imports: [DecimalPipe, SimulationPanelComponent],
  template: `
    <section class="sf-panel p-5" data-testid="section-forecast">
      <h2 class="text-xs uppercase tracking-wider font-bold mb-4" style="color: var(--color-text-muted);">Forecast</h2>

      @if (campaign().forecast; as fc) {
        <div class="grid grid-cols-3 gap-4 text-center mb-4" data-testid="campaign-forecast-summary">
          <div><div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">P50 Impressions</div>
            <div class="text-lg font-bold" style="color: var(--color-text);">{{ fc.p50.impressions | number: '1.0-0' }}</div></div>
          <div><div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">CTR</div>
            <div class="text-lg font-bold" style="color: var(--color-text);">{{ fc.p50.ctr }}%</div></div>
          <div><div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">ROAS</div>
            <div class="text-lg font-bold" style="color: var(--color-sf-gold);">{{ fc.p50.roas }}×</div></div>
        </div>
      }

      @if (forecastLocked()) {
        @if (!campaign().forecast) {
          <p class="text-xs" style="color: var(--color-text-muted);">No forecast was saved before this campaign started.</p>
        }
      } @else if (creators().length === 0) {
        <p class="text-xs" style="color: var(--color-text-muted);">Add creators to this campaign to run a forecast.</p>
      } @else {
        <app-simulation-panel
          [creators]="creators()"
          [initialBudget]="campaign().budget ?? 85000"
          [initialGenre]="campaign().genre ?? ''"
          [genres]="genres()"
          (simulated)="result.set($event)"
        />
        <div class="mt-4">
          <button type="button" (click)="saveForecast()" [disabled]="!result() || saving()"
            class="sf-btn text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            style="background: var(--color-sf-green); color: var(--color-bg);" data-testid="campaign-forecast-save">
            {{ saving() ? 'Saving…' : 'Save forecast' }}
          </button>
        </div>
      }
    </section>
  `,
})
export class CampaignSimulatorComponent {
  private campaignCreators = inject(CampaignCreatorsService);
  private creatorsSvc = inject(CreatorsService);
  private campaignsSvc = inject(CampaignsService);

  readonly campaign = input.required<Campaign>();
  protected readonly genres = this.creatorsSvc.genres;
  protected readonly result = signal<SimResult | null>(null);
  protected readonly saving = signal(false);

  protected readonly forecastLocked = computed(() => this.campaign().status !== 'planning');

  private readonly creatorsRes = resource<Creator[], number[]>({
    params: () => this.campaignCreators.records().map((cc) => cc.creatorId),
    loader: ({ params }) => (params.length ? this.creatorsSvc.byIds(params) : Promise.resolve([])),
    defaultValue: [],
  });
  protected readonly creators = computed(() => this.creatorsRes.value());

  async saveForecast(): Promise<void> {
    const r = this.result();
    if (!r || this.forecastLocked()) return;
    this.saving.set(true);
    const forecast: CampaignForecast = { impressions: r.impressions, ctr: r.ctr, roas: r.roas, cvr: r.cvr, p10: r.p10, p50: r.p50, p90: r.p90 };
    await this.campaignsSvc.update(this.campaign().id, { forecast });
    this.saving.set(false);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --watch=false --include='src/app/features/campaigns/sections/campaign-simulator.component.spec.ts'`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into campaign-detail + delete the old section**

In `campaign-detail.component.ts`: replace the `SectionForecastComponent` import (line 20) with `import { CampaignSimulatorComponent } from './sections/campaign-simulator.component';`, swap it in the `imports` array, and change the `@if (showForecast())` block to:

```html
@if (showForecast()) {
  <app-campaign-simulator [campaign]="c" />
}
```

Then delete `src/app/features/campaigns/sections/section-forecast.component.ts`.

- [ ] **Step 6: Run the campaign detail + build**

Run: `npx ng test --watch=false --include='src/app/features/campaigns/**/*.spec.ts' && npx ng build`
Expected: PASS + build succeeds (no dangling `SectionForecastComponent` reference).

- [ ] **Step 7: Commit**

```bash
git add src/app/features/campaigns/sections/campaign-simulator.component.ts src/app/features/campaigns/sections/campaign-simulator.component.spec.ts src/app/features/campaigns/campaign-detail.component.ts
git rm src/app/features/campaigns/sections/section-forecast.component.ts
git commit -m "feat(campaigns): inline campaign simulator + forecast lock-on-active"
```

---

### Task 4: Remove the now-dead `?campaign=` attach path

**Files:**
- Modify: `src/app/features/simulator/simulator.component.ts`

**Interfaces:**
- Consumes: nothing new. Nothing links to `/app/simulator?campaign=` after Task 3.

- [ ] **Step 1: Delete dead members**

In `simulator.component.ts`: remove `attachedCampaignId` (the `route.snapshot.queryParamMap.get('campaign')` line) and the `ActivatedRoute` injection + import if now unused. In `saveToCampaigns()`, delete the **Path A** `if (this.attachedCampaignId) { … return; }` block (attach-to-existing) — keep the **Path B** create-new-campaign block. `CampaignsService` + `CampaignCreatorsService` stay (Path B uses them).

- [ ] **Step 2: Verify build + full simulator/campaign tests**

Run: `npx ng test --watch=false --include='src/app/features/simulator/**/*.spec.ts' --include='src/app/features/campaigns/**/*.spec.ts' --include='src/app/shared/simulation/**/*.spec.ts' && npx ng build`
Expected: PASS + build clean; grep confirms no `?campaign` / `attachedCampaignId` remains: `grep -rn "attachedCampaignId\|simulator.*campaign=" src/app || echo CLEAN`.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/simulator/simulator.component.ts
git commit -m "chore(sim): drop dead ?campaign= attach path (superseded by inline campaign sim)"
```

---

## Self-Review

**Spec coverage:**
- §4.1 panel → Task 1 ✓ · §4.2 standalone host → Task 2 ✓ · §4.3 campaign inline + Save + summary → Task 3 ✓ · §4.4 data flow → Task 3 (`records → byIds → panel → RunSimulationService → update`) ✓ · §5 lock (`status !== 'planning'`) → Task 3 `forecastLocked` ✓ · §6 dead code → Task 4 ✓ · §7 testing → each task's spec ✓ · Acceptance 1–4 → Task 3 tests + wiring; 5 → build steps ✓.

**Placeholder scan:** the panel template is a *reference to an exact line range to lift with an enumerated change list* (Task 1 Step 3), not a "TODO" — acceptable; every new class + test is shown in full.

**Type consistency:** `simulated = output<SimResult>()` consumed as `(simulated)` in Tasks 2 & 3 ✓; `forecastLocked`/`result`/`saveForecast` names consistent within Task 3 ✓; `CampaignForecast` fields match `campaign.types.ts` ✓; `creatorId` field matches `CampaignCreator` ✓.
