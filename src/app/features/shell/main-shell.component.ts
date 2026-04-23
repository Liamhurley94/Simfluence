import { Component, effect, inject } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { SideNavComponent } from './side-nav.component';
import { TopNavComponent } from './top-nav.component';
import { UpgradePromptComponent } from '../../shared/ui/upgrade-prompt/upgrade-prompt.component';
import { UpgradePromptService } from '../../core/upgrade/upgrade-prompt.service';
import { Tier, TIER_LEVELS } from '../../core/types';

const VALID_TIERS = new Set<string>(Object.keys(TIER_LEVELS));

@Component({
  selector: 'app-main-shell',
  standalone: true,
  imports: [RouterOutlet, SideNavComponent, TopNavComponent, UpgradePromptComponent],
  template: `
    <div class="min-h-screen flex flex-col">
      <app-top-nav />
      <div class="flex-1 grid" style="grid-template-columns: 220px 1fr;">
        <aside class="p-4 border-r" style="background: var(--color-bg-2); border-color: var(--color-border);">
          <app-side-nav />
        </aside>
        <main class="p-6">
          <router-outlet />
        </main>
      </div>
      <app-upgrade-prompt />
    </div>
  `,
})
export class MainShellComponent {
  private upgrade = inject(UpgradePromptService);
  private queryParams = toSignal(inject(ActivatedRoute).queryParamMap);

  constructor() {
    // When tierGuard redirects with ?upgrade=<tier>, auto-open the upgrade overlay.
    effect(() => {
      const tier = this.queryParams()?.get('upgrade');
      if (tier && VALID_TIERS.has(tier)) {
        this.upgrade.open('This feature', tier as Tier);
      }
    });
  }
}
