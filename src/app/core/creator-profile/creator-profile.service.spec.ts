import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CreatorProfileService } from './creator-profile.service';
import { CreatorsService } from '../creators/creators.service';
import { Creator } from '../data/creator.types';

function makeCreator(id: number): Creator {
  return {
    id, name: `Creator ${id}`, handle: `@c${id}`, platform: 'YouTube',
    allPlatforms: ['YouTube'], subs: '10K', subsParsed: 10_000,
    avgViews: '1K', eng: '2%', genre: 'Gaming', cpi: 60, gfi: null,
    color: '#000', verifiedDeals: 0, sponsorHistory: [], bio: '',
  };
}

function setup(byIdImpl: (id: number) => Promise<Creator | undefined>) {
  const byId = vi.fn(byIdImpl);
  const creatorsStub = { byId } as unknown as CreatorsService;
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: CreatorsService, useValue: creatorsStub }],
  });
  return { svc: TestBed.inject(CreatorProfileService), byId };
}

describe('CreatorProfileService', () => {
  it('open() sets current() synchronously to the thin creator', () => {
    const thin = makeCreator(1);
    const { svc } = setup(() => Promise.resolve(undefined));
    svc.open(thin);
    expect(svc.current()).toBe(thin);
  });

  it('open() hydrates current() with the full creator after byId resolves', async () => {
    const thin = makeCreator(1);
    const full = { ...makeCreator(1), bio: 'full bio' };
    const { svc } = setup(() => Promise.resolve(full));
    svc.open(thin);
    await Promise.resolve(); // let the microtask queue flush
    expect(svc.current()).toBe(full);
  });

  it('open() does NOT apply hydration when byId returns undefined', async () => {
    const thin = makeCreator(1);
    const { svc } = setup(() => Promise.resolve(undefined));
    svc.open(thin);
    await Promise.resolve();
    expect(svc.current()).toBe(thin);
  });

  it('open() discards a late byId result if a different creator was opened', async () => {
    let resolve1!: (v: Creator | undefined) => void;
    const p1 = new Promise<Creator | undefined>((r) => { resolve1 = r; });
    const byId = vi.fn((id: number) => id === 1 ? p1 : Promise.resolve(makeCreator(id)));
    const creatorsStub = { byId } as unknown as CreatorsService;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: CreatorsService, useValue: creatorsStub }] });
    const svc = TestBed.inject(CreatorProfileService);

    const creator1 = makeCreator(1);
    const creator2 = makeCreator(2);
    svc.open(creator1); // starts pending byId(1)
    svc.open(creator2); // switches to creator2; byId(2) resolves quickly
    await Promise.resolve(); await Promise.resolve(); // flush byId(2) microtask

    // Now resolve byId(1) late
    resolve1({ ...creator1, bio: 'late hydration' });
    await Promise.resolve();

    // current() should still be creator2 (or its hydrated version), NOT creator1
    expect(svc.current()?.id).toBe(2);
  });

  it('close() sets current() to null', () => {
    const { svc } = setup(() => Promise.resolve(undefined));
    svc.open(makeCreator(1));
    svc.close();
    expect(svc.current()).toBeNull();
  });

  it('open() guard: does not apply hydration if close() was called before byId resolves', async () => {
    let resolve!: (v: Creator | undefined) => void;
    const p = new Promise<Creator | undefined>((r) => { resolve = r; });
    const byId = vi.fn(() => p);
    const creatorsStub = { byId } as unknown as CreatorsService;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: CreatorsService, useValue: creatorsStub }] });
    const svc = TestBed.inject(CreatorProfileService);

    svc.open(makeCreator(5));
    svc.close(); // close before byId resolves
    resolve(makeCreator(5));
    await Promise.resolve();
    expect(svc.current()).toBeNull();
  });
});
