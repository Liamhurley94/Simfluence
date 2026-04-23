import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CreatorsService } from '../../core/creators/creators.service';
import { CampaignsService } from '../../core/campaigns/campaigns.service';
import { Creator } from '../../core/data/creator.types';
import {
  NewOutreachRecord,
  OUTREACH_STATUSES,
  OutreachStatus,
  STATUS_LABELS,
} from '../../core/outreach/outreach.types';

@Component({
  selector: 'app-add-outreach',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div
      class="fixed inset-0 z-40 flex items-center justify-center p-6"
      style="background: rgba(0,0,0,0.65);"
      (click)="cancel.emit()"
      data-testid="outreach-add-backdrop"
    >
      <div
        class="max-w-md w-full p-6 rounded-lg flex flex-col gap-3"
        style="background: var(--color-bg-2); border: 1px solid var(--color-border-strong);"
        (click)="$event.stopPropagation()"
        data-testid="outreach-add"
      >
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold" style="color: var(--color-text);">Add creator</h2>
          <button
            type="button"
            (click)="cancel.emit()"
            class="text-xs"
            style="color: var(--color-text-muted);"
          >
            ✕
          </button>
        </div>

        <!-- Campaign dropdown -->
        <div>
          <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">
            Campaign
          </label>
          <select
            [ngModel]="campaignId()"
            (ngModelChange)="campaignId.set($event)"
            class="w-full px-3 py-2 rounded text-sm"
            style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
            data-testid="outreach-add-campaign"
          >
            <option [ngValue]="null">Unassigned</option>
            @for (c of campaigns.campaigns(); track c.id) {
              <option [ngValue]="c.id">{{ c.name }}</option>
            }
          </select>
        </div>

        <!-- Creator picker -->
        <div>
          <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">
            Creator *
          </label>
          @if (selected(); as s) {
            <div
              class="flex items-center gap-2 p-2 rounded"
              style="background: var(--color-bg-3); border: 1px solid var(--color-sf-blue);"
              data-testid="outreach-add-selected"
            >
              <div
                class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                [style.background]="s.color"
                style="color: white;"
              >
                {{ initials(s) }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold truncate" style="color: var(--color-text);">{{ s.name }}</div>
                <div class="text-xs truncate" style="color: var(--color-text-muted);">{{ s.handle }}</div>
              </div>
              <button
                type="button"
                (click)="selected.set(null)"
                class="text-xs px-2"
                style="color: var(--color-text-muted);"
              >
                ✕
              </button>
            </div>
          } @else {
            <input
              type="text"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              placeholder="Search by name or handle…"
              class="w-full px-3 py-2 rounded text-sm"
              style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
              data-testid="outreach-add-search"
            />
            @if (matches().length > 0) {
              <div
                class="mt-1 rounded overflow-hidden max-h-48 overflow-y-auto"
                style="background: var(--color-bg-3); border: 1px solid var(--color-border);"
                data-testid="outreach-add-matches"
              >
                @for (c of matches(); track c.id) {
                  <button
                    type="button"
                    (click)="pick(c)"
                    class="w-full text-left px-3 py-2 text-sm hover:bg-[color:var(--color-bg-4)]"
                    style="color: var(--color-text);"
                    [attr.data-testid]="'outreach-add-match-' + c.id"
                  >
                    <div class="font-semibold truncate">{{ c.name }}</div>
                    <div class="text-xs" style="color: var(--color-text-muted);">
                      {{ c.handle }} · {{ c.platform }} · {{ c.subs }}
                    </div>
                  </button>
                }
              </div>
            }
          }
        </div>

        <!-- Status -->
        <div>
          <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">
            Status
          </label>
          <select
            [ngModel]="status()"
            (ngModelChange)="status.set($event)"
            class="w-full px-3 py-2 rounded text-sm"
            style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
            data-testid="outreach-add-status"
          >
            @for (s of statuses; track s) {
              <option [ngValue]="s">{{ label(s) }}</option>
            }
          </select>
        </div>

        <!-- Contact -->
        <div>
          <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">
            Contact (email / handle / phone)
          </label>
          <input
            type="text"
            [ngModel]="contact()"
            (ngModelChange)="contact.set($event)"
            placeholder="outreach@example.com"
            class="w-full px-3 py-2 rounded text-sm"
            style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
            data-testid="outreach-add-contact"
          />
        </div>

        <!-- Notes -->
        <div>
          <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">
            Notes
          </label>
          <textarea
            [ngModel]="notes()"
            (ngModelChange)="notes.set($event)"
            rows="2"
            class="w-full px-3 py-2 rounded text-sm"
            style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
            data-testid="outreach-add-notes"
          ></textarea>
        </div>

        <div class="flex gap-2 mt-2">
          <button
            type="button"
            (click)="cancel.emit()"
            class="flex-1 py-2 rounded text-sm"
            style="background: transparent; border: 1px solid var(--color-border); color: var(--color-text);"
            data-testid="outreach-add-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            (click)="onSave()"
            [disabled]="!selected()"
            class="flex-1 py-2 rounded text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            style="background: var(--color-sf-green); color: white;"
            data-testid="outreach-add-save"
          >
            Add to outreach
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AddOutreachComponent {
  private creatorsSvc = inject(CreatorsService);
  protected campaigns = inject(CampaignsService);

  readonly save = output<NewOutreachRecord>();
  readonly cancel = output<void>();

  protected readonly statuses = OUTREACH_STATUSES;
  protected readonly campaignId = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly selected = signal<Creator | null>(null);
  protected readonly status = signal<OutreachStatus>('shortlisted');
  protected readonly contact = signal('');
  protected readonly notes = signal('');

  protected readonly matches = computed(() => {
    const q = this.search().trim();
    if (q.length < 2) return [];
    return this.creatorsSvc.list({ search: q }, 'cpi', 0, 8).creators;
  });

  constructor() {
    void this.campaigns.load();
  }

  pick(c: Creator): void {
    this.selected.set(c);
    this.search.set('');
  }

  onSave(): void {
    const creator = this.selected();
    if (!creator) return;
    this.save.emit({
      creatorId: creator.id,
      campaignId: this.campaignId(),
      status: this.status(),
      contact: this.contact().trim(),
      notes: this.notes().trim(),
      lastContactAt: null,
    });
  }

  initials(c: Creator): string {
    return c.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase();
  }

  label(s: OutreachStatus): string {
    return STATUS_LABELS[s];
  }
}
