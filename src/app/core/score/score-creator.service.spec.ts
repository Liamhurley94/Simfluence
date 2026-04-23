import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ScoreCreatorService } from './score-creator.service';
import { EdgeClient } from '../api/edge.client';
import { Creator } from '../data/creator.types';

const SAMPLE: Creator = {
  id: 42,
  name: 'Test',
  handle: '@t',
  platform: 'YouTube',
  allPlatforms: ['YouTube'],
  subs: '100K',
  avgViews: '20K',
  eng: '3.0%',
  genre: 'Gaming & Esports',
  cpi: 75,
  gfi: 60,
  color: '#00C46A',
  verifiedDeals: 1,
  sponsorHistory: [],
  bio: 'bio',
};

function setup(postResult: unknown = { results: [] }) {
  const post = vi.fn().mockResolvedValue(postResult);
  const edgeStub = { post, get: vi.fn() } as unknown as EdgeClient;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: EdgeClient, useValue: edgeStub }],
  });

  return { service: TestBed.inject(ScoreCreatorService), post };
}

describe('ScoreCreatorService', () => {
  beforeEach(() => {
    // noop
  });

  it('posts to score-creator with the correct payload shape', async () => {
    const { service, post } = setup({ results: [] });
    await service.scoreBulk({
      creators: [SAMPLE],
      campaignGenre: 'Gaming & Esports',
      subMode: 'ARPG',
      secondaryGenres: ['Tech'],
    });

    expect(post).toHaveBeenCalledOnce();
    const [name, payload] = post.mock.calls[0];
    expect(name).toBe('score-creator');

    const body = payload as {
      creators: Array<Record<string, unknown>>;
      campaignGenre: string;
      subMode: string;
      secondaryGenres: string[];
    };
    expect(body.campaignGenre).toBe('Gaming & Esports');
    expect(body.subMode).toBe('ARPG');
    expect(body.secondaryGenres).toEqual(['Tech']);

    const c = body.creators[0];
    expect(c['id']).toBe('42'); // stringified
    expect(c['cpi']).toBe('75');
    expect(c['verifiedDeals']).toBe('1');
    expect(c['language']).toBe('English');
    expect(c['genre']).toBe('Gaming & Esports');
    expect(c['name']).toBe('Test');
  });

  it('defaults campaignGenre when empty string', async () => {
    const { service, post } = setup({ results: [] });
    await service.scoreBulk({ creators: [SAMPLE], campaignGenre: '' });
    const body = post.mock.calls[0][1] as { campaignGenre: string };
    expect(body.campaignGenre).toBe('Gaming & Esports');
  });

  it('caches GFI scores from the response', async () => {
    const { service } = setup({
      results: [{ id: 42, gfi: 88 }],
    });
    const map = await service.scoreBulk({
      creators: [SAMPLE],
      campaignGenre: 'Gaming & Esports',
    });
    expect(map.get(42)).toBe(88);
    expect(service.getGfi(42)).toBe(88);
  });

  it('caches CPI breakdown when the edge function returns one', async () => {
    const breakdown = {
      factors: [{ label: 'Eng', value: '3%', score: 20, max: 35, note: '' }],
    };
    const { service } = setup({
      results: [{ id: 42, gfi: 88, cpiBreakdown: breakdown }],
    });
    await service.scoreBulk({ creators: [SAMPLE], campaignGenre: 'Gaming & Esports' });
    expect(service.getBreakdown(42)).toEqual(breakdown);
  });

  it('normalises string ids in the response back to numbers', async () => {
    const { service } = setup({
      results: [{ id: '42', gfi: 88 }],
    });
    await service.scoreBulk({ creators: [SAMPLE], campaignGenre: 'Gaming & Esports' });
    expect(service.getGfi(42)).toBe(88);
  });

  it('clear() empties both caches and bumps the version signal', async () => {
    const { service } = setup({
      results: [{ id: 42, gfi: 88, cpiBreakdown: { factors: [] } }],
    });
    await service.scoreBulk({ creators: [SAMPLE], campaignGenre: 'Gaming & Esports' });
    expect(service.getGfi(42)).toBe(88);

    const before = service.version();
    service.clear();
    expect(service.getGfi(42)).toBeUndefined();
    expect(service.getBreakdown(42)).toBeUndefined();
    expect(service.version()).toBeGreaterThan(before);
  });

  it('pending signal is true during in-flight request, false after', async () => {
    let resolveIt!: (v: unknown) => void;
    const post = vi.fn().mockImplementationOnce(
      () => new Promise((res) => (resolveIt = res)),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: EdgeClient, useValue: { post, get: vi.fn() } }],
    });
    const service = TestBed.inject(ScoreCreatorService);

    const promise = service.scoreBulk({
      creators: [SAMPLE],
      campaignGenre: 'Gaming & Esports',
    });
    expect(service.pending()).toBe(true);
    resolveIt({ results: [] });
    await promise;
    expect(service.pending()).toBe(false);
  });
});
