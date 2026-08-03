import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoverySweepsComponent } from './discovery-sweeps.component';
import { AdminDiscoveryService } from '../../core/admin/admin-discovery.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { DiscoveryRun } from '../../core/admin/admin-discovery.types';

function mkRun(overrides: Partial<DiscoveryRun> = {}): DiscoveryRun {
  return {
    id: 'run-1',
    created_at: '2026-07-10T00:00:00Z',
    status: 'running',
    genre: 'Gaming',
    sub_mode: 'Speedruns',
    min_subscribers: 1000,
    query_total: 10,
    query_done: 4,
    channels_found: 3,
    skipped_known: 1,
    units_spent: 400,
    last_slice_at: null,
    error: null,
    ...overrides,
  };
}

function setup(overrides: {
  startSweep?: ReturnType<typeof vi.fn>;
  listRuns?: ReturnType<typeof vi.fn>;
  cancelRun?: ReturnType<typeof vi.fn>;
} = {}) {
  const startSweep = overrides.startSweep ?? vi.fn().mockResolvedValue({ runId: 'run-1', queryTotal: 10 });
  const listRuns = overrides.listRuns ?? vi.fn().mockResolvedValue([]);
  const cancelRun = overrides.cancelRun ?? vi.fn().mockResolvedValue(undefined);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DiscoverySweepsComponent],
    providers: [
      { provide: AdminDiscoveryService, useValue: { startSweep, listRuns, cancelRun } },
      {
        provide: CreatorsService,
        useValue: {
          submodesByGenre: () => ({
            Gaming: [{ subMode: 'Speedruns', hasKeywords: true }],
            'Tech & Gadgets': [{ subMode: 'Reviews', hasKeywords: true }],
          }),
        },
      },
    ],
  });
  return { startSweep, listRuns, cancelRun };
}

/** Create the fixture and let the constructor's initial loadRuns() settle
 *  (zoneless: whenStable() waits out the pending promise chain). */
async function create() {
  const fixture = TestBed.createComponent(DiscoverySweepsComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

// Fake timers for the whole file: several runs tables below carry
// queued/running rows, which arm the polling setInterval on load. Faking
// time everywhere (not just in the "polling" describe) guarantees that
// interval never actually fires against a stale mock after a test ends.
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('DiscoverySweepsComponent — controls', () => {
  it('sub-mode select is disabled until a genre is picked', async () => {
    setup();
    const fixture = await create();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('[data-testid="sweep-submode"]');
    expect(select.disabled).toBe(true);

    fixture.componentInstance.onGenre('Gaming');
    fixture.detectChanges();
    expect(select.disabled).toBe(false);
  });

  it('resets an out-of-scope sub-mode when the genre changes', async () => {
    setup();
    const fixture = await create();
    const c = fixture.componentInstance;
    c.onGenre('Gaming');
    c.subMode.set('Speedruns');
    c.onGenre('Tech & Gadgets');
    expect(c.subMode()).toBe('');
  });
});

describe('DiscoverySweepsComponent — start sweep', () => {
  it('starts a scoped sweep with genre+subMode, then reloads runs', async () => {
    const { startSweep, listRuns } = setup();
    const fixture = await create();
    const c = fixture.componentInstance;
    c.onGenre('Gaming');
    c.subMode.set('Speedruns');
    listRuns.mockClear();

    await c.startSweep();

    expect(startSweep).toHaveBeenCalledWith({ genre: 'Gaming', subMode: 'Speedruns' });
    expect(listRuns).toHaveBeenCalledTimes(1); // optimistic reload after start
  });

  it('blank genre + blank sub-mode starts an all-genres sweep (fields omitted as undefined)', async () => {
    const { startSweep } = setup();
    const fixture = await create();
    await fixture.componentInstance.startSweep();
    expect(startSweep).toHaveBeenCalledWith({ genre: undefined, subMode: undefined });
  });

  it('passes minSubscribers when set and omits it when blank or invalid', async () => {
    const { startSweep } = setup();
    const fixture = await create();
    const component = fixture.componentInstance;

    component.onMinSubs('500000');
    await component.startSweep();
    expect(startSweep).toHaveBeenLastCalledWith({ genre: undefined, subMode: undefined, minSubscribers: 500000 });

    component.onMinSubs('');                   // blank → omit (backend defaults 5,000)
    await component.startSweep();
    expect(startSweep).toHaveBeenLastCalledWith({ genre: undefined, subMode: undefined, minSubscribers: undefined });

    component.onMinSubs('0');                  // 0 is falsy server-side — treat as unset
    await component.startSweep();
    expect(startSweep).toHaveBeenLastCalledWith({ genre: undefined, subMode: undefined, minSubscribers: undefined });
  });

  it('re-syncs the min-subs box to the parsed value on blur and shows the infotip', async () => {
    setup();
    const fixture = await create();
    const component = fixture.componentInstance;

    const box = { value: '0' } as HTMLInputElement;
    component.onMinSubs('0');
    component.onMinSubsBlur(box);
    expect(box.value).toBe('');        // 0 → unset → box clears (placeholder shows the 5,000 default)

    box.value = '12.7';
    component.onMinSubs('12.7');
    component.onMinSubsBlur(box);
    expect(box.value).toBe('12');      // floored value shown honestly

    box.value = '500000';
    component.onMinSubs('500000');
    component.onMinSubsBlur(box);
    expect(box.value).toBe('500000');  // valid value survives blur

    const tip = fixture.nativeElement.querySelector('[data-testid="sweep-minsubs-tip"]') as HTMLElement;
    expect(tip?.title).toContain('5,000');
  });

  it('surfaces the backend 404 "no enabled queries in scope" inline instead of throwing', async () => {
    const startSweep = vi.fn().mockRejectedValue({ error: { error: 'No enabled queries in scope' } });
    setup({ startSweep });
    const fixture = await create();
    const c = fixture.componentInstance;

    await expect(c.startSweep()).resolves.toBeUndefined();
    fixture.detectChanges();

    expect(c.startError()).toBe('No enabled queries in scope');
    const el = fixture.nativeElement.querySelector('[data-testid="sweep-start-error"]');
    expect(el.textContent).toContain('No enabled queries in scope');
  });

  it('shows "Starting…" on the button while busy', async () => {
    let resolve!: (v: { runId: string; queryTotal: number }) => void;
    const startSweep = vi.fn().mockImplementation(() => new Promise((r) => { resolve = r; }));
    setup({ startSweep });
    const fixture = await create();
    const c = fixture.componentInstance;

    const pending = c.startSweep();
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="sweep-start"]');
    expect(btn.textContent?.trim()).toBe('Starting…');
    expect(btn.disabled).toBe(true);

    resolve({ runId: 'run-1', queryTotal: 10 });
    await pending;
  });
});

describe('DiscoverySweepsComponent — runs table + progress', () => {
  it('renders progress as query_done/query_total with a matching width% bar', async () => {
    setup({ listRuns: vi.fn().mockResolvedValue([mkRun({ query_done: 3, query_total: 12 })]) });
    const fixture = await create();

    const text = fixture.nativeElement.querySelector('[data-testid="sweep-progress-text"]').textContent;
    expect(text).toContain('3/12');
    const bar: HTMLElement = fixture.nativeElement.querySelector('[data-testid="sweep-progress-bar"]');
    expect(bar.style.width).toBe('25%');
  });

  it('progressPct guards a zero query_total (no NaN/Infinity) and clamps overshoot to 100', () => {
    setup();
    const c = TestBed.createComponent(DiscoverySweepsComponent).componentInstance;
    expect(c.progressPct(mkRun({ query_done: 0, query_total: 0 }))).toBe(0);
    // query_total is frozen at run creation — mid-sweep query additions can overshoot it.
    expect(c.progressPct(mkRun({ query_done: 15, query_total: 10 }))).toBe(100);
  });

  it('scope label: "All genres" for no genre, "Genre · Sub-mode" for both, genre alone otherwise', () => {
    setup();
    const c = TestBed.createComponent(DiscoverySweepsComponent).componentInstance;
    expect(c.scopeLabel(mkRun({ genre: null, sub_mode: null }))).toBe('All genres');
    expect(c.scopeLabel(mkRun({ genre: 'Gaming', sub_mode: 'Speedruns' }))).toBe('Gaming · Speedruns');
    expect(c.scopeLabel(mkRun({ genre: 'Gaming', sub_mode: null }))).toBe('Gaming');
  });

  it('failed rows tooltip the run error; paused_quota rows tooltip the Pacific-rollover note', async () => {
    setup({ listRuns: vi.fn().mockResolvedValue([
      mkRun({ id: 'r1', status: 'failed', error: 'quota exceeded mid-run' }),
      mkRun({ id: 'r2', status: 'paused_quota' }),
    ]) });
    const fixture = await create();
    const chips: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="sweep-status"]'));
    expect(chips[0].getAttribute('title')).toBe('quota exceeded mid-run');
    expect(chips[1].getAttribute('title')).toContain('Pacific-day rollover');
  });

  it('Cancel renders only for queued|running|paused_quota rows', async () => {
    setup({ listRuns: vi.fn().mockResolvedValue([
      mkRun({ id: 'r1', status: 'done' }),
      mkRun({ id: 'r2', status: 'running' }),
      mkRun({ id: 'r3', status: 'queued' }),
      mkRun({ id: 'r4', status: 'paused_quota' }),
      mkRun({ id: 'r5', status: 'failed' }),
      mkRun({ id: 'r6', status: 'cancelled' }),
    ]) });
    const fixture = await create();
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="sweep-run-row"]'));
    const hasCancel = (i: number) => !!rows[i].querySelector('[data-testid="sweep-cancel"]');
    expect(hasCancel(0)).toBe(false); // done
    expect(hasCancel(1)).toBe(true);  // running
    expect(hasCancel(2)).toBe(true);  // queued
    expect(hasCancel(3)).toBe(true);  // paused_quota
    expect(hasCancel(4)).toBe(false); // failed
    expect(hasCancel(5)).toBe(false); // cancelled
  });
});

describe('DiscoverySweepsComponent — cancel', () => {
  it('calls cancelRun with the run id, then reloads', async () => {
    const { cancelRun, listRuns } = setup({ listRuns: vi.fn().mockResolvedValue([mkRun({ id: 'r1', status: 'paused_quota' })]) });
    const fixture = await create();
    listRuns.mockClear();

    await fixture.componentInstance.cancel('r1');

    expect(cancelRun).toHaveBeenCalledWith('r1');
    expect(listRuns).toHaveBeenCalledTimes(1);
  });

  it('surfaces a cancel failure inline', async () => {
    const cancelRun = vi.fn().mockRejectedValue({ error: { error: 'run already finished' } });
    setup({ listRuns: vi.fn().mockResolvedValue([mkRun({ id: 'r1', status: 'paused_quota' })]), cancelRun });
    const fixture = await create();

    await expect(fixture.componentInstance.cancel('r1')).resolves.toBeUndefined();
    fixture.detectChanges();

    expect(fixture.componentInstance.runsError()).toBe('run already finished');
    expect(fixture.nativeElement.querySelector('[data-testid="sweep-runs-error"]').textContent).toContain('run already finished');
  });
});

describe('DiscoverySweepsComponent — polling', () => {
  it('polls every 5s while a run is queued/running, and stops once all runs are terminal', async () => {
    const listRuns = vi.fn()
      .mockResolvedValueOnce([mkRun({ id: 'r1', status: 'running' })])
      .mockResolvedValueOnce([mkRun({ id: 'r1', status: 'done' })]);
    setup({ listRuns });
    const fixture = await create();
    expect(listRuns).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    fixture.detectChanges();
    expect(listRuns).toHaveBeenCalledTimes(2); // run now 'done' — polling stops

    await vi.advanceTimersByTimeAsync(5000);
    expect(listRuns).toHaveBeenCalledTimes(2); // no further polling
  });

  it('does not poll when the only active run is paused_quota (resumes hourly server-side)', async () => {
    const listRuns = vi.fn().mockResolvedValue([mkRun({ id: 'r1', status: 'paused_quota' })]);
    setup({ listRuns });
    await create();
    expect(listRuns).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(listRuns).toHaveBeenCalledTimes(1);
  });

  it('MAX_POLLS bounds each polling episode, not the component lifetime: polling re-arms after the ceiling', async () => {
    const listRuns = vi.fn().mockResolvedValue([mkRun({ id: 'r1', status: 'running' })]);
    setup({ listRuns });
    const fixture = await create();
    // Jump to one tick before the ceiling instead of ticking MAX_POLLS times.
    const internals = fixture.componentInstance as unknown as { pollAttempts: number; MAX_POLLS: number };
    internals.pollAttempts = internals.MAX_POLLS - 1;

    await vi.advanceTimersByTimeAsync(5000); // final tick: ceiling hit → polling stops
    const callsAtStop = listRuns.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(listRuns.mock.calls.length).toBe(callsAtStop); // interval disarmed

    // New episode: the start reload sees the still-active run and must re-arm
    // (regression: a lifetime-cumulative pollAttempts kept this disarmed forever).
    await fixture.componentInstance.startSweep();
    const callsAfterStart = listRuns.mock.calls.length;
    expect(callsAfterStart).toBe(callsAtStop + 1); // the reload itself
    await vi.advanceTimersByTimeAsync(5000);
    expect(listRuns.mock.calls.length).toBe(callsAfterStart + 1); // polling ticked again
  });

  it('starting a sweep triggers an immediate reload and polling picks up the new active run', async () => {
    const listRuns = vi.fn()
      .mockResolvedValueOnce([]) // initial load: nothing yet
      .mockResolvedValueOnce([mkRun({ id: 'r1', status: 'queued' })]) // reload after start
      .mockResolvedValueOnce([mkRun({ id: 'r1', status: 'running' })]); // first poll tick
    setup({ listRuns });
    const fixture = await create();

    await fixture.componentInstance.startSweep();
    expect(listRuns).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(5000);
    expect(listRuns).toHaveBeenCalledTimes(3); // polling picked up the queued run
  });
});
