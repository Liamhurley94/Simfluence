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

  it('openById() sets loading and clears current until byId resolves', async () => {
    let resolve!: (v: Creator | undefined) => void;
    const p = new Promise<Creator | undefined>((r) => { resolve = r; });
    const { svc } = setup(() => p);

    svc.open(makeCreator(3));        // something already on screen
    void svc.openById(9);
    expect(svc.loading()).toBe(true);
    expect(svc.current()).toBeNull(); // stale creator cleared, skeleton shows

    resolve(makeCreator(9));
    await Promise.resolve(); await Promise.resolve();
    expect(svc.loading()).toBe(false);
    expect(svc.current()?.id).toBe(9);
  });

  it('openById() leaves the modal closed when byId returns undefined', async () => {
    const { svc } = setup(() => Promise.resolve(undefined));
    await svc.openById(404);
    expect(svc.current()).toBeNull();
    expect(svc.loading()).toBe(false);
  });

  it('openById() discards a late result once close() has been called', async () => {
    let resolve!: (v: Creator | undefined) => void;
    const p = new Promise<Creator | undefined>((r) => { resolve = r; });
    const { svc } = setup(() => p);

    void svc.openById(7);
    svc.close();
    expect(svc.loading()).toBe(false);

    resolve(makeCreator(7));
    await Promise.resolve(); await Promise.resolve();
    // Must NOT re-open the modal the user just closed.
    expect(svc.current()).toBeNull();
  });

  it('openById() twice for the SAME id: the first response cannot satisfy the second', async () => {
    // Guards against using the creator id as the request token — open, close,
    // re-open the same creator, and both requests would carry the same id.
    const resolvers: ((v: Creator | undefined) => void)[] = [];
    const byId = vi.fn(() => new Promise<Creator | undefined>((r) => { resolvers.push(r); }));
    const creatorsStub = { byId } as unknown as CreatorsService;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: CreatorsService, useValue: creatorsStub }] });
    const svc = TestBed.inject(CreatorProfileService);

    void svc.openById(5);
    void svc.openById(5); // second click supersedes the first

    resolvers[0](makeCreator(5)); // first (stale) response lands
    await Promise.resolve(); await Promise.resolve();
    expect(svc.loading()).toBe(true);   // still waiting on the second request
    expect(svc.current()).toBeNull();

    resolvers[1](makeCreator(5));
    await Promise.resolve(); await Promise.resolve();
    expect(svc.loading()).toBe(false);
    expect(svc.current()?.id).toBe(5);
  });

  it('open() after an in-flight openById() wins — the older fetch cannot stomp it', async () => {
    let resolveSlow!: (v: Creator | undefined) => void;
    const slow = new Promise<Creator | undefined>((r) => { resolveSlow = r; });
    const byId = vi.fn((id: number) => id === 1 ? slow : Promise.resolve(undefined));
    const creatorsStub = { byId } as unknown as CreatorsService;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: CreatorsService, useValue: creatorsStub }] });
    const svc = TestBed.inject(CreatorProfileService);

    void svc.openById(1);
    svc.open(makeCreator(2));
    expect(svc.loading()).toBe(false); // open() clears the skeleton

    resolveSlow(makeCreator(1));
    await Promise.resolve(); await Promise.resolve();
    expect(svc.current()?.id).toBe(2);
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
