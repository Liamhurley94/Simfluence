import { Component, computed, inject, input } from '@angular/core';
import { CampaignDeliverablesService } from '../../../core/campaigns/campaign-deliverables.service';
import { AuthService } from '../../../core/auth/auth.service';
import {
  CampaignDeliverable, DELIVERABLE_FORMATS, DeliverableFormat, DeliverablePlatform,
} from '../../../core/campaigns/campaign-deliverables.types';
import { CampaignCreator } from '../../../core/campaigns/campaign-creators.types';
import { Creator } from '../../../core/data/creator.types';

const FORECASTABLE: DeliverablePlatform[] = ['YouTube', 'Twitch'];

/**
 * Per-roster-row deliverable editor, mounted inside each `section-creators`
 * `<li>`. Service-driven (CampaignDeliverablesService) — no outputs. A
 * creator with no YouTube/Twitch attached renders only the empty state,
 * since neither platform can be forecast for them.
 */
@Component({
  selector: 'app-deliverable-editor',
  standalone: true,
  template: `
    @if (!hasForecastable()) {
      <div class="mt-2 text-[10px]" style="color: var(--color-text-muted);" data-testid="deliverables-none">
        No forecastable platform attached
      </div>
    } @else {
      <div class="mt-2 space-y-2">
        @for (row of rows(); track row.id) {
          <div
            class="flex items-center gap-2 flex-wrap p-2 rounded"
            style="background: var(--color-bg-2);"
            [attr.data-testid]="'deliverable-row-' + row.id"
          >
            <select
              [value]="row.platform"
              (change)="onPlatformChange(row, $any($event.target).value)"
              [disabled]="disabled()"
              class="sf-select px-1 py-0.5 text-[10px]"
              [attr.data-testid]="'deliverable-platform-' + row.id"
            >
              @for (p of platformOptions; track p) {
                <option [value]="p" [disabled]="!isAttached(p)">
                  {{ p }}{{ isAttached(p) ? '' : ' (not attached)' }}
                </option>
              }
            </select>

            @if (row.platform === 'YouTube') {
              <select
                [value]="row.format"
                (change)="onFormatChange(row, $any($event.target).value)"
                [disabled]="disabled()"
                class="sf-select px-1 py-0.5 text-[10px]"
                [attr.data-testid]="'deliverable-format-' + row.id"
              >
                @for (f of formatOptions; track f) {
                  <option [value]="f">{{ f }}</option>
                }
              </select>
            } @else {
              <span class="text-[10px]" style="color: var(--color-text-muted);">Dedicated stream</span>
              <input
                type="number"
                min="0"
                step="0.5"
                [value]="row.durationHours ?? 2"
                (blur)="onHoursBlur(row, $any($event.target).value)"
                [disabled]="disabled()"
                class="sf-input px-1 py-0.5 text-[10px] w-14"
                [attr.data-testid]="'deliverable-hours-' + row.id"
              />
            }

            <input
              type="number"
              min="1"
              [value]="row.quantity"
              (blur)="onQtyBlur(row, $any($event.target).value)"
              [disabled]="disabled()"
              class="sf-input px-1 py-0.5 text-[10px] w-12"
              [attr.data-testid]="'deliverable-qty-' + row.id"
            />

            <input
              type="number"
              min="0"
              [value]="row.agreedFee ?? ''"
              (blur)="onFeeBlur(row, $any($event.target).value)"
              [disabled]="disabled()"
              [placeholder]="feePlaceholder(row)"
              class="sf-input px-1 py-0.5 text-[10px] w-24"
              [attr.data-testid]="'deliverable-fee-' + row.id"
            />

            <button
              type="button"
              (click)="removeRow(row)"
              [disabled]="disabled()"
              class="sf-btn text-[10px] disabled:opacity-40"
              style="padding: 4px 8px; background: transparent; border-color: var(--color-sf-red); color: var(--color-sf-red);"
              [attr.data-testid]="'deliverable-remove-' + row.id"
            >
              Remove
            </button>
          </div>
        }

        @if (hasUnattachedForecastable() && auth.isAdmin()) {
          <div class="text-[9px]" style="color: var(--color-text-muted);" data-testid="deliverable-attach-hint">
            Attach via Admin → Creators
          </div>
        }

        <button
          type="button"
          (click)="addRow()"
          [disabled]="disabled()"
          class="sf-btn sf-btn-ghost text-[10px] disabled:opacity-40"
          style="padding: 4px 8px;"
          data-testid="deliverable-add"
        >
          + Add deliverable
        </button>
      </div>
    }
  `,
})
export class DeliverableEditorComponent {
  protected deliverables = inject(CampaignDeliverablesService);
  protected auth = inject(AuthService);

  readonly campaignCreator = input.required<CampaignCreator>();
  readonly creator = input<Creator | null>(null);
  readonly disabled = input(false);

  protected readonly rows = computed(() =>
    this.deliverables.byCampaignCreator().get(this.campaignCreator().id) ?? []);

  /** Platforms attached to this creator (primary + all_platforms, deduped). */
  protected readonly attached = computed<Set<string>>(() => {
    const cr = this.creator();
    if (!cr) return new Set();
    return new Set([cr.platform, ...(cr.allPlatforms ?? [])].filter(Boolean) as string[]);
  });
  protected readonly hasForecastable = computed(() =>
    FORECASTABLE.some((p) => this.attached().has(p)));
  protected readonly hasUnattachedForecastable = computed(() =>
    FORECASTABLE.some((p) => !this.attached().has(p)));

  protected readonly platformOptions = FORECASTABLE;
  protected readonly formatOptions: readonly DeliverableFormat[] = DELIVERABLE_FORMATS;

  protected isAttached(p: DeliverablePlatform): boolean { return this.attached().has(p); }

  protected async onPlatformChange(row: CampaignDeliverable, platform: DeliverablePlatform): Promise<void> {
    if (platform === 'Twitch') {
      await this.deliverables.update(row.id, { platform, format: 'Dedicated', durationHours: 2 });
    } else {
      await this.deliverables.update(row.id, { platform, format: 'Integrated', durationHours: null });
    }
  }

  protected async onFormatChange(row: CampaignDeliverable, format: DeliverableFormat): Promise<void> {
    if (format === row.format) return;
    await this.deliverables.update(row.id, { format });
  }

  protected async onHoursBlur(row: CampaignDeliverable, raw: string): Promise<void> {
    const trimmed = raw.trim();
    const value = trimmed === '' ? 2 : Math.max(0, Number(trimmed));
    if (Number.isNaN(value) || value === row.durationHours) return;
    await this.deliverables.update(row.id, { durationHours: value });
  }

  protected async onQtyBlur(row: CampaignDeliverable, raw: string): Promise<void> {
    const parsed = Number(raw);
    const value = Number.isNaN(parsed) || parsed < 1 ? 1 : Math.trunc(parsed);
    if (value === row.quantity) return;
    await this.deliverables.update(row.id, { quantity: value });
  }

  protected async onFeeBlur(row: CampaignDeliverable, raw: string): Promise<void> {
    const trimmed = raw.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value !== null && Number.isNaN(value)) return;
    if (value === row.agreedFee) return;
    await this.deliverables.update(row.id, { agreedFee: value });
  }

  protected async removeRow(row: CampaignDeliverable): Promise<void> {
    await this.deliverables.remove(row.id);
  }

  protected feePlaceholder(row: CampaignDeliverable): string {
    return row.platform === 'Twitch' ? `Fee / ${row.durationHours ?? 2}hr stream` : 'Fee';
  }

  protected async addRow(): Promise<void> {
    const cr = this.creator();
    const primary: DeliverablePlatform =
      cr && this.attached().has('Twitch') && !this.attached().has('YouTube') ? 'Twitch'
      : (cr?.platform === 'Twitch' ? 'Twitch' : 'YouTube');
    await this.deliverables.add({
      campaignCreatorId: this.campaignCreator().id,
      platform: primary,
      format: primary === 'Twitch' ? 'Dedicated' : 'Integrated',
      durationHours: primary === 'Twitch' ? 2 : undefined,
    });
  }
}
