import { Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SpinnerComponent } from '../../shared/spinner/spinner.component';
import { SimulationPanelComponent } from '../../shared/simulation/simulation-panel.component';

import { CampaignContextService } from '../../core/context/campaign-context.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { CreatorProfileService } from '../../core/creator-profile/creator-profile.service';
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
    <h1 class="text-xl font-bold mb-6" style="color: var(--color-text);">Simulator</h1>

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
          Select creators on Discovery to simulate.
        </p>
        <a
          routerLink="/app/discovery"
          class="sf-btn sf-btn-primary text-xs"
        >
          Go to Discovery
        </a>
      </div>
    } @else {
      <div class="sf-panel p-3 mb-6" data-testid="sim-selected">
        <div class="text-[10px] uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">
          Creators selected from Discovery ({{ creators().length }})
        </div>
        <div class="flex flex-wrap gap-1.5">
          @for (c of creators(); track c.id) {
            <button
              type="button"
              (click)="openProfile(c)"
              class="sf-chip cursor-pointer"
              data-testid="sim-selected-chip"
            >
              {{ c.name }}
            </button>
          }
        </div>
      </div>
      <app-simulation-panel
        [creators]="creators()"
        [initialGenre]="context.genre()"
        [genres]="genres()"
        [subMode]="context.subMode() || undefined"
        [autoRun]="autoRun"
        (simulated)="onSimulated($event)"
      >
        <button type="button" (click)="saveToCampaigns()" [disabled]="!result()"
          class="sf-btn text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
          style="background: var(--color-sf-green); color: var(--color-bg);" data-testid="sim-save">
          Save to campaigns
        </button>
      </app-simulation-panel>
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
  private profile = inject(CreatorProfileService);

  protected readonly context = inject(CampaignContextService);

  // Discovery's "Simulate selected" navigates with ?run=1 to request one
  // automatic run on arrival (the nav tab, without the flag, does not).
  protected readonly autoRun = this.route.snapshot.queryParamMap.get('run') === '1';

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

  openProfile(c: Creator): void {
    this.profile.open(c);
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

    // Standalone save — create a new campaign with the basics + forecast.
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
