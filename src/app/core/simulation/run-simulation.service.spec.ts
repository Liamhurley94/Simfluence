import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { RunSimulationService } from './run-simulation.service';
import { EdgeClient } from '../api/edge.client';
import { W2Response } from './simulation-w2.types';

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
