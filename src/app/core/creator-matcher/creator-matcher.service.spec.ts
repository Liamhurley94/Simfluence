import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { CreatorMatcherService } from './creator-matcher.service';
import { EdgeClient } from '../api/edge.client';

function setup(postResult: unknown) {
  const post = vi.fn().mockResolvedValue(postResult);
  const edgeStub = { post, get: vi.fn() } as unknown as EdgeClient;
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: EdgeClient, useValue: edgeStub }],
  });
  return { service: TestBed.inject(CreatorMatcherService), post };
}

const sampleResult = {
  optimizedFor: 'fit' as const,
  budgetConstrained: true,
  budget: 50_000,
  creators: [
    {
      creator: { id: 7, name: 'Nova', handle: 'nova', platform: 'YouTube' },
      best_cpi: 88,
      gfi: 91,
      reach: 1_200_000,
      rateEstimate: { ranges: { int: [1000, 2000], ded: [1500, 3000], mix: [1250, 2500] } },
      why: 'CPI 88 · GFI 91',
    },
  ],
};

describe('CreatorMatcherService', () => {
  it('posts to match-creators with genre/budget/objectives/excludeIds/limit and NO strategy', async () => {
    const { service, post } = setup(sampleResult);

    await service.match({
      genre: 'Gaming & Esports',
      budget: 50_000,
      objectives: ['Sales'],
      excludeIds: [1, 2, 3],
      limit: 12,
    });

    expect(post).toHaveBeenCalledOnce();
    const [name, payload] = post.mock.calls[0];
    expect(name).toBe('match-creators');

    const body = payload as Record<string, unknown>;
    expect(body).toEqual({
      genre: 'Gaming & Esports',
      budget: 50_000,
      objectives: ['Sales'],
      excludeIds: [1, 2, 3],
      limit: 12,
    });
    // The backend derives the strategy — the client never sends one.
    expect('strategy' in body).toBe(false);
  });

  it('parses the response into a MatchResult', async () => {
    const { service } = setup(sampleResult);

    const result = await service.match({ genre: 'Gaming & Esports' });

    expect(result.optimizedFor).toBe('fit');
    expect(result.budgetConstrained).toBe(true);
    expect(result.budget).toBe(50_000);
    expect(result.creators).toHaveLength(1);
    const item = result.creators[0];
    expect(item.creator.id).toBe(7);
    expect(item.best_cpi).toBe(88);
    expect(item.gfi).toBe(91);
    expect(item.reach).toBe(1_200_000);
    expect(item.why).toBe('CPI 88 · GFI 91');
  });

  it('omits optional fields from the payload when not provided', async () => {
    const { service, post } = setup(sampleResult);

    await service.match({ genre: 'Beauty & Fashion' });

    const [, payload] = post.mock.calls[0];
    expect(payload).toEqual({ genre: 'Beauty & Fashion' });
  });

  it('returns an empty result when the edge fn errors', async () => {
    const { service } = setup({ error: 'Could not fetch creator pool' });

    const result = await service.match({ genre: 'Gaming & Esports' });

    expect(result.creators).toEqual([]);
    expect(result.budgetConstrained).toBe(false);
    expect(result.budget).toBeNull();
  });

  it('returns an empty result when the HTTP call rejects', async () => {
    const post = vi.fn().mockRejectedValue(new Error('network down'));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: EdgeClient, useValue: { post, get: vi.fn() } }],
    });
    const service = TestBed.inject(CreatorMatcherService);

    const result = await service.match({ genre: 'Gaming & Esports' });

    expect(result.creators).toEqual([]);
  });
});
