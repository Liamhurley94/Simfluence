import { Injectable } from '@angular/core';
import rawCreators from '../data/creators.data.json';
import { Creator, CreatorFilters, PagedCreators, SortKey } from '../data/creator.types';

// Bundled at build time, lives in memory for the life of the app.
// Cast through `unknown` so TS doesn't build a 6000-way union for the literal.
const CREATORS = rawCreators as unknown as Creator[];

function platformsOf(c: Creator): string[] {
  return c.allPlatforms?.length ? c.allPlatforms : [c.platform];
}

const DEFAULT_PAGE_SIZE = 24;

export function parseSubs(raw: string): number {
  if (!raw) return 0;
  const n = parseFloat(raw);
  if (isNaN(n)) return 0;
  if (/M/i.test(raw)) return n * 1_000_000;
  if (/K/i.test(raw)) return n * 1_000;
  return n;
}

@Injectable({ providedIn: 'root' })
export class CreatorsService {
  list(
    filters: CreatorFilters = {},
    sort: SortKey = 'cpi',
    page = 0,
    pageSize = DEFAULT_PAGE_SIZE,
  ): PagedCreators {
    let result = CREATORS.slice();

    if (filters.genre) {
      result = result.filter((c) => c.genre === filters.genre);
    }
    if (filters.platforms?.length) {
      const set = new Set(filters.platforms);
      result = result.filter((c) => platformsOf(c).some((p) => set.has(p)));
    }
    if (filters.languages?.length) {
      const set = new Set(filters.languages);
      result = result.filter((c) => set.has(c.language ?? 'English'));
    }
    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.handle.toLowerCase().includes(q) ||
          c.bio.toLowerCase().includes(q),
      );
    }

    result.sort((a, b) => {
      switch (sort) {
        case 'cpi':
          return b.cpi - a.cpi;
        case 'gfi':
          return b.gfi - a.gfi;
        case 'subs':
          return parseSubs(b.subs) - parseSubs(a.subs);
        case 'name':
          return a.name.localeCompare(b.name);
      }
    });

    const total = result.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(0, page), pageCount - 1);
    const start = safePage * pageSize;
    const creators = result.slice(start, start + pageSize);

    return { creators, total, pageCount, page: safePage };
  }

  byId(id: number): Creator | undefined {
    return CREATORS.find((c) => c.id === id);
  }

  byIds(ids: Iterable<number>): Creator[] {
    const set = new Set(ids);
    return CREATORS.filter((c) => set.has(c.id));
  }

  genres(): string[] {
    return Array.from(new Set(CREATORS.map((c) => c.genre))).sort();
  }

  platforms(): string[] {
    const set = new Set<string>();
    for (const c of CREATORS) for (const p of platformsOf(c)) set.add(p);
    return Array.from(set).sort();
  }

  languages(): string[] {
    const set = new Set<string>();
    for (const c of CREATORS) set.add(c.language ?? 'English');
    return Array.from(set).sort();
  }
}
