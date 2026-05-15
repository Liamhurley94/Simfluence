import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { CampaignsService } from '../../core/campaigns/campaigns.service';
import { BriefPdfService } from '../../core/campaigns/brief-pdf.service';
import { Campaign, CAMPAIGN_STATUS_LABELS } from '../../core/campaigns/campaign.types';
import { tierRank } from '../../core/types';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [DecimalPipe, RouterLink],
  template: `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold" style="color: var(--color-text);">Campaigns</h1>
      <button
        type="button"
        (click)="createAndOpen()"
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
            class="p-4 rounded-lg cursor-pointer hover:opacity-90"
            style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
            [routerLink]="['/app/campaigns', c.id]"
            [attr.data-testid]="'campaign-' + c.id"
          >
            <div class="flex items-start justify-between gap-2 mb-1">
              <div class="min-w-0">
                <div class="font-bold truncate" style="color: var(--color-text);">{{ c.name }}</div>
                <div class="text-xs truncate" style="color: var(--color-text-muted);">
                  {{ c.client || 'Unassigned' }} · {{ c.genre || '—' }}
                </div>
              </div>
              @if (c.budget != null) {
                <div class="text-xs shrink-0" style="color: var(--color-sf-gold);">
                  \${{ c.budget | number: '1.0-0' }}
                </div>
              }
            </div>

            <div class="flex items-center gap-2 mb-3">
              <span
                class="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                [style]="statusStyle(c)"
                [attr.data-testid]="'campaign-status-' + c.id"
              >
                {{ statusLabel(c) }}
              </span>
              <span
                class="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                style="background: var(--color-bg-3); color: var(--color-text-muted);"
                [attr.data-testid]="'campaign-owner-' + c.id"
              >
                {{ ownershipLabel(c) }}
              </span>
            </div>

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
              <p class="text-xs mb-3 line-clamp-2" style="color: var(--color-text);">{{ c.notes }}</p>
            }

            <div class="flex gap-1 text-xs" (click)="$event.stopPropagation()">
              <button
                type="button"
                (click)="exportPdf(c, $event)"
                [disabled]="!canExportBrief()"
                class="flex-1 py-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                style="background: var(--color-sf-cyan); color: #000;"
                [attr.data-testid]="'campaign-pdf-' + c.id"
              >
                Brief PDF
              </button>
              <button
                type="button"
                (click)="remove(c, $event)"
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
  `,
})
export class CampaignsComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private pdf = inject(BriefPdfService);

  protected readonly svc = inject(CampaignsService);

  protected readonly canExportBrief = computed(
    () => tierRank(this.auth.tier()) >= tierRank('platinum'),
  );

  constructor() {
    void this.svc.load();
  }

  /**
   * Creates an empty planning campaign and routes to its detail page.
   * Campaigns are persisted from the moment of creation; "wizard state" is
   * just which fields are filled.
   */
  async createAndOpen(): Promise<void> {
    const created = await this.svc.create({ name: 'Untitled campaign' });
    if (created) {
      void this.router.navigate(['/app/campaigns', created.id]);
    }
  }

  async remove(c: Campaign, ev: MouseEvent): Promise<void> {
    ev.stopPropagation();
    await this.svc.remove(c.id);
  }

  exportPdf(c: Campaign, ev: MouseEvent): void {
    ev.stopPropagation();
    this.pdf.export(c);
  }

  protected statusLabel(c: Campaign): string {
    return CAMPAIGN_STATUS_LABELS[c.status];
  }

  protected statusStyle(c: Campaign): string {
    const colors: Record<string, string> = {
      planning: 'background: rgba(155,155,170,0.18); color: var(--color-text-muted);',
      active: 'background: rgba(0,200,120,0.15); color: var(--color-sf-green);',
      completed: 'background: rgba(0,180,220,0.15); color: var(--color-sf-cyan);',
      archived: 'background: rgba(155,155,170,0.10); color: var(--color-text-muted);',
    };
    return colors[c.status] ?? colors['planning'];
  }

  protected ownershipLabel(c: Campaign): string {
    if (c.enterpriseId === null) return 'Personal';
    return this.auth.enterprise()?.name ?? 'Enterprise';
  }
}
