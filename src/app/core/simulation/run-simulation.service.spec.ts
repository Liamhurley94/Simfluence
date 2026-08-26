import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RunSimulationService } from './run-simulation.service';
import { EdgeClient } from '../api/edge.client';
import { Creator } from '../data/creator.types';
import { SimInputs } from './simulation.types';
import { W2Response } from './simulation-w2.types';

const sampleCreator: Creator = {
  id: 42,
  name: 'Test',
  handle: '@t',
  platform: 'YouTube',
  allPlatforms: ['YouTube'],
  subs: '100K',
  subsParsed: 100_000,
  avgViews: '20K',
  eng: '3.0%',
  genre: 'Gaming & Esports',
  cpi: 80,
  gfi: 75,
  color: '#fff',
  verifiedDeals: 1,
  sponsorHistory: [],
  bio: 'bio',
  ytStats: { subscriberCount: 120000, avgViews: 24000, engagementRate: 3.1, sponsorFreqPct: 10, statsRefreshedAt: null },
};

const sampleInputs: SimInputs = {
  creators: [sampleCreator],
  budget: 50_000,
  format: 'Dedicated',
  genre: 'Gaming & Esports',
  objectives: ['Sales'],
  subMode: 'RPG / Open World',
};

function setup(postResult: unknown = { error: null }) {
  const post = vi.fn().mockResolvedValue(postResult);
  const edgeStub = { post, get: vi.fn() } as unknown as EdgeClient;
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: EdgeClient, useValue: edgeStub }],
  });
  return { service: TestBed.inject(RunSimulationService), post };
}

describe('RunSimulationService', () => {
  beforeEach(() => {
    /* noop */
  });

  it('posts to /functions/v1/run-simulation with the correct payload shape', async () => {
    const { service, post } = setup({
      impressions: 1,
      ctr: 1,
      cpM: 1,
      cvr: 1,
      conversions: 1,
      roas: 1,
      engRate: 1,
      clicks: 1,
      budget: 50_000,
      bench: { ctrBase: 2, cpmBase: 8, cvrBase: 0.5, roasBase: 2, engBase: 4 },
      p10: { impressions: 1, ctr: 1, roas: 1 },
      p50: { impressions: 1, ctr: 1, roas: 1 },
      p90: { impressions: 1, ctr: 1, roas: 1 },
    });

    await service.run(sampleInputs);

    expect(post).toHaveBeenCalledOnce();
    const [name, payload] = post.mock.calls[0];
    expect(name).toBe('run-simulation');

    const body = payload as {
      creators: Array<Record<string, unknown>>;
      budget: number;
      format: string;
      genre: string;
      objectives: string[];
      subMode: string;
    };

    const c = body.creators[0];
    expect(c['id']).toBe('42');
    expect(c['cpi']).toBe('80');
    // GFI is no longer sent — the edge fn reads it from `creator_genre_scores`
    // (or falls back to score-creator on a miss). See run-simulation.service.ts.
    expect(c['gfi']).toBeUndefined();
    expect(c['language']).toBe('English');
    // subs/avgViews now come from LIVE ytStats, not the static '100K'/'20K'.
    expect(c['subs']).toBe('120000');
    expect(c['avgViews']).toBe('24000');
    // realCVR/realCPA retired (prototype leftovers) — neither is sent anymore.
    expect(c['realCVR']).toBeUndefined();
    expect(c['realCPA']).toBeUndefined();
    expect(body.budget).toBe(50_000);
    expect(body.format).toBe('Dedicated');
    expect(body.subMode).toBe('RPG / Open World');
    expect(body.objectives).toEqual(['Sales']);
    // No creatorFormats supplied → each creator entry omits `format`.
    expect(c['format']).toBeUndefined();
  });

  it('attaches per-creator `format` from creatorFormats when present, omits it otherwise', async () => {
    const { service, post } = setup({ error: null });
    const c1 = { ...sampleCreator, id: 42 };
    const c2 = { ...sampleCreator, id: 43 };

    // Only creator 42 has a format mapped; 43 has none.
    await service.run({ ...sampleInputs, creators: [c1, c2], creatorFormats: { 42: 'Dedicated' } });

    const body = post.mock.calls[0][1] as { creators: Array<Record<string, unknown>> };
    const entry42 = body.creators.find((e) => e['id'] === '42')!;
    const entry43 = body.creators.find((e) => e['id'] === '43')!;
    expect(entry42['format']).toBe('Dedicated');
    expect(entry43['format']).toBeUndefined();
  });

  it('caches the result in `latest` signal on success', async () => {
    const mockResult = {
      impressions: 100,
      ctr: 2,
      cpM: 6,
      cvr: 0.5,
      conversions: 1,
      roas: 0.1,
      engRate: 3,
      clicks: 2,
      budget: 50_000,
      bench: { ctrBase: 2.4, cpmBase: 8, cvrBase: 0.35, roasBase: 1.2, engBase: 4.2 },
      p10: { impressions: 68, ctr: 1.3, roas: 0.07 },
      p50: { impressions: 100, ctr: 2, roas: 0.1 },
      p90: { impressions: 142, ctr: 2.8, roas: 0.15 },
    };
    const { service } = setup(mockResult);

    const returned = await service.run(sampleInputs);
    expect(returned).toEqual(mockResult);
    expect(service.latest()).toEqual(mockResult);
  });

  it('returns null when the edge function returns an error payload', async () => {
    const { service } = setup({ error: 'Rate limited' });
    const result = await service.run(sampleInputs);
    expect(result).toBeNull();
    expect(service.latest()).toBeNull();
  });

  it('returns null when the HTTP call rejects', async () => {
    const post = vi.fn().mockRejectedValue(new Error('network down'));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: EdgeClient, useValue: { post, get: vi.fn() } },
      ],
    });
    const service = TestBed.inject(RunSimulationService);
    const result = await service.run(sampleInputs);
    expect(result).toBeNull();
  });

  it('`pending` is true during the in-flight request, false after', async () => {
    let resolveIt!: (v: unknown) => void;
    const post = vi.fn().mockImplementationOnce(
      () => new Promise((res) => (resolveIt = res)),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: EdgeClient, useValue: { post, get: vi.fn() } }],
    });
    const service = TestBed.inject(RunSimulationService);

    const p = service.run(sampleInputs);
    expect(service.pending()).toBe(true);
    resolveIt({ error: 'done' });
    await p;
    expect(service.pending()).toBe(false);
  });

  it('excludes creators with no live stats and returns null when none remain', async () => {
    const { service, post } = setup({ error: null });
    const noLive: Creator = { ...sampleCreator, ytStats: undefined };
    const res = await service.run({ ...sampleInputs, creators: [noLive] });
    expect(post).not.toHaveBeenCalled();
    expect(res).toBeNull();
  });

  it('sends average conversion value and duration, defaulted when unset', async () => {
    const { service, post } = setup();
    await service.run(sampleInputs);
    expect(post.mock.calls[0][1]).toMatchObject({ aov: 30, durationWeeks: 4 });
  });

  it('forwards explicit average conversion value and duration', async () => {
    const { service, post } = setup();
    await service.run({ ...sampleInputs, aov: 150, durationWeeks: 8 });
    expect(post.mock.calls[0][1]).toMatchObject({ aov: 150, durationWeeks: 8 });
  });

  it("sends a Twitch creator's avg_ccv as avgViews (empty subs)", async () => {
    const { service, post } = setup({
      impressions: 1, ctr: 1, cpM: 1, cvr: 1, conversions: 1, roas: 1, engRate: 1, clicks: 1, budget: 50_000,
      bench: { ctrBase: 2, cpmBase: 8, cvrBase: 0.5, roasBase: 2, engBase: 4 },
      p10: { impressions: 1, ctr: 1, roas: 1 }, p50: { impressions: 1, ctr: 1, roas: 1 }, p90: { impressions: 1, ctr: 1, roas: 1 },
    });
    const tw: Creator = {
      ...sampleCreator, platform: 'Twitch', ytStats: undefined,
      twitchStats: { avgCcv: 1800, peakCcv: 4000, streams30d: 10, hoursStreamed30d: 30, lastStreamAt: null, primaryGameName: null, liveRefreshedAt: null },
    };
    await service.run({ ...sampleInputs, creators: [tw] });
    const c = (post.mock.calls[0][1] as { creators: Array<Record<string, unknown>> }).creators[0];
    expect(c['avgViews']).toBe('1800');
    expect(c['subs']).toBe('');
  });
});

// ── W2 rebuild: runFree / runCampaign ────────────────────────────────
// The server loads all stats, deliverables and modelling params itself
// (spec §2) — the client sends only ids. No aov, no durationWeeks (both
// cut, spec §6.1/§6.3), no per-creator subs/avgViews/cpi.

const sampleW2Response: W2Response = {
  mode: 'free',
  budget: 50_000,
  genre: 'Gaming & Esports',
  subMode: '',
  objectives: ['Sales'],
  model: {
    version: 'w2-2026-08',
    params: { T: 1, k_youtube: 5, k_twitch: 2.5 },
    generatedAt: '2026-08-26T00:00:00.000Z',
  },
  bench: { ctrBase: 2.4, cvrBase: 0.35, engBase: 4.2 },
  creators: [],
  platforms: [],
  totals: {
    impressions: 0,
    engagedClicks: 0,
    uniqueReach: { value: 0, upperBound: true },
    conversions: { value: 0, upperBound: true },
    cost: 0,
    forecastableCost: 0,
    costPerConversion: null,
    band: {
      impressions: { conservative: 0, expected: 0, optimistic: 0 },
      uniqueReach: { conservative: 0, expected: 0, optimistic: 0, upperBound: true },
      engagedClicks: { conservative: 0, expected: 0, optimistic: 0 },
      conversions: { conservative: 0, expected: 0, optimistic: 0, upperBound: true },
    },
  },
  unallocated: 0,
  unallocatedMessage: null,
  zeroBudget: false,
  warnings: [],
};

function setupW2(postResult: unknown = sampleW2Response) {
  const post = vi.fn().mockResolvedValue(postResult);
  const edgeStub = { post, get: vi.fn() } as unknown as EdgeClient;
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: EdgeClient, useValue: edgeStub }],
  });
  return { service: TestBed.inject(RunSimulationService), post };
}

describe('RunSimulationService — runFree (W2)', () => {
  it('posts mode:free with only creator ids, budget, genre — no stats, no aov/durationWeeks', async () => {
    const { service, post } = setupW2();

    await service.runFree({
      creators: [{ id: 42 }, { id: 43 }],
      budget: 50_000,
      genre: 'Gaming & Esports',
      subMode: 'RPG / Open World',
      objectives: ['Sales'],
    });

    expect(post).toHaveBeenCalledOnce();
    const [name, payload] = post.mock.calls[0];
    expect(name).toBe('run-simulation');
    expect(payload).toEqual({
      mode: 'free',
      creators: [{ id: 42 }, { id: 43 }],
      budget: 50_000,
      genre: 'Gaming & Esports',
      subMode: 'RPG / Open World',
      objectives: ['Sales'],
    });
    // No stray fields — the browser sends ids, never stats (spec §2), and
    // aov/durationWeeks are cut (spec §6.1/§6.3).
    expect(Object.keys(payload as object).sort()).toEqual(
      ['mode', 'creators', 'budget', 'genre', 'subMode', 'objectives'].sort(),
    );
  });

  it('omits subMode/objectives when not supplied', async () => {
    const { service, post } = setupW2();

    await service.runFree({ creators: [{ id: 1 }], budget: 1000, genre: 'Music' });

    const payload = post.mock.calls[0][1] as Record<string, unknown>;
    expect(payload['subMode']).toBeUndefined();
    expect(payload['objectives']).toBeUndefined();
    expect(payload['aov']).toBeUndefined();
    expect(payload['durationWeeks']).toBeUndefined();
  });

  it('passes the response through typed, unmodified', async () => {
    const { service } = setupW2(sampleW2Response);
    const result = await service.runFree({ creators: [{ id: 1 }], budget: 1000, genre: 'Music' });
    expect(result).toEqual(sampleW2Response);
  });

  it('surfaces the error — rejects rather than swallowing to null', async () => {
    const post = vi.fn().mockRejectedValue(new Error('network down'));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: EdgeClient, useValue: { post, get: vi.fn() } }],
    });
    const service = TestBed.inject(RunSimulationService);

    await expect(
      service.runFree({ creators: [{ id: 1 }], budget: 1000, genre: 'Music' }),
    ).rejects.toThrow('network down');
  });
});

describe('RunSimulationService — runCampaign (W2)', () => {
  it('posts mode:campaign with campaignId — no creators, no budget field', async () => {
    const { service, post } = setupW2({ ...sampleW2Response, mode: 'campaign' });

    await service.runCampaign('camp-1', { genre: 'Music', subMode: 'Pop', objectives: ['Awareness'] });

    expect(post).toHaveBeenCalledOnce();
    const [name, payload] = post.mock.calls[0];
    expect(name).toBe('run-simulation');
    expect(payload).toEqual({
      mode: 'campaign',
      campaignId: 'camp-1',
      genre: 'Music',
      subMode: 'Pop',
      objectives: ['Awareness'],
    });
    expect(payload).not.toHaveProperty('creators');
    expect(payload).not.toHaveProperty('budget');
  });

  it('sends just campaignId when no overrides are supplied', async () => {
    const { service, post } = setupW2({ ...sampleW2Response, mode: 'campaign' });

    await service.runCampaign('camp-2');

    const payload = post.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toEqual({ mode: 'campaign', campaignId: 'camp-2' });
  });

  it('passes the response through typed, unmodified', async () => {
    const campaignResult = { ...sampleW2Response, mode: 'campaign' as const };
    const { service } = setupW2(campaignResult);
    const result = await service.runCampaign('camp-1');
    expect(result).toEqual(campaignResult);
  });

  it('surfaces the error — rejects rather than swallowing to null', async () => {
    const post = vi.fn().mockRejectedValue(new Error('campaign not found'));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: EdgeClient, useValue: { post, get: vi.fn() } }],
    });
    const service = TestBed.inject(RunSimulationService);

    await expect(service.runCampaign('missing')).rejects.toThrow('campaign not found');
  });
});
