import { Injectable, signal } from '@angular/core';

/**
 * Shared campaign context used by Scoring, Simulator, Personas, etc.
 * Holds the "active" genre + sub-mode that server-side scoring/simulation
 * endpoints need.
 */
@Injectable({ providedIn: 'root' })
export class CampaignContextService {
  readonly genre = signal<string>('Gaming & Esports');
  readonly subMode = signal<string>('');
  readonly secondaryGenres = signal<string[]>([]);
}
