import { Injectable, inject, signal } from '@angular/core';
import { Creator } from '../data/creator.types';
import { CreatorsService } from '../creators/creators.service';

// Tiny state holder for the creator profile modal — mirrors UpgradePromptService.
// One instance lives in the app; CreatorProfileModalComponent reacts to `current`.
@Injectable({ providedIn: 'root' })
export class CreatorProfileService {
  private creators = inject(CreatorsService);

  readonly current = signal<Creator | null>(null);

  open(creator: Creator): void {
    // Show instantly with whatever the caller passed, then hydrate the full
    // record via byId. Show-all Discovery cards are CPI-only (no twitchStats/
    // ytStats embed), so without this the modal's per-platform stats — the
    // Twitch 30d rollup grid and twitchStats.lastStreamAt that drives the
    // "last streamed" line — would be missing. byId reads creator_cpi with the
    // youtube_creators/twitch_creators embeds, so it carries fresh stats.
    this.current.set(creator);
    void this.creators.byId(creator.id).then((full) => {
      // Apply only if the same creator is still open (user may have switched/closed).
      if (full && this.current()?.id === creator.id) this.current.set(full);
    });
  }

  close(): void {
    this.current.set(null);
  }
}
