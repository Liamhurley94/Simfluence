import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { UpgradePromptService } from '../../core/upgrade/upgrade-prompt.service';
import { Tier, tierRank } from '../../core/types';

interface Tab {
  label: string;
  route: string;
  minTier?: Tier;
}

const TABS: Tab[] = [
  { label: 'Dashboard', route: '/app/dashboard' },
  { label: 'Discovery', route: '/app/discovery' },
  { label: 'Scoring', route: '/app/scoring' },
  { label: 'Personas', route: '/app/personas', minTier: 'silver' },
  { label: 'Simulator', route: '/app/simulator' },
  { label: 'Campaigns', route: '/app/campaigns', minTier: 'silver' },
  { label: 'Outreach', route: '/app/outreach', minTier: 'silver' },
];

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="flex flex-col gap-1">
      @for (tab of tabs; track tab.route) {
        <a
          [attr.href]="tab.route"
          [routerLink]="isLocked(tab) ? null : tab.route"
          routerLinkActive="bg-[color:var(--color-bg-3)]"
          (click)="onClick(tab, $event)"
          class="px-3 py-2 rounded text-sm flex items-center justify-between cursor-pointer"
          [attr.aria-disabled]="isLocked(tab)"
          [attr.data-testid]="'nav-' + tab.label.toLowerCase()"
        >
          <span [class.opacity-50]="isLocked(tab)">{{ tab.label }}</span>
          @if (isLocked(tab)) {
            <span
              class="text-[9px] uppercase tracking-wider"
              style="color: var(--color-sf-gold);"
              data-testid="nav-lock"
            >
              🔒 {{ tab.minTier }}
            </span>
          }
        </a>
      }
    </nav>
  `,
})
export class SideNavComponent {
  private auth = inject(AuthService);
  private upgrade = inject(UpgradePromptService);

  protected readonly tabs = TABS;

  isLocked(tab: Tab): boolean {
    if (!tab.minTier) return false;
    return tierRank(this.auth.tier()) < tierRank(tab.minTier);
  }

  onClick(tab: Tab, event: MouseEvent): void {
    if (this.isLocked(tab)) {
      event.preventDefault();
      this.upgrade.open(tab.label, tab.minTier!);
    }
    // unlocked: routerLink handles navigation
  }
}
