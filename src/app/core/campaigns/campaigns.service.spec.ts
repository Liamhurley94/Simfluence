import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignsService } from './campaigns.service';
import { CampaignsRepository } from './campaigns.repository';
import { Campaign, NewCampaign } from './campaign.types';

function sampleCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'cmp-1',
    createdBy: 'user-1',
    enterpriseId: null,
    status: 'planning',
    name: 'Alpha',
    client: 'Acme',
    genre: 'Gaming',
    budget: 50_000,
    notes: null,
    objectives: [],
    forecast: null,
    startedAt: null,
    completedAt: null,
    createdAt: '2026-04-23T10:00:00.000Z',
    updatedAt: '2026-04-23T10:00:00.000Z',
    ...overrides,
  };
}

type FakeRepo = {
  list: ReturnType<typeof vi.fn>;
  byId: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

function setup(): { service: CampaignsService; repo: FakeRepo } {
  const repo: FakeRepo = {
    list: vi.fn().mockResolvedValue([]),
    byId: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn().mockResolvedValue(undefined),
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CampaignsRepository, useValue: repo as unknown as CampaignsRepository },
    ],
  });

  return { service: TestBed.inject(CampaignsService), repo };
}

describe('CampaignsService', () => {
  beforeEach(() => {
    /* noop */
  });

  it('load() populates the campaigns signal', async () => {
    const { service, repo } = setup();
    repo.list.mockResolvedValueOnce([sampleCampaign({ id: 'a' })]);
    await service.load();
    expect(service.campaigns()[0].id).toBe('a');
  });

  it('load() surfaces repo errors into the error signal', async () => {
    const { service, repo } = setup();
    repo.list.mockRejectedValueOnce(new Error('db down'));
    await service.load();
    expect(service.error()).toBe('db down');
  });

  it('create() prepends the new row to the campaigns signal', async () => {
    const { service, repo } = setup();
    await service.load();
    const created = sampleCampaign({ id: 'new' });
    repo.create.mockResolvedValueOnce(created);

    const dto: NewCampaign = { name: 'N' };
    await service.create(dto);
    expect(service.campaigns()[0].id).toBe('new');
  });

  it('update() replaces the matching row', async () => {
    const { service, repo } = setup();
    repo.list.mockResolvedValueOnce([sampleCampaign({ id: 'a', name: 'Old' })]);
    await service.load();
    repo.update.mockResolvedValueOnce(sampleCampaign({ id: 'a', name: 'New' }));

    await service.update('a', { name: 'New' });
    expect(service.campaigns()[0].name).toBe('New');
  });

  it('remove() optimistically drops the row; rolls back on repo failure', async () => {
    const { service, repo } = setup();
    repo.list.mockResolvedValueOnce([
      sampleCampaign({ id: 'a' }),
      sampleCampaign({ id: 'b' }),
    ]);
    await service.load();

    await service.remove('a');
    expect(service.campaigns().map((c) => c.id)).toEqual(['b']);

    repo.remove.mockRejectedValueOnce(new Error('conflict'));
    await service.remove('b');
    expect(service.campaigns().map((c) => c.id)).toEqual(['b']);
    expect(service.error()).toBe('conflict');
  });

  it('byId finds a campaign by its id', async () => {
    const { service, repo } = setup();
    repo.list.mockResolvedValueOnce([sampleCampaign({ id: 'a' })]);
    await service.load();
    expect(service.byId('a')?.id).toBe('a');
    expect(service.byId('missing')).toBeUndefined();
  });

  it('byIdAsync falls back to repo.byId when not cached', async () => {
    const { service, repo } = setup();
    const fetched = sampleCampaign({ id: 'remote' });
    repo.byId.mockResolvedValueOnce(fetched);
    const got = await service.byIdAsync('remote');
    expect(got?.id).toBe('remote');
    expect(repo.byId).toHaveBeenCalledWith('remote');
  });

  it('start() transitions planning → active and sets startedAt', async () => {
    const { service, repo } = setup();
    repo.update.mockImplementationOnce(async (id: string, patch: { status: string; startedAt: string }) => {
      return sampleCampaign({ id, status: 'active', startedAt: patch.startedAt });
    });
    const updated = await service.start('a');
    expect(updated?.status).toBe('active');
    expect(updated?.startedAt).toBeTruthy();
  });
});
