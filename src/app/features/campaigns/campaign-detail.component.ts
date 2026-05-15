import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth/auth.service';
import { CampaignsService } from '../../core/campaigns/campaigns.service';
import { CampaignCreatorsService } from '../../core/campaigns/campaign-creators.service';
import {
  CAMPAIGN_STATUS_LABELS,
  Campaign,
  UpdateCampaign,
} from '../../core/campaigns/campaign.types';

import { SectionBasicsComponent } from './sections/section-basics.component';
import { SectionTargetingComponent } from './sections/section-targeting.component';
import { SectionBudgetComponent } from './sections/section-budget.component';
import { SectionCreatorsComponent } from './sections/section-creators.component';
import { SectionOutreachComponent } from './sections/section-outreach.component';
import { SectionForecastComponent } from './sections/section-forecast.component';

@Component({
  selector: 'app-campaign-detail',
  standalone: true,
  imports: [
    RouterLink,
    SectionBasicsComponent,
    SectionTargetingComponent,
    SectionBudgetComponent,
    SectionCreatorsComponent,
    SectionOutreachComponent,
    SectionForecastComponent,
  ],
  template: `
    <div class="max-w-4xl mx-auto pb-12">
      <a
        routerLink="/app/campaigns"
        class="text-xs inline-block mb-4"
        style="color: var(--color-text-muted);"
      >
        ← All campaigns
      </a>

      @if (loading()) {
        <div class="text-sm" style="color: var(--color-text-muted);">Loading campaign…</div>
      } @else if (campaign(); as c) {
        <header
          class="sticky top-0 z-10 -mx-4 px-4 py-3 mb-4 backdrop-blur"
          style="background: rgba(20,20,30,0.85); border-bottom: 1px solid var(--color-border);"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h1 class="text-lg font-bold truncate" style="color: var(--color-text);">{{ c.name }}</h1>
                <span class="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded" [style]="statusStyle()">
                  {{ statusLabel() }}
                </span>
                <span class="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style="background: var(--color-bg-3); color: var(--color-text-muted);">
                  {{ ownershipLabel() }}
                </span>
              </div>
              @if (validationHint()) {
                <p class="text-[11px]" style="color: var(--color-text-muted);">{{ validationHint() }}</p>
              }
            </div>
            <div class="flex gap-2">
              @if (c.status === 'planning') {
                <button
                  type="button"
                  (click)="start()"
                  [disabled]="!canStart()"
                  class="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                  style="background: var(--color-sf-green); color: #000;"
                  data-testid="campaign-start"
                >
                  Start campaign
                </button>
              } @else if (c.status === 'active') {
                <button
                  type="button"
                  (click)="complete()"
                  class="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider"
                  style="background: var(--color-sf-cyan); color: #000;"
                  data-testid="campaign-complete"
                >
                  Mark complete
                </button>
              }
            </div>
          </div>
        </header>

        <div class="space-y-4">
          <app-section-basics
            [campaign]="c"
            [readonly]="readonly()"
            (patch)="onPatch($event)"
          />

          @if (showTargeting()) {
            <app-section-targeting
              [campaign]="c"
              [readonly]="readonly()"
              (patch)="onPatch($event)"
            />
          }

          @if (showBudget()) {
            <app-section-budget
              [campaign]="c"
              [readonly]="readonly()"
              (patch)="onPatch($event)"
            />
          }

          @if (showCreators()) {
            <app-section-creators
              [campaign]="c"
              [readonly]="readonly()"
            />
          }

          @if (showOutreach()) {
            <app-section-outreach
              [campaign]="c"
              [readonly]="readonly()"
            />
          }

          @if (showForecast()) {
            <app-section-forecast
              [campaign]="c"
              [readonly]="readonly()"
            />
          }
        </div>
      } @else {
        <div class="text-sm" style="color: var(--color-text-muted);">
          Campaign not found or you don't have access.
        </div>
      }
    </div>
  `,
})
export class CampaignDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private svc = inject(CampaignsService);
  protected creators = inject(CampaignCreatorsService);

  private readonly paramId = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly loading = signal(true);
  protected readonly campaign = signal<Campaign | null>(null);

  protected readonly readonly = computed(() => {
    const c = this.campaign();
    return c?.status === 'completed' || c?.status === 'archived';
  });

  protected readonly showTargeting = computed(() => !!this.campaign()?.name);
  protected readonly showBudget = computed(() => !!this.campaign()?.genre);
  protected readonly showCreators = computed(() => this.campaign()?.budget != null);
  protected readonly showOutreach = computed(() => this.creators.records().length > 0);
  protected readonly showForecast = computed(() => this.creators.records().length > 0);

  protected readonly canStart = computed(() => {
    const c = this.campaign();
    if (!c || c.status !== 'planning') return false;
    return !!c.name && !!c.genre && c.budget != null && this.creators.records().length > 0;
  });

  protected readonly validationHint = computed(() => {
    const c = this.campaign();
    if (!c || c.status !== 'planning') return null;
    if (!c.genre) return 'Fill in targeting (genre) to continue.';
    if (c.budget == null) return 'Set a budget to continue.';
    if (this.creators.records().length === 0) return 'Add at least one creator before starting.';
    return null;
  });

  constructor() {
    void this.loadFromRoute();
  }

  private async loadFromRoute(): Promise<void> {
    const id = this.paramId().get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    const [c] = await Promise.all([
      this.svc.byIdAsync(id),
      this.creators.loadFor(id),
    ]);
    this.campaign.set(c);
    this.loading.set(false);
  }

  async onPatch(patch: UpdateCampaign): Promise<void> {
    const c = this.campaign();
    if (!c) return;
    const updated = await this.svc.update(c.id, patch);
    if (updated) this.campaign.set(updated);
  }

  async start(): Promise<void> {
    const c = this.campaign();
    if (!c || !this.canStart()) return;
    const updated = await this.svc.start(c.id);
    if (updated) this.campaign.set(updated);
  }

  async complete(): Promise<void> {
    const c = this.campaign();
    if (!c) return;
    const updated = await this.svc.complete(c.id);
    if (updated) this.campaign.set(updated);
  }

  protected statusLabel(): string {
    return CAMPAIGN_STATUS_LABELS[this.campaign()!.status];
  }

  protected statusStyle(): string {
    const colors: Record<string, string> = {
      planning: 'background: rgba(155,155,170,0.18); color: var(--color-text-muted);',
      active: 'background: rgba(0,200,120,0.15); color: var(--color-sf-green);',
      completed: 'background: rgba(0,180,220,0.15); color: var(--color-sf-cyan);',
      archived: 'background: rgba(155,155,170,0.10); color: var(--color-text-muted);',
    };
    return colors[this.campaign()?.status ?? 'planning'];
  }

  protected ownershipLabel(): string {
    const c = this.campaign();
    if (!c) return '';
    if (c.enterpriseId === null) return 'Personal';
    return this.auth.enterprise()?.name ?? 'Enterprise';
  }
}
