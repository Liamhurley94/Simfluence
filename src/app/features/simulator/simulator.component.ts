import { Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SpinnerComponent } from '../../shared/spinner/spinner.component';
import { SimulationPanelComponent } from '../../shared/simulation/simulation-panel.component';
import { RosterComparisonComponent } from './roster-comparison.component';

import { CampaignContextService } from '../../core/context/campaign-context.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { CreatorProfileService } from '../../core/creator-profile/creator-profile.service';
import { SelectionService } from '../../core/selection/selection.service';
import { W2Response } from '../../core/simulation/simulation-w2.types';
import { CampaignsService } from '../../core/campaigns/campaigns.service';
import { CampaignCreatorsService } from '../../core/campaigns/campaign-creators.service';
import { Creator } from '../../core/data/creator.types';

@Component({
  selector: 'app-simulator',
  standalone: true,
  imports: [RouterLink, SpinnerComponent, SimulationPanelComponent, RosterComparisonComponent],
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
        <div class="flex items-center justify-between mb-2">
          <div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">
            Creators selected from Discovery ({{ creators().length }})
          </div>
          <button type="button" (click)="comparing.set(!comparing())"
            class="sf-btn sf-btn-ghost text-[10px] uppercase tracking-wider"
            data-testid="sim-compare-toggle">
            {{ comparing() ? 'Single roster' : 'Compare rosters' }}
          </button>
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
      @if (comparing()) {
        <!-- D24 §4: two rosters, same budget, side-by-side. Ephemeral — no
             save; Discovery stays the picking surface. -->
        <app-roster-comparison
          [creators]="creators()"
          [genres]="genres()"
          [initialGenre]="context.genre()"
        />
      } @else {
        <app-simulation-panel
          mode="free"
          [creatorIds]="creatorIds()"
          [initialGenre]="context.genre()"
          [genres]="genres()"
          [subMode]="context.subMode() || undefined"
          [autoRun]="autoRun"
          (simulated)="onSimulated($event)"
          (failed)="result.set(null)"
        >
          <button type="button" (click)="saveToCampaigns()" [disabled]="!result()"
            class="sf-btn text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            style="background: var(--color-sf-green); color: var(--color-bg);" data-testid="sim-save">
            Save to campaigns
          </button>
        </app-simulation-panel>
      }
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

  protected readonly result = signal<W2Response | null>(null);
  // Roster comparison (D24 §4) — swaps the single-run panel for the
  // side-by-side view; Save is single-roster-only so it hides while comparing.
  protected readonly comparing = signal(false);

  // Async batch fetch of selected creators; re-runs when selection changes.
  private readonly creatorsRes = resource<Creator[], number[]>({
    params: () => Array.from(this.selection.ids()),
    loader: ({ params }) => this.creatorsSvc.byIds(params),
    defaultValue: [],
  });
  protected readonly creators = computed(() => this.creatorsRes.value());
  // The panel sends ids only — the server loads every stat, rate and score it
  // needs (spec §2). Derived from the hydrated roster so the forecast covers
  // exactly the creators rendered as chips above it.
  protected readonly creatorIds = computed(() => this.creators().map((c) => c.id));
  // True only when there is a non-empty selection in flight — avoids flashing
  // the spinner on the genuine "nothing selected" empty state.
  protected readonly creatorsLoading = computed(
    () => this.selection.ids().size > 0 && this.creatorsRes.isLoading(),
  );

  onSimulated(r: W2Response): void {
    this.result.set(r);
  }

  openProfile(c: Creator): void {
    this.profile.open(c);
  }

  /**
   * Turn a free-mode run into a real campaign: create it, add the roster (each
   * add seeds that creator's default deliverable), and go there.
   *
   * It deliberately does NOT persist the forecast (spec §1). A free run prices
   * synthesised default deliverables at rate-band midpoints; a campaign's saved
   * baseline has to come from its own booked deliverables and negotiated fees,
   * or the debrief later grades the campaign against numbers it was never
   * planned on. The campaign forecast panel is the only writer of
   * `campaigns.forecast`.
   */
  async saveToCampaigns(): Promise<void> {
    const r = this.result();
    if (!r) return;

    // Budget comes from the simulation result – the budget the sim actually ran
    // with, not whatever the control reads now.
    const created = await this.campaignsSvc.create({
      name: `${this.context.genre()} campaign — ${new Date().toLocaleDateString()}`,
      genre: this.context.genre(),
      budget: r.budget,
    });
    if (!created) return;
    const ids = this.creators().map((c) => c.id);
    await Promise.all(
      ids.map((cid) =>
        this.campaignCreators.add({ campaignId: created.id, creatorId: cid, source: 'simulator' }),
      ),
    );
    void this.router.navigate(['/app/campaigns', created.id]);
  }
}
