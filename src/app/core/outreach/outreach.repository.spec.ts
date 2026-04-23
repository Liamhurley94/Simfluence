import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryOutreachRepository } from './outreach.repository';
import { NewOutreachRecord } from './outreach.types';

function dto(overrides: Partial<NewOutreachRecord> = {}): NewOutreachRecord {
  return {
    creatorId: 42,
    campaignId: null,
    status: 'shortlisted',
    contact: '',
    notes: '',
    lastContactAt: null,
    ...overrides,
  };
}

describe('InMemoryOutreachRepository', () => {
  let repo: InMemoryOutreachRepository;

  beforeEach(() => {
    repo = new InMemoryOutreachRepository();
  });

  it('list() starts empty', async () => {
    expect(await repo.list()).toEqual([]);
  });

  it('create() round-trips through list() with newest first', async () => {
    const a = await repo.create(dto({ creatorId: 1 }));
    await new Promise((r) => setTimeout(r, 2));
    const b = await repo.create(dto({ creatorId: 2 }));
    const all = await repo.list();
    expect(all.map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it('update() merges a partial patch and bumps updatedAt', async () => {
    const created = await repo.create(dto());
    await new Promise((r) => setTimeout(r, 2));
    const updated = await repo.update(created.id, { status: 'contacted', notes: 'hi' });
    expect(updated.status).toBe('contacted');
    expect(updated.notes).toBe('hi');
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).not.toBe(created.updatedAt);
  });

  it('update() throws for an unknown id', async () => {
    await expect(repo.update('nope', { status: 'contacted' })).rejects.toThrow();
  });

  it('remove() deletes; unknown id is a silent no-op', async () => {
    const created = await repo.create(dto());
    await repo.remove(created.id);
    expect(await repo.list()).toEqual([]);
    await expect(repo.remove('ghost')).resolves.toBeUndefined();
  });
});
