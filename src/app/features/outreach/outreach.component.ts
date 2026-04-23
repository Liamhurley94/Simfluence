import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CampaignsService } from '../../core/campaigns/campaigns.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { OutreachService } from '../../core/outreach/outreach.service';
import {
  NewOutreachRecord,
  OUTREACH_STATUSES,
  OutreachRecord,
  OutreachStatus,
  STATUS_LABELS,
} from '../../core/outreach/outreach.types';
import { Creator } from '../../core/data/creator.types';
import { AddOutreachComponent } from './add-outreach.component';

@Component({
  selector: 'app-outreach',
  standalone: true,
  imports: [FormsModule, AddOutreachComponent],
  template: `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold" style="color: var(--color-text);">Outreach</h1>
      <button
        type="button"
        (click)="showAdd.set(true)"
        class="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider"
        style="background: var(--color-sf-green); color: white;"
        data-testid="outreach-new"
      >
        + Add creator
      </button>
    </div>

    <!-- Status counters -->
    <div class="grid grid-cols-5 gap-2 mb-6" data-testid="outreach-stats">
      @for (s of statuses; track s) {
        <div
          class="p-3 rounded-lg"
          style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
          [attr.data-testid]="'stat-' + s"
        >
          <div class="text-[10px] uppercase tracking-wider" [style.color]="statusColor(s)">
            {{ label(s) }}
          </div>
          <div class="text-2xl font-bold" style="color: var(--color-text);">
            {{ svc.byStatus()[s] }}
          </div>
        </div>
      }
    </div>

    @if (svc.error()) {
      <div
        class="p-3 mb-4 rounded-lg text-xs"
        style="background: rgba(230,0,35,0.08); border: 1px solid var(--color-sf-red); color: var(--color-sf-red);"
        data-testid="outreach-error"
      >
        {{ svc.error() }}
      </div>
    }

    <!-- Filters -->
    <div
      class="p-3 mb-4 rounded-lg flex items-center gap-3 flex-wrap"
      style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
      data-testid="outreach-filters"
    >
      <select
        [ngModel]="campaignFilter()"
        (ngModelChange)="setCampaignFilter($event)"
        class="px-3 py-2 rounded text-sm"
        style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text);"
        data-testid="filter-campaign"
      >
        <option [ngValue]="''">All campaigns</option>
        <option [ngValue]="'unassigned'">Unassigned</option>
        @for (c of campaigns.campaigns(); track c.id) {
          <option [ngValue]="c.id">{{ c.name }}</option>
        }
      </select>
      <select
        [ngModel]="statusFilter()"
        (ngModelChange)="setStatusFilter($event)"
        class="px-3 py-2 rounded text-sm"
        style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text);"
        data-testid="filter-status"
      >
        <option [ngValue]="''">All statuses</option>
        @for (s of statuses; track s) {
          <option [ngValue]="s">{{ label(s) }}</option>
        }
      </select>
      <span class="text-xs ml-auto" style="color: var(--color-text-muted);" data-testid="filter-count">
        {{ svc.filtered().length }} of {{ svc.records().length }} shown
      </span>
    </div>

    <!-- Table -->
    @if (svc.records().length === 0) {
      <div
        class="p-12 rounded-lg text-center"
        style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
        data-testid="outreach-empty"
      >
        <div class="text-sm font-semibold mb-2" style="color: var(--color-text);">
          📬 No creators tracked yet
        </div>
        <p class="text-xs" style="color: var(--color-text-muted);">
          Add creators from Discovery or use the + Add creator button above.
        </p>
      </div>
    } @else {
      <div
        class="rounded-lg overflow-hidden"
        style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
        data-testid="outreach-table"
      >
        <table class="w-full text-sm">
          <thead>
            <tr style="background: var(--color-sf-blue); color: white;">
              <th class="text-left p-3 text-[10px] uppercase tracking-wider">Creator</th>
              <th class="text-left p-3 text-[10px] uppercase tracking-wider">Campaign</th>
              <th class="text-right p-3 text-[10px] uppercase tracking-wider">CPI</th>
              <th class="text-right p-3 text-[10px] uppercase tracking-wider">Subs</th>
              <th class="text-left p-3 text-[10px] uppercase tracking-wider">Status</th>
              <th class="text-left p-3 text-[10px] uppercase tracking-wider">Contact</th>
              <th class="text-left p-3 text-[10px] uppercase tracking-wider">Notes</th>
              <th class="p-3"></th>
            </tr>
          </thead>
          <tbody>
            @for (r of svc.filtered(); track r.id) {
              <tr class="border-t" style="border-color: var(--color-border);" [attr.data-testid]="'row-' + r.id">
                <td class="p-3">
                  @if (creatorFor(r.creatorId); as c) {
                    <div class="flex items-center gap-2">
                      <div
                        class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                        [style.background]="c.color"
                        style="color: white;"
                      >
                        {{ initialsOf(c) }}
                      </div>
                      <div class="min-w-0">
                        <div class="font-semibold truncate" style="color: var(--color-text);">{{ c.name }}</div>
                        <div class="text-xs" style="color: var(--color-text-muted);">{{ c.handle }}</div>
                      </div>
                    </div>
                  } @else {
                    <span class="text-xs" style="color: var(--color-text-muted);">
                      Creator #{{ r.creatorId }}
                    </span>
                  }
                </td>
                <td class="p-3 text-xs" style="color: var(--color-text);">
                  {{ campaignName(r.campaignId) }}
                </td>
                <td class="p-3 text-right text-xs" style="color: var(--color-text);">
                  {{ creatorFor(r.creatorId)?.cpi ?? '—' }}
                </td>
                <td class="p-3 text-right text-xs" style="color: var(--color-text);">
                  {{ creatorFor(r.creatorId)?.subs ?? '—' }}
                </td>
                <td class="p-3">
                  <select
                    [ngModel]="r.status"
                    (ngModelChange)="setStatus(r, $event)"
                    class="px-2 py-1 rounded text-xs"
                    [style.background]="statusColor(r.status)"
                    style="color: white; border: none;"
                    [attr.data-testid]="'status-' + r.id"
                  >
                    @for (s of statuses; track s) {
                      <option [ngValue]="s" style="color: black; background: white;">{{ label(s) }}</option>
                    }
                  </select>
                </td>
                <td class="p-3">
                  <input
                    type="text"
                    [ngModel]="r.contact"
                    (blur)="setContact(r, $any($event.target).value)"
                    class="px-2 py-1 rounded text-xs w-full"
                    style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text);"
                    [attr.data-testid]="'contact-' + r.id"
                  />
                </td>
                <td class="p-3">
                  <input
                    type="text"
                    [ngModel]="r.notes"
                    (blur)="setNotes(r, $any($event.target).value)"
                    class="px-2 py-1 rounded text-xs w-full"
                    style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text);"
                    [attr.data-testid]="'notes-' + r.id"
                  />
                </td>
                <td class="p-3">
                  <button
                    type="button"
                    (click)="remove(r)"
                    class="px-2 py-1 rounded text-xs"
                    style="background: transparent; border: 1px solid var(--color-sf-red); color: var(--color-sf-red);"
                    [attr.data-testid]="'delete-' + r.id"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (showAdd()) {
      <app-add-outreach (save)="onAdd($event)" (cancel)="showAdd.set(false)" />
    }
  `,
})
export class OutreachComponent {
  private creatorsSvc = inject(CreatorsService);
  protected readonly svc = inject(OutreachService);
  protected readonly campaigns = inject(CampaignsService);

  protected readonly statuses = OUTREACH_STATUSES;
  protected readonly showAdd = signal(false);
  protected readonly campaignFilter = signal<string>(''); // '', 'unassigned', or a campaign id
  protected readonly statusFilter = signal<string>(''); // '' or OutreachStatus

  constructor() {
    void this.svc.load();
    void this.campaigns.load();
  }

  creatorFor(id: number): Creator | undefined {
    return this.creatorsSvc.byId(id);
  }

  initialsOf(c: Creator): string {
    return c.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase();
  }

  campaignName(id: string | null): string {
    if (!id) return 'Unassigned';
    return this.campaigns.byId(id)?.name ?? `Campaign ${id.slice(0, 6)}`;
  }

  label(s: OutreachStatus): string {
    return STATUS_LABELS[s];
  }

  statusColor(s: OutreachStatus): string {
    switch (s) {
      case 'shortlisted':
        return 'var(--color-sf-blue)';
      case 'contacted':
        return 'var(--color-sf-cyan)';
      case 'negotiating':
        return 'var(--color-sf-orange)';
      case 'confirmed':
        return 'var(--color-sf-green)';
      case 'declined':
        return 'var(--color-sf-red)';
    }
  }

  setCampaignFilter(value: string): void {
    this.campaignFilter.set(value);
    const filters: { campaignId?: string | null; status?: OutreachStatus } = {};
    if (value === 'unassigned') filters.campaignId = null;
    else if (value !== '') filters.campaignId = value;
    const status = this.statusFilter();
    if (status !== '') filters.status = status as OutreachStatus;
    this.svc.setFilter(filters);
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(value);
    this.setCampaignFilter(this.campaignFilter()); // re-apply combined
  }

  async setStatus(r: OutreachRecord, status: OutreachStatus): Promise<void> {
    await this.svc.update(r.id, { status });
  }

  async setContact(r: OutreachRecord, contact: string): Promise<void> {
    if (contact === r.contact) return;
    await this.svc.update(r.id, { contact });
  }

  async setNotes(r: OutreachRecord, notes: string): Promise<void> {
    if (notes === r.notes) return;
    await this.svc.update(r.id, { notes });
  }

  async remove(r: OutreachRecord): Promise<void> {
    await this.svc.remove(r.id);
  }

  async onAdd(dto: NewOutreachRecord): Promise<void> {
    await this.svc.create(dto);
    this.showAdd.set(false);
  }
}
