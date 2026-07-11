import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AdminDiscoveryService } from '../../core/admin/admin-discovery.service';
import { QuotaStatus } from '../../core/admin/admin-discovery.types';
import { AdminAddFormComponent } from './admin-add-form.component';
import { DiscoverySearchComponent } from './discovery-search.component';
import { DiscoveryQueueComponent } from './discovery-queue.component';
import { DiscoverySweepsComponent } from './discovery-sweeps.component';

type DiscoveryView = 'search' | 'queue' | 'sweeps' | 'manual';

/** Add-creators tab shell — pill sub-nav (Search / Review queue / Sweeps /
 *  Manual add) + a quota chip. The chip and the queue-count badge are both
 *  cosmetic reads (`refreshBadges`), so a failure there never blocks the tab
 *  from rendering its active sub-view. Sweeps run in the background and emit
 *  nothing, so switching pills is the only reliable moment to catch a badge
 *  gone stale mid-sweep — refresh on every switch, not just on child events. */
@Component({
  selector: 'app-admin-discovery',
  standalone: true,
  imports: [DecimalPipe, AdminAddFormComponent, DiscoverySearchComponent, DiscoveryQueueComponent, DiscoverySweepsComponent],
  template: `
    <div data-testid="admin-discovery" class="flex flex-col gap-4 flex-1 min-h-0">
      <div class="flex items-center gap-2" role="tablist">
        @for (v of views; track v.key) {
          <button type="button" role="tab" [attr.aria-selected]="view() === v.key"
            (click)="view.set(v.key); refreshBadges()"
            class="sf-btn text-xs" [class.sf-btn-primary]="view() === v.key" [class.sf-btn-ghost]="view() !== v.key"
            [attr.data-testid]="'discovery-view-' + v.key">
            {{ v.label }}@if (v.key === 'queue' && queueCount() > 0) { ({{ queueCount() }}) }
          </button>
        }
        @if (quota(); as q) {
          <span class="ml-auto text-xs" style="color: var(--color-text-muted);" data-testid="discovery-quota-chip">
            quota today: {{ quotaRemaining() | number }} left
          </span>
        }
      </div>
      @switch (view()) {
        @case ('search') { <app-discovery-search (staged)="refreshBadges()" /> }
        @case ('queue')  { <app-discovery-queue class="flex-1 min-h-0 flex flex-col" (changed)="refreshBadges()" /> }
        @case ('sweeps') { <app-discovery-sweeps /> }
        @case ('manual') { <app-admin-add-form (added)="refreshBadges()" /> }
      }
    </div>
  `,
})
export class AdminDiscoveryComponent {
  private svc = inject(AdminDiscoveryService);
  readonly view = signal<DiscoveryView>('search');
  readonly views: { key: DiscoveryView; label: string }[] = [
    { key: 'search', label: 'Search' }, { key: 'queue', label: 'Review queue' },
    { key: 'sweeps', label: 'Sweeps' }, { key: 'manual', label: 'Manual add' },
  ];
  readonly quota = signal<QuotaStatus | null>(null);
  readonly queueCount = signal(0);
  /** Remaining quota, clamped so a stale/elevated ceiling swap never renders
   *  a negative "left" count while today's used total catches up. */
  readonly quotaRemaining = computed(() => {
    const q = this.quota();
    return q ? Math.max(0, q.effective_ceiling - q.used_today) : 0;
  });

  constructor() { void this.refreshBadges(); }

  async refreshBadges(): Promise<void> {
    try {
      const [q, queue] = await Promise.all([
        this.svc.quotaStatus(),
        this.svc.listQueue({ status: 'new' }, 0, 1),
      ]);
      this.quota.set(q);
      this.queueCount.set(queue.total);
    } catch { /* chip is cosmetic — never block the tab on it */ }
  }
}
