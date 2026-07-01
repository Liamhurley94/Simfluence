import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
import { SpinnerComponent } from '../../shared/spinner/spinner.component';
import { SimulationPanelComponent } from '../../shared/simulation/simulation-panel.component';

import { CampaignContextService } from '../../core/context/campaign-context.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { SelectionService } from '../../core/selection/selection.service';
import { SimResult } from '../../core/simulation/simulation.types';
import { CampaignsService } from '../../core/campaigns/campaigns.service';
import { CampaignCreatorsService } from '../../core/campaigns/campaign-creators.service';
import { Creator } from '../../core/data/creator.types';

@Component({
  selector: 'app-simulator',
  standalone: true,
  imports: [RouterLink, SpinnerComponent, SimulationPanelComponent],
  template: `
    <div class="sf-appear">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold" style="color: var(--color-text);">Simulator</h1>
      <div class="text-xs" style="color: var(--color-text-muted);" data-testid="sim-selection-count">
        {{ creators().length }} creator{{ creators().length === 1 ? '' : 's' }} in shortlist
      </div>
    </div>

    @if (creatorsLoading()) {
      <div class="flex justify-center py-12">
        <app-spinner label="Loading creators…" />
      </div>
    } @else if (creators().length === 0) {
      <div
        class="sf-card p-12 text-center"
        data-testid="sim-empty"
      >
        <div class="text-sm font-semibold mb-2" style="color: var(--color-text);">
          No creators selected
        </div>
        <p class="text-xs mb-4" style="color: var(--color-text-muted);">
          Pick a shortlist on Discovery or use a persona auto-select.
        </p>
        <a
          routerLink="/app/discovery"
          class="sf-btn sf-btn-primary text-xs"
        >
          Go to Discovery
        </a>
      </div>
    } @else {
      <app-simulation-panel
        [creators]="creators()"
        [initialGenre]="context.genre()"
        [genres]="genres()"
        [subMode]="context.subMode() || undefined"
        (simulated)="onSimulated($event)"
      />
      <div class="flex items-center gap-2 mt-4" data-testid="sim-actions">
        <button type="button" (click)="saveToCampaigns()" [disabled]="!result()"
          class="sf-btn text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
          style="background: var(--color-sf-green); color: var(--color-bg);" data-testid="sim-save">
          Save to campaigns
        </button>
      </div>
    }
    </div>
  `,
})
export class SimulatorComponent {
  private selection = inject(SelectionService);
  private creatorsSvc = inject(CreatorsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private campaignsSvc = inject(CampaignsService);
  private campaignCreators = inject(CampaignCreatorsService);

  // When the simulator is opened via /simulator?campaign=:id (e.g. from the
  // campaign detail page's "Run simulation" link), Save updates that campaign
  // instead of creating a new one. Captured once at init.
  protected readonly attachedCampaignId = this.route.snapshot.queryParamMap.get('campaign');
  protected readonly context = inject(CampaignContextService);

  protected readonly genres = this.creatorsSvc.genres;

  protected readonly result = signal<SimResult | null>(null);

  // Async batch fetch of selected creators; re-runs when selection changes.
  private readonly creatorsRes = resource<Creator[], number[]>({
    params: () => Array.from(this.selection.ids()),
    loader: ({ params }) => this.creatorsSvc.byIds(params),
    defaultValue: [],
  });
  protected readonly creators = computed(() => this.creatorsRes.value());
  // True only when there is a non-empty selection in flight — avoids flashing
  // the spinner on the genuine "nothing selected" empty state.
  protected readonly creatorsLoading = computed(
    () => this.selection.ids().size > 0 && this.creatorsRes.isLoading(),
  );

  onSimulated(r: SimResult): void {
    this.result.set(r);
  }

  async saveToCampaigns(): Promise<void> {
    const r = this.result();
    if (!r) return;

    const forecast = {
      impressions: r.impressions,
      ctr: r.ctr,
      cvr: r.cvr,
      roas: r.roas,
      p10: r.p10,
      p50: r.p50,
      p90: r.p90,
    };

    // Path A: attached to an existing campaign — update its forecast, add any
    // newly-simulated creators to its campaign_creators with source='simulator'.
    if (this.attachedCampaignId) {
      const id = this.attachedCampaignId;
      await this.campaignsSvc.update(id, { forecast });
      await this.campaignCreators.loadFor(id);
      const existingCreatorIds = new Set(this.campaignCreators.records().map((cc) => cc.creatorId));
      const toAdd = this.creators().map((c) => c.id).filter((cid) => !existingCreatorIds.has(cid));
      await Promise.all(
        toAdd.map((cid) =>
          this.campaignCreators.add({ campaignId: id, creatorId: cid, source: 'simulator' }),
        ),
      );
      void this.router.navigate(['/app/campaigns', id]);
      return;
    }

    // Path B: standalone save — create a new campaign with the basics + forecast.
    // Use the budget from the simulation result (the budget the sim was actually run with).
    const created = await this.campaignsSvc.create({
      name: `${this.context.genre()} campaign — ${new Date().toLocaleDateString()}`,
      genre: this.context.genre(),
      budget: r.budget,
    });
    if (!created) return;
    await this.campaignsSvc.update(created.id, { forecast });
    const ids = this.creators().map((c) => c.id);
    await Promise.all(
      ids.map((cid) =>
        this.campaignCreators.add({ campaignId: created.id, creatorId: cid, source: 'simulator' }),
      ),
    );
    void this.router.navigate(['/app/campaigns', created.id]);
  }
}
