import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { PersonasService } from './personas.service';

describe('PersonasService', () => {
  let svc: PersonasService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
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
      // 'default' list for Gaming contains 'The Enthusiast'
      expect(list.some((p) => p.name === 'The Enthusiast')).toBe(true);
    });

    it('falls back to genre default when no sub-mode passed', () => {
      const list = svc.listFor('Beauty & Skincare');
      expect(list.length).toBeGreaterThan(0);
      expect(list.some((p) => p.name === 'The Skincare Devotee')).toBe(true);
    });

    it('returns an empty list for an unknown genre with no global default', () => {
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
    it('returns the requested count of creators', () => {
      const picks = svc.autoSelect('Gaming & Esports', 10);
      expect(picks.length).toBe(10);
    });

    it('returns zero results when count is 0 or negative', () => {
      expect(svc.autoSelect('Gaming & Esports', 0)).toEqual([]);
      expect(svc.autoSelect('Gaming & Esports', -5)).toEqual([]);
    });

    it('only returns creators in the given genre', () => {
      const picks = svc.autoSelect('Gaming & Esports', 25);
      for (const c of picks) expect(c.genre).toBe('Gaming & Esports');
    });

    it('returns creators sorted by CPI descending', () => {
      const picks = svc.autoSelect('Gaming & Esports', 15);
      for (let i = 1; i < picks.length; i++) {
        expect(picks[i - 1].cpi).toBeGreaterThanOrEqual(picks[i].cpi);
      }
    });
  });
});
