import { Injectable, signal } from '@angular/core';

/**
 * Shared campaign context used by Scoring, Simulator, etc.
 * Holds the "active" genre + sub-mode that server-side scoring/simulation
 * endpoints need.
 */
@Injectable({ providedIn: 'root' })
export class CampaignContextService {
  readonly genre = signal<string>('Gaming & Esports');
  readonly subMode = signal<string>('');
  readonly secondaryGenres = signal<string[]>([]);

  /** Set the active campaign genre, clearing sub-mode when the genre actually
   *  changes (sub-mode labels are genre-specific, so a carried-over sub-mode
   *  would be stale). */
  setGenre(g: string): void {
    if (this.genre() !== g) this.subMode.set('');
    this.genre.set(g);
  }
}
