import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth/auth.service';
import { CampaignsService } from '../../core/campaigns/campaigns.service';
import { BriefPdfService } from '../../core/campaigns/brief-pdf.service';
import { Campaign, NewCampaign } from '../../core/campaigns/campaign.types';
import { tierRank } from '../../core/types';
import { CampaignFormComponent } from './campaign-form.component';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [DecimalPipe, DatePipe, CampaignFormComponent],
  template: `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold" style="color: var(--color-text);">Campaigns</h1>
      <button
        type="button"
        (click)="openNew()"
        class="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider"
        style="background: var(--color-sf-blue); color: white;"
        data-testid="campaigns-new"
      >
        + New campaign
      </button>
    </div>

    @if (svc.error()) {
      <div
        class="p-3 mb-4 rounded-lg text-xs"
        style="background: rgba(230,0,35,0.08); border: 1px solid var(--color-sf-red); color: var(--color-sf-red);"
        data-testid="campaigns-error"
      >
        {{ svc.error() }}
      </div>
    }

    @if (svc.campaigns().length === 0 && !svc.loading()) {
      <div
        class="p-12 rounded-lg text-center"
        style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
        data-testid="campaigns-empty"
      >
        <div class="text-sm font-semibold mb-2" style="color: var(--color-text);">
          No campaigns yet
        </div>
        <p class="text-xs mb-4" style="color: var(--color-text-muted);">
          Create a new campaign or save one from the simulator to get started.
        </p>
      </div>
    } @else {
      <div
        class="grid gap-3"
        style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));"
        data-testid="campaigns-grid"
      >
        @for (c of svc.campaigns(); track c.id) {
          <article
            class="p-4 rounded-lg"
            style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
            [attr.data-testid]="'campaign-' + c.id"
          >
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="min-w-0">
                <div class="font-bold truncate" style="color: var(--color-text);">{{ c.name }}</div>
                <div class="text-xs truncate" style="color: var(--color-text-muted);">
                  {{ c.client || 'Unassigned' }} · {{ c.genre || '—' }}
                </div>
              </div>
              <div
                class="text-xs shrink-0"
                style="color: var(--color-sf-gold);"
              >
                \${{ c.budget | number: '1.0-0' }}
              </div>
            </div>

            @if (c.goLiveDate) {
              <div class="text-[10px] uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">
                Go live {{ c.goLiveDate | date: 'mediumDate' }}
              </div>
            }

            @if (c.forecast; as f) {
              <div class="grid grid-cols-3 gap-1 text-center mb-3">
                <div>
                  <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">P50 Imp.</div>
                  <div class="text-xs font-bold" style="color: var(--color-text);">
                    {{ f.p50.impressions | number: '1.0-0' }}
                  </div>
                </div>
                <div>
                  <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">CTR</div>
                  <div class="text-xs font-bold" style="color: var(--color-text);">{{ f.p50.ctr }}%</div>
                </div>
                <div>
                  <div class="text-[9px] uppercase" style="color: var(--color-text-muted);">ROAS</div>
                  <div class="text-xs font-bold" style="color: var(--color-sf-gold);">
                    {{ f.p50.roas }}×
                  </div>
                </div>
              </div>
            }

            @if (c.notes) {
              <p class="text-xs mb-3" style="color: var(--color-text);">{{ c.notes }}</p>
            }

            <div class="flex gap-1 text-xs">
              <button
                type="button"
                (click)="openEdit(c)"
                class="flex-1 py-1.5 rounded"
                style="background: var(--color-bg-3); color: var(--color-text);"
                [attr.data-testid]="'campaign-edit-' + c.id"
              >
                Edit
              </button>
              <button
                type="button"
                (click)="exportPdf(c)"
                [disabled]="!canExportBrief()"
                class="flex-1 py-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                style="background: var(--color-sf-cyan); color: #000;"
                [attr.data-testid]="'campaign-pdf-' + c.id"
              >
                Brief PDF
              </button>
              <button
                type="button"
                (click)="remove(c)"
                class="px-2 py-1.5 rounded"
                style="background: transparent; border: 1px solid var(--color-sf-red); color: var(--color-sf-red);"
                [attr.data-testid]="'campaign-delete-' + c.id"
              >
                Delete
              </button>
            </div>
          </article>
        }
      </div>
    }

    @if (formMode() !== 'closed') {
      <app-campaign-form
        [editing]="editing()"
        [defaults]="defaults()"
        (save)="onSave($event)"
        (cancel)="closeForm()"
      />
    }
  `,
})
export class CampaignsComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private pdf = inject(BriefPdfService);
  private route = inject(ActivatedRoute);

  protected readonly svc = inject(CampaignsService);

  protected readonly formMode = signal<'closed' | 'new' | 'edit'>('closed');
  protected readonly editing = signal<Campaign | null>(null);
  protected readonly defaults = signal<Partial<NewCampaign> | null>(null);

  protected readonly canExportBrief = computed(
    () => tierRank(this.auth.tier()) >= tierRank('platinum'),
  );

  private readonly queryParams = toSignal(this.route.queryParamMap);

  constructor() {
    void this.svc.load();

    // `?new=1` (e.g. from simulator Save button) auto-opens the form, seeded
    // with any defaults passed via router state.
    const params = this.queryParams();
    if (params?.get('new') === '1') {
      const nav = this.router.getCurrentNavigation();
      const seed = (nav?.extras?.state?.['campaignSeed'] ?? null) as Partial<NewCampaign> | null;
      this.defaults.set(seed);
      this.formMode.set('new');
    }
  }

  openNew(): void {
    this.editing.set(null);
    this.defaults.set(null);
    this.formMode.set('new');
  }

  openEdit(c: Campaign): void {
    this.editing.set(c);
    this.formMode.set('edit');
  }

  closeForm(): void {
    this.formMode.set('closed');
    this.editing.set(null);
    this.defaults.set(null);
  }

  async onSave(dto: NewCampaign): Promise<void> {
    const existing = this.editing();
    if (existing) {
      await this.svc.update(existing.id, dto);
    } else {
      await this.svc.create(dto);
    }
    this.closeForm();
  }

  async remove(c: Campaign): Promise<void> {
    await this.svc.remove(c.id);
  }

  exportPdf(c: Campaign): void {
    this.pdf.export(c);
  }
}
