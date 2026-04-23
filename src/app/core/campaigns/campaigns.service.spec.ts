import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignsService } from './campaigns.service';
import { CampaignsRepository } from './campaigns.repository';
import { Campaign, NewCampaign } from './campaign.types';

function sampleCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'cmp-1',
    name: 'Alpha',
    client: 'Acme',
    genre: 'Gaming',
    budget: 50_000,
    goLiveDate: null,
    notes: '',
    creatorIds: [],
    forecast: null,
    createdAt: '2026-04-23T10:00:00.000Z',
    updatedAt: '2026-04-23T10:00:00.000Z',
    ...overrides,
  };
}

type FakeRepo = {
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

function setup(): { service: CampaignsService; repo: FakeRepo } {
  const repo: FakeRepo = {
    list: vi.fn().mockResolvedValue([]),
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

    const dto: NewCampaign = {
      name: 'N',
      client: '',
      genre: '',
      budget: 1,
      goLiveDate: null,
      notes: '',
      creatorIds: [],
      forecast: null,
    };
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

    // Success path
    await service.remove('a');
    expect(service.campaigns().map((c) => c.id)).toEqual(['b']);

    // Failure path — ensure rollback
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
});
