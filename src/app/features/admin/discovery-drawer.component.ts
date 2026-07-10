import { Component, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DiscoveredChannel } from '../../core/admin/admin-discovery.types';

/**
 * Read-only candidate detail — right-side overlay opened from a search or
 * review-queue row click (Tasks 5/6). Shows only data already fetched during
 * enrichment (no extra YouTube quota spent here — no GFI/CPI either, since
 * candidates aren't scored until added). Footer buttons just emit `act`; the
 * host owns what happens next (open the add/link dialog, call `setStatus`,
 * etc.) — this component has no service dependencies of its own.
 */
@Component({
  selector: 'app-discovery-drawer',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  template: `
    <div
      class="fixed inset-0 z-40 flex justify-end sf-fade-in"
      style="background: var(--color-overlay);"
      (click)="closed.emit()"
      data-testid="discovery-drawer"
    >
      <div
        class="h-full w-full overflow-y-auto flex flex-col sf-modal-in"
        style="max-width: 480px; background: var(--color-bg-2); border-left: 1px solid var(--color-border);"
        (click)="$event.stopPropagation()"
      >
        <header class="flex items-start gap-3 p-6 pb-4">
          @if (candidate().thumbnail_url) {
            <img
              [src]="candidate().thumbnail_url"
              alt=""
              class="rounded-full shrink-0 object-cover"
              style="width: 56px; height: 56px;"
              data-testid="drawer-avatar"
            />
          }
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline gap-2 flex-wrap">
              <span class="text-base font-bold truncate" style="color: var(--color-text);" data-testid="drawer-name">{{ candidate().name }}</span>
              <span class="text-sm truncate" style="color: var(--color-text-muted);" data-testid="drawer-handle">{{ '@' + candidate().handle }}</span>
            </div>
            <a
              [href]="channelUrl()"
              target="_blank"
              rel="noopener"
              class="text-xs"
              style="color: var(--color-sf-blue);"
              data-testid="drawer-channel-link"
            >↗ Open channel on YouTube</a>
          </div>
          <button
            type="button"
            (click)="closed.emit()"
            class="text-xs shrink-0"
            style="color: var(--color-text-muted);"
            data-testid="drawer-close"
          >✕</button>
        </header>

        <div class="flex flex-wrap gap-x-4 gap-y-1 px-6 pb-4 text-xs" style="color: var(--color-text-dim);" data-testid="drawer-stats">
          <span><b style="color: var(--color-text);">{{ candidate().subscriber_count | number }}</b> subs</span>
          <span><b style="color: var(--color-text);">{{ candidate().avg_views | number }}</b> avg views</span>
          <span><b style="color: var(--color-text);">{{ candidate().engagement_rate | number:'1.0-1' }}%</b> eng</span>
          <span><b style="color: var(--color-text);">{{ candidate().sponsor_freq_pct | number:'1.0-0' }}%</b> sponsored</span>
          <span><b style="color: var(--color-text);">{{ candidate().country || '—' }}</b> · {{ candidate().language || '—' }}</span>
        </div>

        <section class="px-6 pb-4" data-testid="drawer-bio">
          <div class="text-[10px] uppercase tracking-wider mb-1" style="color: var(--color-text-muted);">Bio</div>
          <p class="text-sm" style="color: var(--color-text-dim);">{{ candidate().bio || '—' }}</p>
        </section>

        <section class="px-6 pb-4" data-testid="drawer-uploads">
          <div class="text-[10px] uppercase tracking-wider mb-1" style="color: var(--color-text-muted);">Recent uploads (last 5)</div>
          @if (candidate().recent_videos.length === 0) {
            <p class="text-xs" style="color: var(--color-text-muted);">No recent uploads found.</p>
          } @else {
            <ul class="flex flex-col gap-1.5 text-xs">
              @for (v of candidate().recent_videos; track v.url) {
                <li style="color: var(--color-text-dim);">
                  <a [href]="v.url" target="_blank" rel="noopener" style="color: var(--color-sf-blue);">↗ {{ v.title }}</a>
                  — {{ v.views | number }} views
                  @if (v.paid_promo) {
                    <span
                      class="sf-chip ml-1"
                      style="background: color-mix(in srgb, var(--color-sf-gold) 15%, transparent); color: var(--color-sf-gold);"
                    >sponsored</span>
                  }
                </li>
              }
            </ul>
          }
        </section>

        <p class="px-6 pb-3 text-xs" style="color: var(--color-text-muted);" data-testid="drawer-provenance">
          found by "{{ candidate().found_by_query }}" · {{ candidate().fetched_at | date }}
        </p>

        @if (candidate().match_type === 'name_hint') {
          <div
            class="mx-6 mb-4 p-3 rounded text-xs italic"
            style="background: color-mix(in srgb, var(--color-sf-gold) 12%, transparent); color: var(--color-sf-gold);"
            data-testid="drawer-name-warning"
          >
            ⚭ Name similar to roster creator #{{ candidate().matched_creator_id }} — review before adding
          </div>
        }

        <footer class="mt-auto p-6 pt-4 flex flex-col gap-3" style="border-top: 1px solid var(--color-border);">
          <div class="flex flex-wrap gap-2">
            <button type="button" (click)="act.emit('add')" class="sf-btn sf-btn-primary text-xs" data-testid="drawer-add">✚ Add…</button>
            <button type="button" (click)="act.emit('shortlist')" class="sf-btn sf-btn-ghost text-xs" data-testid="drawer-shortlist">☆ Shortlist</button>
            <button type="button" (click)="act.emit('reject')" class="sf-btn sf-btn-ghost text-xs" data-testid="drawer-reject">✕ Reject</button>
            <button type="button" (click)="act.emit('link')" class="sf-btn sf-btn-ghost text-xs" data-testid="drawer-link">⚭ Link to existing…</button>
          </div>
          <p class="text-[11px]" style="color: var(--color-text-muted);" data-testid="drawer-footnote">
            No GFI/CPI here — candidates aren't scored until added · Stats via YouTube Data API · purged after 30 days if not added.
          </p>
        </footer>
      </div>
    </div>
  `,
})
export class DiscoveryDrawerComponent {
  readonly candidate = input.required<DiscoveredChannel>();
  readonly closed = output<void>();
  readonly act = output<'add' | 'shortlist' | 'reject' | 'link'>();

  /** YouTube handles are stored bare (no leading @); channel_id is the
   *  guaranteed fallback for the rare candidate with no public handle. */
  protected channelUrl(): string {
    const c = this.candidate();
    return c.handle ? `https://www.youtube.com/@${c.handle}` : `https://www.youtube.com/channel/${c.channel_id}`;
  }
}
