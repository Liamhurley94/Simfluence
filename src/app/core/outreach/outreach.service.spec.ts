import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OutreachService } from './outreach.service';
import { OutreachRepository } from './outreach.repository';
import { NewOutreachRecord, OutreachRecord } from './outreach.types';

function record(overrides: Partial<OutreachRecord> = {}): OutreachRecord {
  return {
    id: 'id-1',
    creatorId: 1,
    campaignId: null,
    status: 'shortlisted',
    contact: '',
    notes: '',
    lastContactAt: null,
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

function setup(): { service: OutreachService; repo: FakeRepo } {
  const repo: FakeRepo = {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: OutreachRepository, useValue: repo as unknown as OutreachRepository },
    ],
  });
  return { service: TestBed.inject(OutreachService), repo };
}

describe('OutreachService', () => {
  beforeEach(() => {
    /* noop */
  });

  it('load() populates records signal and byStatus counts', async () => {
    const { service, repo } = setup();
    repo.list.mockResolvedValueOnce([
      record({ id: 'a', status: 'shortlisted' }),
      record({ id: 'b', status: 'contacted' }),
      record({ id: 'c', status: 'shortlisted' }),
    ]);
    await service.load();
    expect(service.records().length).toBe(3);
    expect(service.byStatus().shortlisted).toBe(2);
    expect(service.byStatus().contacted).toBe(1);
    expect(service.byStatus().declined).toBe(0);
  });

  it('filtered applies status and campaignId filters', async () => {
    const { service, repo } = setup();
    repo.list.mockResolvedValueOnce([
      record({ id: 'a', status: 'shortlisted', campaignId: null }),
      record({ id: 'b', status: 'contacted', campaignId: 'cmp-1' }),
      record({ id: 'c', status: 'contacted', campaignId: 'cmp-2' }),
      record({ id: 'd', status: 'declined', campaignId: 'cmp-1' }),
    ]);
    await service.load();

    service.setFilter({ status: 'contacted' });
    expect(service.filtered().map((r) => r.id)).toEqual(['b', 'c']);

    service.setFilter({ campaignId: 'cmp-1' });
    expect(service.filtered().map((r) => r.id)).toEqual(['b', 'd']);

    service.setFilter({ campaignId: null });
    expect(service.filtered().map((r) => r.id)).toEqual(['a']);

    service.setFilter({ campaignId: 'cmp-1', status: 'declined' });
    expect(service.filtered().map((r) => r.id)).toEqual(['d']);
  });

  it('create() prepends to records', async () => {
    const { service, repo } = setup();
    await service.load();
    const created = record({ id: 'new' });
    repo.create.mockResolvedValueOnce(created);
    const dto: NewOutreachRecord = {
      creatorId: 1,
      campaignId: null,
      status: 'shortlisted',
      contact: '',
      notes: '',
      lastContactAt: null,
    };
    await service.create(dto);
    expect(service.records()[0].id).toBe('new');
  });

  it('update() replaces the matching record', async () => {
    const { service, repo } = setup();
    repo.list.mockResolvedValueOnce([record({ id: 'a', status: 'shortlisted' })]);
    await service.load();
    repo.update.mockResolvedValueOnce(record({ id: 'a', status: 'contacted' }));
    await service.update('a', { status: 'contacted' });
    expect(service.records()[0].status).toBe('contacted');
    expect(service.byStatus().shortlisted).toBe(0);
    expect(service.byStatus().contacted).toBe(1);
  });

  it('remove() optimistically drops the row; rolls back on repo error', async () => {
    const { service, repo } = setup();
    repo.list.mockResolvedValueOnce([record({ id: 'a' }), record({ id: 'b' })]);
    await service.load();

    await service.remove('a');
    expect(service.records().map((r) => r.id)).toEqual(['b']);

    repo.remove.mockRejectedValueOnce(new Error('conflict'));
    await service.remove('b');
    expect(service.records().map((r) => r.id)).toEqual(['b']);
    expect(service.error()).toBe('conflict');
  });
});
