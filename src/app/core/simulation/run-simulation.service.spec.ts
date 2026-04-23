import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RunSimulationService } from './run-simulation.service';
import { EdgeClient } from '../api/edge.client';
import { Creator } from '../data/creator.types';
import { SimInputs } from './simulation.types';

const sampleCreator: Creator = {
  id: 42,
  name: 'Test',
  handle: '@t',
  platform: 'YouTube',
  allPlatforms: ['YouTube'],
  subs: '100K',
  avgViews: '20K',
  eng: '3.0%',
  genre: 'Gaming & Esports',
  cpi: 80,
  gfi: 75,
  color: '#fff',
  verifiedDeals: 1,
  sponsorHistory: [],
  bio: 'bio',
  realCVR: 1.2,
};

const sampleInputs: SimInputs = {
  creators: [sampleCreator],
  budget: 50_000,
  format: 'Dedicated',
  genre: 'Gaming & Esports',
  objectives: ['Direct Sales'],
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
    expect(c['gfi']).toBe('75');
    expect(c['language']).toBe('English');
    expect(c['realCVR']).toBe('1.2');
    expect(c['realCPA']).toBeUndefined();
    expect(body.budget).toBe(50_000);
    expect(body.format).toBe('Dedicated');
    expect(body.subMode).toBe('RPG / Open World');
    expect(body.objectives).toEqual(['Direct Sales']);
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
});
