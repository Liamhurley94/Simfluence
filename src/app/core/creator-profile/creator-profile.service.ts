import { Injectable, inject, signal } from '@angular/core';
import { Creator } from '../data/creator.types';
import { CreatorsService } from '../creators/creators.service';

// Tiny state holder for the creator profile modal — mirrors UpgradePromptService.
// One instance lives in the app; CreatorProfileModalComponent reacts to `current`.
@Injectable({ providedIn: 'root' })
export class CreatorProfileService {
  private creators = inject(CreatorsService);

  readonly current = signal<Creator | null>(null);

  /**
   * True while `openById` is fetching and there is nothing to render yet.
   * `open` never sets it — that path paints immediately from the caller's record.
   */
  readonly loading = signal(false);

  // Monotonic request token. Every open/openById/close bumps it, so an in-flight
  // fetch can never apply over a newer one, nor re-open a modal the user has
  // already closed. The id alone won't do: open the same creator, close, open it
  // again, and both requests would carry the same id.
  private token = 0;

  open(creator: Creator): void {
    // Show instantly with whatever the caller passed, then hydrate the full
    // record via byId. Show-all Discovery cards are CPI-only (no twitchStats/
    // ytStats embed), so without this the modal's per-platform stats — the
    // Twitch 30d rollup grid and twitchStats.lastStreamAt that drives the
    // "last streamed" line — would be missing. byId reads creator_cpi with the
    // youtube_creators/twitch_creators embeds, so it carries fresh stats.
    const mine = ++this.token;
    this.loading.set(false);
    this.current.set(creator);
    void this.creators.byId(creator.id).then((full) => {
      if (full && this.token === mine) this.current.set(full);
    });
  }

  /**
   * Open by id for callers that don't hold a `Creator` — the campaign Matcher
   * shortlist (raw `creator_cpi` rows off the edge function) and the campaign
   * roster (whose creator hydrate may still be in flight). Costs no extra
   * round-trip over `open`, which fetches byId anyway; the difference is that
   * the modal shows a skeleton instead of an instantly-painted header.
   */
  async openById(id: number): Promise<void> {
    const mine = ++this.token;
    this.loading.set(true);
    this.current.set(null);
    const full = await this.creators.byId(id);
    if (this.token !== mine) return; // superseded by a newer open, or closed
    this.loading.set(false);
    // undefined → creator deleted or invisible under row-level security. Leaves
    // the modal closed rather than rendering an empty shell.
    this.current.set(full ?? null);
  }

  close(): void {
    this.token++; // invalidate anything in flight
    this.loading.set(false);
    this.current.set(null);
  }
}
