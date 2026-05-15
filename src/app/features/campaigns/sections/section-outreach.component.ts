import { Component, Input, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import {
  CAMPAIGN_CREATOR_STATUSES,
  CampaignCreator,
  CampaignCreatorStatus,
  SPONSORSHIP_FORMATS,
  STATUS_LABELS,
  SponsorshipFormat,
} from '../../../core/campaigns/campaign-creators.types';
import { CreatorsService } from '../../../core/creators/creators.service';
import { Creator } from '../../../core/data/creator.types';
import { Campaign } from '../../../core/campaigns/campaign.types';

@Component({
  selector: 'app-section-outreach',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section
      class="p-4 rounded-lg"
      style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
      data-testid="section-outreach"
    >
      <h2 class="text-xs uppercase tracking-wider font-bold mb-3" style="color: var(--color-text-muted);">
        Outreach
      </h2>

      <div class="flex gap-2 mb-3 flex-wrap">
        @for (s of statuses; track s) {
          <div
            class="text-[10px] px-2 py-1 rounded"
            style="background: var(--color-bg-3); color: var(--color-text-muted);"
            [attr.data-testid]="'outreach-count-' + s"
          >
            {{ labels[s] }}: {{ campaignCreators.statusCounts()[s] }}
          </div>
        }
      </div>

      @if (campaignCreators.records().length === 0) {
        <p class="text-xs" style="color: var(--color-text-muted);">
          Add creators to start tracking outreach.
        </p>
      } @else {
        <div class="overflow-x-auto -mx-1">
          <table class="w-full text-xs">
            <thead>
              <tr class="text-left" style="color: var(--color-text-muted);">
                <th class="px-1 py-1 font-normal text-[10px] uppercase tracking-wider">Creator</th>
                <th class="px-1 py-1 font-normal text-[10px] uppercase tracking-wider">Status</th>
                <th class="px-1 py-1 font-normal text-[10px] uppercase tracking-wider">Format</th>
                <th class="px-1 py-1 font-normal text-[10px] uppercase tracking-wider">Contact</th>
                <th class="px-1 py-1 font-normal text-[10px] uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody>
              @for (cc of campaignCreators.records(); track cc.id) {
                <tr
                  style="border-top: 1px solid var(--color-border);"
                  [attr.data-testid]="'outreach-row-' + cc.id"
                >
                  <td class="px-1 py-2">
                    @if (creatorById().get(cc.creatorId); as cr) {
                      <div class="font-semibold" style="color: var(--color-text);">{{ cr.name }}</div>
                      <div class="text-[10px]" style="color: var(--color-text-muted);">{{ '@' + (cr.handle || '—') }}</div>
                    } @else {
                      <div style="color: var(--color-text);">#{{ cc.creatorId }}</div>
                    }
                  </td>
                  <td class="px-1 py-2">
                    <select
                      [ngModel]="cc.status"
                      (ngModelChange)="setStatus(cc, $event)"
                      [disabled]="readonly"
                      class="px-1 py-0.5 rounded text-xs"
                      [style]="statusStyle(cc.status)"
                      [attr.data-testid]="'outreach-status-' + cc.id"
                    >
                      @for (s of statuses; track s) {
                        <option [value]="s">{{ labels[s] }}</option>
                      }
                    </select>
                  </td>
                  <td class="px-1 py-2">
                    <select
                      [ngModel]="cc.format"
                      (ngModelChange)="setFormat(cc, $event)"
                      [disabled]="readonly"
                      class="px-1 py-0.5 rounded text-xs"
                      style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text);"
                      [attr.data-testid]="'outreach-format-' + cc.id"
                    >
                      <option [ngValue]="null">—</option>
                      @for (f of formats; track f) {
                        <option [ngValue]="f">{{ f }}</option>
                      }
                    </select>
                  </td>
                  <td class="px-1 py-2">
                    <input
                      type="text"
                      [ngModel]="cc.contactEmail"
                      (blur)="setContactEmail(cc, $event)"
                      [readOnly]="readonly"
                      placeholder="email"
                      class="w-full px-1 py-0.5 rounded text-xs"
                      style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text);"
                      [attr.data-testid]="'outreach-email-' + cc.id"
                    />
                  </td>
                  <td class="px-1 py-2">
                    <input
                      type="text"
                      [ngModel]="cc.notes"
                      (blur)="setNotes(cc, $event)"
                      [readOnly]="readonly"
                      placeholder="notes"
                      class="w-full px-1 py-0.5 rounded text-xs"
                      style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text);"
                      [attr.data-testid]="'outreach-notes-' + cc.id"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class SectionOutreachComponent {
  protected campaignCreators = inject(CampaignCreatorsService);
  private creatorsSvc = inject(CreatorsService);

  @Input({ required: true }) campaign!: Campaign;
  @Input() readonly = false;

  protected readonly statuses = CAMPAIGN_CREATOR_STATUSES;
  protected readonly formats = SPONSORSHIP_FORMATS;
  protected readonly labels = STATUS_LABELS;

  protected readonly creatorById = signal<Map<number, Creator>>(new Map());

  constructor() {
    effect(async () => {
      const ids = this.campaignCreators.records().map((r) => r.creatorId);
      if (ids.length === 0) return;
      const known = this.creatorById();
      const missing = ids.filter((id) => !known.has(id));
      if (missing.length === 0) return;
      const fetched = await this.creatorsSvc.byIds(missing);
      const next = new Map(known);
      for (const cr of fetched) next.set(cr.id, cr);
      this.creatorById.set(next);
    });
  }

  async setStatus(cc: CampaignCreator, status: CampaignCreatorStatus): Promise<void> {
    if (this.readonly || status === cc.status) return;
    await this.campaignCreators.updateStatus(cc.id, status);
  }

  async setFormat(cc: CampaignCreator, format: SponsorshipFormat | null): Promise<void> {
    if (this.readonly || format === cc.format) return;
    await this.campaignCreators.updateFormat(cc.id, format);
  }

  async setContactEmail(cc: CampaignCreator, ev: Event): Promise<void> {
    if (this.readonly) return;
    const value = (ev.target as HTMLInputElement).value.trim() || null;
    if (value === cc.contactEmail) return;
    await this.campaignCreators.updateContact(cc.id, { contactEmail: value });
  }

  async setNotes(cc: CampaignCreator, ev: Event): Promise<void> {
    if (this.readonly) return;
    const value = (ev.target as HTMLInputElement).value.trim() || null;
    if (value === cc.notes) return;
    await this.campaignCreators.updateContact(cc.id, { notes: value });
  }

  protected statusStyle(status: CampaignCreatorStatus): string {
    const colors: Record<CampaignCreatorStatus, string> = {
      shortlisted: 'background: rgba(80,120,255,0.18); color: var(--color-sf-blue);',
      contacted: 'background: rgba(240,200,40,0.18); color: var(--color-sf-gold);',
      negotiating: 'background: rgba(240,160,40,0.18); color: var(--color-sf-orange, #f0a028);',
      confirmed: 'background: rgba(0,200,120,0.18); color: var(--color-sf-green);',
      declined: 'background: rgba(230,0,35,0.15); color: var(--color-sf-red);',
    };
    return colors[status];
  }
}
