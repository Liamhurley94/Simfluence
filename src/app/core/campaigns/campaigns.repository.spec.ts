import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryCampaignsRepository } from './campaigns.repository';
import { NewCampaign } from './campaign.types';

function dto(overrides: Partial<NewCampaign> = {}): NewCampaign {
  return {
    name: 'Test Campaign',
    client: 'Acme',
    genre: 'Gaming & Esports',
    budget: 50_000,
    goLiveDate: '2026-05-01',
    notes: '',
    creatorIds: [1, 2, 3],
    forecast: null,
    ...overrides,
  };
}

describe('InMemoryCampaignsRepository', () => {
  let repo: InMemoryCampaignsRepository;

  beforeEach(() => {
    repo = new InMemoryCampaignsRepository();
  });

  it('list() starts empty', async () => {
    expect(await repo.list()).toEqual([]);
  });

  it('create() assigns an id and timestamps, then round-trips through list()', async () => {
    const created = await repo.create(dto({ name: 'Alpha' }));
    expect(created.id).toBeTruthy();
    expect(typeof created.createdAt).toBe('string');
    expect(created.updatedAt).toBe(created.createdAt);

    const all = await repo.list();
    expect(all.length).toBe(1);
    expect(all[0].name).toBe('Alpha');
  });

  it('list() orders newest first by createdAt', async () => {
    const a = await repo.create(dto({ name: 'A' }));
    await new Promise((r) => setTimeout(r, 2));
    const b = await repo.create(dto({ name: 'B' }));

    const all = await repo.list();
    expect(all[0].id).toBe(b.id);
    expect(all[1].id).toBe(a.id);
  });

  it('update() merges a partial patch and bumps updatedAt', async () => {
    const created = await repo.create(dto({ name: 'Original' }));
    const first = created.updatedAt;

    await new Promise((r) => setTimeout(r, 2));
    const updated = await repo.update(created.id, { name: 'Renamed', budget: 99_999 });

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.name).toBe('Renamed');
    expect(updated.budget).toBe(99_999);
    expect(updated.updatedAt).not.toBe(first);
  });

  it('update() throws for an unknown id', async () => {
    await expect(repo.update('nope', { name: 'x' })).rejects.toThrow();
  });

  it('remove() deletes an existing row', async () => {
    const created = await repo.create(dto());
    await repo.remove(created.id);
    expect(await repo.list()).toEqual([]);
  });

  it('remove() is a silent no-op for unknown ids', async () => {
    await expect(repo.remove('ghost')).resolves.toBeUndefined();
  });
});
