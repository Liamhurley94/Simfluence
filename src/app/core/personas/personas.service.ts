import { Injectable, inject } from '@angular/core';
import rawPersonas from '../data/personas.data.json';
import { GenrePersonas, Persona } from '../data/persona.types';
import { CreatorsService } from '../creators/creators.service';
import { Creator } from '../data/creator.types';

const PERSONAS = rawPersonas as unknown as GenrePersonas;

@Injectable({ providedIn: 'root' })
export class PersonasService {
  private creators = inject(CreatorsService);

  /**
   * Returns personas for a genre + optional sub-mode, falling back to the
   * genre's `default` list, then the global `default` entry if neither matches.
   */
  listFor(genre: string, subMode?: string): Persona[] {
    const byGenre = PERSONAS[genre];
    if (byGenre) {
      if (subMode && Array.isArray(byGenre[subMode])) return byGenre[subMode];
      if (Array.isArray(byGenre['default'])) return byGenre['default'];
    }
    const defaultGenre = PERSONAS['default'];
    if (defaultGenre && Array.isArray(defaultGenre['default'])) {
      return defaultGenre['default'];
    }
    return [];
  }

  /** All genres that have persona definitions. */
  genres(): string[] {
    return Object.keys(PERSONAS).filter((k) => k !== 'default');
  }

  /**
   * Pick the top `count` creators in a genre by CPI (matches Discovery's
   * default sort). If the genre yields fewer than `count`, returns all.
   */
  autoSelect(genre: string, count: number): Creator[] {
    if (count <= 0) return [];
    return this.creators.list({ genre }, 'cpi', 0, count).creators;
  }
}
