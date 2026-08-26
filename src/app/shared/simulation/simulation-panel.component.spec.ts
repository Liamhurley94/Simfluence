// src/app/shared/simulation/simulation-panel.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { SimulationPanelComponent } from './simulation-panel.component';
import { AuthService } from '../../core/auth/auth.service';
import { EdgeClient } from '../../core/api/edge.client';
import { RateLimitService } from '../../core/simulation/rate-limit.service';
import {
  Band,
  CreatorResult,
  DeliverableResult,
  W2Response,
} from '../../core/simulation/simulation-w2.types';

// ── W2 fixtures ───────────────────────────────────────────────────────
// Shaped exactly like the `run-simulation` W2 response (spec §5/§8). The
// panel renders this and nothing else — it does no forecast math.

function band(expected: number): Band {
  return {
    conservative: Math.round(expected * 0.68),
    expected,
    optimistic: Math.round(expected * 1.42),
  };
}

function ytDeliverable(over: Partial<DeliverableResult> = {}): DeliverableResult {
  return {
    creatorId: '7', platform: 'YouTube', format: 'Integrated', quantity: 2, durationHours: null,
    reach: 20_000, cpi: 80, cpiSubstituted: false, gfi: 75, noData: false,
    ctr: 2.4, cvr: 0.9,
    impressions: 40_000, uniqueReach: 32_000, engagedClicks: 960, conversions: 288,
    d60: { impressions: 52_000, uniqueReach: 41_600, engagedClicks: 1_248, conversions: 374 },
    d90: { impressions: 58_000, uniqueReach: 46_400, engagedClicks: 1_392, conversions: 417 },
    band: {
      impressions: band(40_000), uniqueReach: band(32_000),
      engagedClicks: band(960), conversions: band(288),
    },
    cost: 6_000, costSource: 'agreed', bandBreach: null,
    rateRange: [4_000, 8_000], costPerConversion: 20.8,
    ...over,
  };
}

function twDeliverable(over: Partial<DeliverableResult> = {}): DeliverableResult {
  // A stream is watched live — the 60/90-day windows add nothing (spec §11).
  const flat = { impressions: 9_000, uniqueReach: 7_200, engagedClicks: 180, conversions: 54 };
  return {
    creatorId: '9', platform: 'Twitch', format: 'Dedicated', quantity: 1, durationHours: 2,
    reach: 9_000, cpi: 50, cpiSubstituted: true, gfi: 60, noData: false,
    ctr: 2, cvr: 0.75,
    ...flat,
    d60: { ...flat }, d90: { ...flat },
    band: {
      impressions: band(9_000), uniqueReach: band(7_200),
      engagedClicks: band(180), conversions: band(54),
    },
    cost: 3_500, costSource: 'estimated', bandBreach: 'above',
    rateRange: [1_000, 3_000], costPerConversion: 64.8,
    ...over,
  };
}

function ytCreator(over: Partial<CreatorResult> = {}): CreatorResult {
  return {
    id: '7', name: 'Creator 7', primaryPlatform: 'YouTube', gfi: 75, reachable: true,
    engagementRate: 3.2,
    cost: 6_000, forecastableCost: 6_000,
    impressions: 40_000, uniqueReach: 32_000, engagedClicks: 960, conversions: 288,
    costPerConversion: 20.8, reachUpperBound: false,
    deliverables: [ytDeliverable()],
    ...over,
  };
}

function twCreator(over: Partial<CreatorResult> = {}): CreatorResult {
  return {
    // D26: Twitch carries no observed engagement rate — the row must be absent.
    id: '9', name: 'Creator 9', primaryPlatform: 'Twitch', gfi: 60, reachable: true,
    engagementRate: null,
    cost: 3_500, forecastableCost: 3_500,
    impressions: 9_000, uniqueReach: 7_200, engagedClicks: 180, conversions: 54,
    costPerConversion: 64.8, reachUpperBound: false,
    deliverables: [twDeliverable()],
    ...over,
  };
}

function w2(over: Partial<W2Response> = {}): W2Response {
  const creators = over.creators ?? [ytCreator(), twCreator()];
  return {
    mode: 'free', budget: 20_000, genre: 'Gaming & Esports', subMode: '', objectives: [],
    model: {
      version: 'w2-2026-08',
      params: { T: 0.35, k_youtube: 1.6, k_twitch: 2.5 },
      generatedAt: '2026-08-26T00:00:00.000Z',
    },
    bench: { ctrBase: 2, cvrBase: 0.5, engBase: 4 },
    creators,
    platforms: [
      {
        platform: 'YouTube', impressions: 40_000, uniqueReach: 32_000, engagedClicks: 960,
        conversions: 288, cost: 6_000, costPerConversion: 20.8,
        band: {
          impressions: band(40_000), uniqueReach: band(32_000),
          engagedClicks: band(960), conversions: band(288),
        },
      },
      {
        platform: 'Twitch', impressions: 9_000, uniqueReach: 7_200, engagedClicks: 180,
        conversions: 54, cost: 3_500, costPerConversion: 64.8,
        band: {
          impressions: band(9_000), uniqueReach: band(7_200),
          engagedClicks: band(180), conversions: band(54),
        },
      },
    ],
    totals: {
      impressions: 49_000, engagedClicks: 1_140,
      uniqueReach: { value: 39_200, upperBound: true },
      conversions: { value: 342, upperBound: true },
      cost: 9_500, forecastableCost: 9_500, costPerConversion: 27.78,
      band: {
        impressions: band(49_000),
        uniqueReach: { ...band(39_200), upperBound: true },
        engagedClicks: band(1_140),
        conversions: { ...band(342), upperBound: true },
      },
    },
    unallocated: 0, unallocatedMessage: null, zeroBudget: false, warnings: [],
    ...over,
  };
}

@Component({
  standalone: true,
  imports: [SimulationPanelComponent],
  template: `<app-simulation-panel
    [mode]="mode()" [creatorIds]="creatorIds()" [campaignId]="campaignId()"
    [initialBudget]="85000" [initialGenre]="'Gaming & Esports'"
    [genres]="['Gaming & Esports']" [initialObjectives]="initialObjectives()"
    [subMode]="subMode()" [readonly]="readonly()" [autoRun]="autoRun()"
    (simulated)="last.set($event)" (failed)="failures.update((n) => n + 1)" />`,
})
class Host {
  mode = signal<'free' | 'campaign'>('free');
  creatorIds = signal<number[]>([7, 9]);
  campaignId = signal<string | null>(null);
  readonly = signal(false);
  autoRun = signal(false);
  subMode = signal<string | undefined>(undefined);
  initialObjectives = signal<string[]>([]);
  last = signal<W2Response | null>(null);
  failures = signal(0);
}

/** Wraps a rejection value so `setup` can reject with anything, not just an Error. */
class Rejection {
  constructor(readonly value: unknown) {}
}
const rejects = (value: unknown) => new Rejection(value);

/**
 * What Angular's HttpClient actually throws: an HttpErrorResponse, which
 * *implements* Error but does not extend it (`instanceof Error` is false), and
 * carries the edge function's JSON body on `.error`.
 */
const httpError = (body: unknown, message = 'Http failure response for /functions/v1/run-simulation: 400 Bad Request') => ({
  name: 'HttpErrorResponse',
  status: 400,
  statusText: 'Bad Request',
  url: 'https://example.supabase.co/functions/v1/run-simulation',
  ok: false,
  error: body,
  message,
});

function setup(response: W2Response | Rejection = w2(), tier = 'silver') {
  localStorage.clear();
  const post =
    response instanceof Rejection
      ? vi.fn().mockRejectedValue(response.value)
      : vi.fn().mockResolvedValue(response);
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

/** Create the host, run the panel, and settle — the common arrange for render tests. */
async function rendered(response: W2Response | Rejection = w2(), mutate?: (h: Host) => void) {
  const { post } = setup(response);
  const f = TestBed.createComponent(Host);
  if (mutate) mutate(f.componentInstance);
  f.detectChanges();
  (f.nativeElement.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).click();
  await f.whenStable();
  f.detectChanges();
  return { f, post, el: f.nativeElement as HTMLElement };
}

const text = (el: HTMLElement, sel: string) =>
  (el.querySelector(`[data-testid="${sel}"]`) as HTMLElement | null)?.textContent ?? '';

describe('SimulationPanelComponent (W2) — controls', () => {
  it('renders budget, genre, objectives and run in free mode', () => {
    setup();
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('[data-testid="simw2-controls"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="simw2-budget"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="simw2-genre"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="simw2-objectives"]')).toBeTruthy();
    expect((el.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders exactly the 3 objective buckets and seeds them from initialObjectives', () => {
    setup();
    const f = TestBed.createComponent(Host);
    f.componentInstance.initialObjectives.set(['Awareness', 'Engagement']);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    const chips = [...el.querySelectorAll('[data-testid^="simw2-obj-"]')];
    expect(chips.map((c) => c.textContent?.trim())).toEqual(['Awareness', 'Sales', 'Engagement']);
    const bg = (id: string) =>
      (el.querySelector(`[data-testid="simw2-obj-${id}"]`) as HTMLElement).style.background;
    expect(bg('awareness')).toContain('color-sf-blue');
    expect(bg('engagement')).toContain('color-sf-blue');
    expect(bg('sales')).not.toContain('color-sf-blue');
  });

  it('has no AOV input, no duration slider and no format dropdown', () => {
    setup();
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    for (const gone of [
      'sim-aov', 'sim-duration', 'sim-duration-label', 'sim-format',
      'simw2-aov', 'simw2-duration', 'simw2-format',
    ]) {
      expect(el.querySelector(`[data-testid="${gone}"]`)).toBeNull();
    }
  });

  it('campaign mode hides the budget control — the server owns the campaign budget', () => {
    setup();
    const f = TestBed.createComponent(Host);
    f.componentInstance.mode.set('campaign');
    f.componentInstance.campaignId.set('camp-1');
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="simw2-controls"]')).toBeTruthy();
    expect(f.nativeElement.querySelector('[data-testid="simw2-budget"]')).toBeNull();
  });

  it('readonly hides the controls and the run button', () => {
    setup();
    const f = TestBed.createComponent(Host);
    f.componentInstance.readonly.set(true);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="simw2-controls"]')).toBeNull();
    expect(f.nativeElement.querySelector('[data-testid="simw2-run"]')).toBeNull();
  });

  it('free mode with no creators disables run', () => {
    setup();
    const f = TestBed.createComponent(Host);
    f.componentInstance.creatorIds.set([]);
    f.detectChanges();
    expect((f.nativeElement.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('SimulationPanelComponent (W2) — dispatch', () => {
  it('free mode posts ids, budget, genre, subMode and objectives — never creator stats', async () => {
    const { post, f } = await rendered(w2(), (h) => {
      h.subMode.set('Cozy');
      h.initialObjectives.set(['Awareness']);
    });
    expect(post).toHaveBeenCalledOnce();
    const [name, body] = post.mock.calls[0];
    expect(name).toBe('run-simulation');
    expect(body).toEqual({
      mode: 'free',
      creators: [{ id: 7 }, { id: 9 }],
      budget: 85_000,
      genre: 'Gaming & Esports',
      subMode: 'Cozy',
      objectives: ['Awareness'],
    });
    // No stats, no aov, no durationWeeks, no format ride along (spec §2/§6).
    for (const k of ['aov', 'durationWeeks', 'format', 'cpi', 'subs', 'avgViews']) {
      expect(body).not.toHaveProperty(k);
    }
    expect(f.componentInstance.last()?.totals.impressions).toBe(49_000);
  });

  it('campaign mode posts the campaign id, never a creator roster', async () => {
    const { post } = await rendered(w2({ mode: 'campaign' }), (h) => {
      h.mode.set('campaign');
      h.campaignId.set('camp-1');
    });
    const body = post.mock.calls[0][1] as Record<string, unknown>;
    expect(body['mode']).toBe('campaign');
    expect(body['campaignId']).toBe('camp-1');
    expect(body).not.toHaveProperty('creators');
    expect(body).not.toHaveProperty('budget');
  });

  it('increments the rate limit on a run', async () => {
    await rendered();
    expect(TestBed.inject(RateLimitService).read()).toBe(1);
  });

  it('blocks the run and shows the banner when the tier limit is spent', () => {
    setup(w2(), 'free');
    const rate = TestBed.inject(RateLimitService);
    rate.increment(); rate.increment(); rate.increment();
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    expect((f.nativeElement.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement).disabled).toBe(true);
    expect(f.nativeElement.querySelector('[data-testid="simw2-rate-limit"]')).toBeTruthy();
  });

  it('auto-runs once when autoRun is set', async () => {
    const { post } = setup();
    const f = TestBed.createComponent(Host);
    f.componentInstance.autoRun.set(true);
    f.detectChanges();
    await new Promise((r) => setTimeout(r));
    f.detectChanges();
    expect(post).toHaveBeenCalledOnce();
    expect(f.nativeElement.querySelector('[data-testid="simw2-results"]')).toBeTruthy();
  });

  it('surfaces a rejected run as an error state instead of an empty forecast', async () => {
    const { el } = await rendered(rejects(new Error('edge fn exploded')));
    const err = el.querySelector('[data-testid="simw2-error"]');
    expect(err).toBeTruthy();
    expect(err!.textContent).toContain('edge fn exploded');
    expect(el.querySelector('[data-testid="simw2-results"]')).toBeNull();
  });

  it('renders the edge function\'s own message from an HttpErrorResponse', async () => {
    // HttpErrorResponse is NOT `instanceof Error`, so an Error-only extraction
    // renders "[object Object]" and swallows what the backend actually said.
    const { el } = await rendered(rejects(httpError({ error: 'campaign has no deliverable rows' })));
    const err = el.querySelector('[data-testid="simw2-error"]')!;
    expect(err.textContent).toContain('campaign has no deliverable rows');
    expect(err.textContent).not.toContain('[object Object]');
  });

  it('falls back to the transport message when the body carries no error field', async () => {
    const { el } = await rendered(rejects(httpError('<html>502 Bad Gateway</html>', 'Http failure response: 502 Bad Gateway')));
    const err = el.querySelector('[data-testid="simw2-error"]')!;
    expect(err.textContent).toContain('502 Bad Gateway');
    expect(err.textContent).not.toContain('[object Object]');
  });

  it('never renders [object Object] for a thrown value with no message at all', async () => {
    const { el } = await rendered(rejects({ status: 0 }));
    const err = el.querySelector('[data-testid="simw2-error"]')!;
    expect(err.textContent).not.toContain('[object Object]');
  });

  it('emits failed and drops the previous result when a re-run fails', async () => {
    const { post } = setup();
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const run = f.nativeElement.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement;
    run.click();
    await f.whenStable(); f.detectChanges();
    expect(f.componentInstance.last()).not.toBeNull();
    expect(f.componentInstance.failures()).toBe(0);

    post.mockRejectedValue(httpError({ error: 'quota exhausted' }));
    run.click();
    await f.whenStable(); f.detectChanges();

    // The panel dropped the stale forecast; the host must be told so it can too.
    expect(f.nativeElement.querySelector('[data-testid="simw2-results"]')).toBeNull();
    expect(f.componentInstance.failures()).toBe(1);
  });

  it('clears a previous error when a later run succeeds', async () => {
    const { post } = setup(rejects(new Error('transient')));
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const run = f.nativeElement.querySelector('[data-testid="simw2-run"]') as HTMLButtonElement;
    run.click();
    await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="simw2-error"]')).toBeTruthy();

    post.mockResolvedValue(w2());
    run.click();
    await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="simw2-error"]')).toBeNull();
    expect(f.nativeElement.querySelector('[data-testid="simw2-results"]')).toBeTruthy();
  });
});

describe('SimulationPanelComponent (W2) — per-creator deliverable rows', () => {
  it('groups deliverable rows under each creator', async () => {
    const { el } = await rendered();
    expect(el.querySelector('[data-testid="simw2-creator-7"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="simw2-creator-9"]')).toBeTruthy();
    expect(text(el, 'simw2-creator-7')).toContain('Creator 7');
    expect(el.querySelector('[data-testid="simw2-deliverable-7-0"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="simw2-deliverable-9-0"]')).toBeTruthy();
  });

  it('renders platform badge, format and quantity on every row', async () => {
    const { el } = await rendered();
    expect(text(el, 'simw2-deliverable-platform-7-0')).toContain('YouTube');
    expect(text(el, 'simw2-deliverable-format-7-0')).toContain('Integrated');
    expect(text(el, 'simw2-deliverable-qty-7-0')).toContain('2');
    expect(text(el, 'simw2-deliverable-platform-9-0')).toContain('Twitch');
    expect(text(el, 'simw2-deliverable-format-9-0')).toContain('Dedicated');
  });

  it('renders stream hours on a Twitch row and none on a YouTube row', async () => {
    const { el } = await rendered();
    expect(text(el, 'simw2-deliverable-hours-9-0')).toContain('2');
    expect(el.querySelector('[data-testid="simw2-deliverable-hours-7-0"]')).toBeNull();
  });

  it('renders the four volume columns per row', async () => {
    const { el } = await rendered();
    expect(text(el, 'simw2-deliverable-impressions-7-0')).toContain('40,000');
    expect(text(el, 'simw2-deliverable-unique-reach-7-0')).toContain('32,000');
    expect(text(el, 'simw2-deliverable-engaged-clicks-7-0')).toContain('960');
    expect(text(el, 'simw2-deliverable-conversions-7-0')).toContain('288');
  });

  it('carries the YouTube III.E.4h source header and proprietary-metric note beside CPI/GFI', async () => {
    // Permanent obligation — see docs/compliance/README.md. This panel is the
    // surface that renders CPI (per deliverable) and GFI (per creator).
    const { el } = await rendered();
    expect(el.querySelector('[data-testid="metric-source-simfluence"]')).toBeTruthy();
    const note = el.querySelector('[data-testid="proprietary-note"]');
    expect(note).toBeTruthy();
    expect(note!.textContent).toContain('independently calculated by Simfluence');
  });

  it('labels engaged clicks as video-level engagement, not site visits', async () => {
    const { el } = await rendered();
    const label = text(el, 'simw2-engaged-clicks-label').toLowerCase();
    expect(label).toContain('engagement clicks');
    expect(label).toContain('video-level');
  });

  it('renders cost, its source and cost per conversion per row', async () => {
    const { el } = await rendered();
    expect(text(el, 'simw2-deliverable-cost-7-0')).toContain('6,000');
    expect(text(el, 'simw2-deliverable-cost-source-7-0').toLowerCase()).toContain('agreed');
    expect(text(el, 'simw2-deliverable-cost-per-conversion-7-0')).toContain('20.8');
    expect(text(el, 'simw2-deliverable-cost-source-9-0').toLowerCase()).toContain('estimated');
  });

  it('shows a creator engagement rate for YouTube and omits it for Twitch (D26)', async () => {
    const { el } = await rendered();
    expect(text(el, 'simw2-creator-engagement-7')).toContain('3.2');
    expect(el.querySelector('[data-testid="simw2-creator-engagement-9"]')).toBeNull();
  });

  it('badges a no-data row and keeps its cost visible', async () => {
    const noData = ytDeliverable({
      noData: true, reach: null, impressions: 0, uniqueReach: 0, engagedClicks: 0,
      conversions: 0, costPerConversion: null,
    });
    const { el } = await rendered(w2({ creators: [ytCreator({ deliverables: [noData] })] }));
    expect(el.querySelector('[data-testid="simw2-deliverable-no-data-7-0"]')).toBeTruthy();
    expect(text(el, 'simw2-deliverable-cost-7-0')).toContain('6,000');
  });

  it('badges a band breach above the rate range', async () => {
    const { el } = await rendered();
    const breach = el.querySelector('[data-testid="simw2-deliverable-band-breach-9-0"]');
    expect(breach).toBeTruthy();
    expect(breach!.textContent!.toLowerCase()).toContain('above');
    expect(el.querySelector('[data-testid="simw2-deliverable-band-breach-7-0"]')).toBeNull();
  });

  it('flags a substituted CPI and leaves a real CPI unflagged', async () => {
    const { el } = await rendered();
    expect(el.querySelector('[data-testid="simw2-deliverable-cpi-substituted-9-0"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="simw2-deliverable-cpi-substituted-7-0"]')).toBeNull();
  });

  it('marks a creator the budget could not cover', async () => {
    const { el } = await rendered(w2({ creators: [ytCreator({ reachable: false }), twCreator()] }));
    expect(el.querySelector('[data-testid="simw2-creator-unreachable-7"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="simw2-creator-unreachable-9"]')).toBeNull();
  });

  it('labels a multi-platform creator reach as an upper bound', async () => {
    const mixed = ytCreator({
      reachUpperBound: true,
      deliverables: [ytDeliverable(), twDeliverable({ creatorId: '7' })],
    });
    const { el } = await rendered(w2({ creators: [mixed] }));
    expect(text(el, 'simw2-creator-upper-bound-7').toLowerCase()).toContain('upper bound');
  });
});

describe('SimulationPanelComponent (W2) — 30/60/90 windows', () => {
  it('expands a row to its 30/60/90-day windows on demand', async () => {
    const { f, el } = await rendered();
    expect(el.querySelector('[data-testid="simw2-window-7-0"]')).toBeNull();
    (el.querySelector('[data-testid="simw2-window-toggle-7-0"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el.querySelector('[data-testid="simw2-window-7-0"]')).toBeTruthy();
    expect(text(el, 'simw2-window-30-impressions-7-0')).toContain('40,000');
    expect(text(el, 'simw2-window-60-impressions-7-0')).toContain('52,000');
    expect(text(el, 'simw2-window-90-impressions-7-0')).toContain('58,000');
    expect(text(el, 'simw2-window-90-conversions-7-0')).toContain('417');
  });

  it('shows a Twitch row flat across all three windows, with a note saying why', async () => {
    const { f, el } = await rendered();
    (el.querySelector('[data-testid="simw2-window-toggle-9-0"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(text(el, 'simw2-window-30-impressions-9-0')).toContain('9,000');
    expect(text(el, 'simw2-window-60-impressions-9-0')).toContain('9,000');
    expect(text(el, 'simw2-window-90-impressions-9-0')).toContain('9,000');
    expect(el.querySelector('[data-testid="simw2-window-flat-note-9-0"]')).toBeTruthy();
    // A YouTube row, which does accumulate, carries no flat note.
    (el.querySelector('[data-testid="simw2-window-toggle-7-0"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el.querySelector('[data-testid="simw2-window-flat-note-7-0"]')).toBeNull();
  });
});

describe('SimulationPanelComponent (W2) — bands', () => {
  it('labels the campaign band Conservative / Expected / Optimistic', async () => {
    const { el } = await rendered();
    expect(text(el, 'simw2-band-conservative')).toContain('Conservative');
    expect(text(el, 'simw2-band-expected')).toContain('Expected');
    expect(text(el, 'simw2-band-optimistic')).toContain('Optimistic');
    expect(text(el, 'simw2-band-conservative')).toContain('33,320'); // 49,000 × 0.68
    expect(text(el, 'simw2-band-optimistic')).toContain('69,580');   // 49,000 × 1.42
  });

  it('labels a per-deliverable range the same way', async () => {
    const { f, el } = await rendered();
    (el.querySelector('[data-testid="simw2-window-toggle-7-0"]') as HTMLButtonElement).click();
    f.detectChanges();
    const range = el.querySelector('[data-testid="simw2-range-7-0"]') as HTMLElement;
    expect(range).toBeTruthy();
    expect(range.textContent).toContain('Conservative');
    expect(range.textContent).toContain('Expected');
    expect(range.textContent).toContain('Optimistic');
  });

  it('never renders a percentile label anywhere', async () => {
    const { f, el } = await rendered();
    (el.querySelector('[data-testid="simw2-window-toggle-7-0"]') as HTMLButtonElement).click();
    f.detectChanges();
    const dom = el.textContent ?? '';
    for (const banned of ['P10', 'P50', 'P90', 'Worst case', 'Base case', 'Best case']) {
      expect(dom).not.toContain(banned);
    }
  });

  it('never renders ROAS, revenue assumptions or a campaign duration anywhere', async () => {
    const { f, el } = await rendered();
    (el.querySelector('[data-testid="simw2-window-toggle-7-0"]') as HTMLButtonElement).click();
    f.detectChanges();
    const dom = (el.textContent ?? '').toLowerCase();
    for (const banned of ['roas', 'return on ad spend', 'conversion value', 'week']) {
      expect(dom).not.toContain(banned);
    }
  });
});

describe('SimulationPanelComponent (W2) — aggregates', () => {
  it('renders a totals section per platform', async () => {
    const { el } = await rendered();
    const yt = el.querySelector('[data-testid="simw2-platform-youtube"]') as HTMLElement;
    const tw = el.querySelector('[data-testid="simw2-platform-twitch"]') as HTMLElement;
    expect(yt).toBeTruthy();
    expect(tw).toBeTruthy();
    expect(yt.textContent).toContain('40,000');
    expect(yt.textContent).toContain('288');
    expect(tw.textContent).toContain('9,000');
    expect(text(el, 'simw2-platform-cost-per-conversion-twitch')).toContain('64.8');
  });

  it('sums impressions plainly but labels combined reach and conversions as an upper bound', async () => {
    const { el } = await rendered();
    expect(text(el, 'simw2-total-impressions')).toContain('49,000');
    expect(text(el, 'simw2-total-unique-reach')).toContain('39,200');
    expect(text(el, 'simw2-total-conversions')).toContain('342');
    expect(text(el, 'simw2-total-unique-reach-upper-bound').toLowerCase()).toContain('upper bound');
    expect(text(el, 'simw2-total-conversions-upper-bound').toLowerCase()).toContain('upper bound');
    // Impressions are exposure events — they sum honestly, so no caveat there.
    expect(el.querySelector('[data-testid="simw2-total-impressions-upper-bound"]')).toBeNull();
  });

  it('renders campaign cost and cost per conversion', async () => {
    const { el } = await rendered();
    expect(text(el, 'simw2-total-cost')).toContain('9,500');
    expect(text(el, 'simw2-total-cost-per-conversion')).toContain('27.78');
  });
});

describe('SimulationPanelComponent (W2) — budget messages', () => {
  it('renders the unallocated line with the roster-tops-out message', async () => {
    const { el } = await rendered(
      w2({ unallocated: 10_500, unallocatedMessage: 'This roster tops out at $9,500.' }),
    );
    expect(text(el, 'simw2-unallocated')).toContain('10,500');
    expect(text(el, 'simw2-unallocated-message')).toContain('This roster tops out at $9,500.');
  });

  it('hides the unallocated line when the budget is fully allocated', async () => {
    const { el } = await rendered();
    expect(el.querySelector('[data-testid="simw2-unallocated"]')).toBeNull();
  });

  it('warns loudly on a zero budget', async () => {
    const { el } = await rendered(w2({ zeroBudget: true, budget: 0 }));
    expect(el.querySelector('[data-testid="simw2-zero-budget"]')).toBeTruthy();
  });

  it('lists every server warning', async () => {
    const { el } = await rendered(
      w2({ warnings: ['2 deliverables had no stats', 'genre benchmark missing'] }),
    );
    const items = el.querySelectorAll('[data-testid="simw2-warning"]');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('2 deliverables had no stats');
    expect(items[1].textContent).toContain('genre benchmark missing');
  });

  it('renders no warnings block when the server sent none', async () => {
    const { el } = await rendered();
    expect(el.querySelector('[data-testid="simw2-warnings"]')).toBeNull();
  });
});
