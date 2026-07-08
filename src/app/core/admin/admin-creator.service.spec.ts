import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminCreatorService } from './admin-creator.service';
import { EdgeClient } from '../api/edge.client';

describe('AdminCreatorService', () => {
  let post: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;
  let svc: AdminCreatorService;

  beforeEach(() => {
    post = vi.fn().mockResolvedValue({ created: [] });
    get = vi.fn().mockResolvedValue({ added: [], offline: [] });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [AdminCreatorService, { provide: EdgeClient, useValue: { post, get } }],
    });
    svc = TestBed.inject(AdminCreatorService);
  });

  it('addCreators POSTs admin-add-creator wrapping inputs in { creators }', async () => {
    const input = { name: 'A', genre: 'Gaming', platforms: { youtube: 'foo' } };
    await svc.addCreators([input]);
    expect(post).toHaveBeenCalledWith('admin-add-creator', { creators: [input] });
  });

  it('listCreators GETs admin-list-creators', async () => {
    await svc.listCreators();
    expect(get).toHaveBeenCalledWith('admin-list-creators');
  });

  it('resyncCreator POSTs admin-resync-creator with creatorId + platform', async () => {
    await svc.resyncCreator(9, 'YouTube');
    expect(post).toHaveBeenCalledWith('admin-resync-creator', { creatorId: 9, platform: 'YouTube' });
  });
});
