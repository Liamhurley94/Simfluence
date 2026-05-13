import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PersonasService } from './personas.service';
import { CreatorsService } from '../creators/creators.service';
import { Creator } from '../data/creator.types';

function mkCreator(id: number, genre: string, cpi: number): Creator {
  return {
    id,
    name: `c${id}`,
    handle: `@c${id}`,
    platform: 'YouTube',
    subs: '100K',
    subsParsed: 100_000,
    avgViews: '20K',
    eng: '3%',
    genre,
    cpi,
    gfi: 70,
    color: '#fff',
    verifiedDeals: 1,
    sponsorHistory: [],
    bio: '',
  };
}

describe('PersonasService', () => {
  let svc: PersonasService;
  let listSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Stub CreatorsService.list so PersonasService.autoSelect can be exercised
    // without booting Supabase.
    listSpy = vi.fn(async ({ genre }: { genre?: string }, _sort, _page, count: number) => ({
      creators: Array.from({ length: count }, (_, i) =>
        mkCreator(i + 1, genre ?? 'Unknown', 100 - i),
      ),
      total: count,
      pageCount: 1,
      page: 0,
    }));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: CreatorsService, useValue: { list: listSpy } }],
    });
    svc = TestBed.inject(PersonasService);
  });

  describe('listFor', () => {
    it('returns sub-mode list when present', () => {
      const list = svc.listFor('Gaming & Esports', 'RPG / Open World');
      expect(list.length).toBeGreaterThan(0);
      expect(list.some((p) => p.name === 'The Lore Keeper')).toBe(true);
    });

    it('falls back to the genre default when sub-mode is missing', () => {
      const list = svc.listFor('Gaming & Esports', 'does-not-exist');
      expect(list.length).toBeGreaterThan(0);
      expect(list.some((p) => p.name === 'The Enthusiast')).toBe(true);
    });

    it('falls back to genre default when no sub-mode passed', () => {
      const list = svc.listFor('Beauty & Skincare');
      expect(list.length).toBeGreaterThan(0);
      expect(list.some((p) => p.name === 'The Skincare Devotee')).toBe(true);
    });

    it('returns an empty list (or global default) for an unknown genre', () => {
      const list = svc.listFor('Totally Fake Genre');
      expect(Array.isArray(list)).toBe(true);
    });
  });

  describe('genres', () => {
    it('lists persona genres, excluding the internal `default` entry', () => {
      const genres = svc.genres();
      expect(genres).toContain('Gaming & Esports');
      expect(genres).not.toContain('default');
    });
  });

  describe('autoSelect', () => {
    it('delegates to CreatorsService.list with genre + cpi sort + requested count', async () => {
      const picks = await svc.autoSelect('Gaming & Esports', 10);
      expect(listSpy).toHaveBeenCalledWith({ genre: 'Gaming & Esports' }, 'cpi', 0, 10);
      expect(picks.length).toBe(10);
    });

    it('short-circuits to [] for count ≤ 0 (no DB call)', async () => {
      expect(await svc.autoSelect('Gaming & Esports', 0)).toEqual([]);
      expect(await svc.autoSelect('Gaming & Esports', -5)).toEqual([]);
      expect(listSpy).not.toHaveBeenCalled();
    });
  });
});
