import { Injectable, signal } from '@angular/core';
import { Creator } from '../data/creator.types';

// Tiny state holder for the creator profile modal — mirrors UpgradePromptService.
// One instance lives in the app; CreatorProfileModalComponent reacts to `current`.
@Injectable({ providedIn: 'root' })
export class CreatorProfileService {
  readonly current = signal<Creator | null>(null);

  open(creator: Creator): void {
    this.current.set(creator);
  }

  close(): void {
    this.current.set(null);
  }
}
