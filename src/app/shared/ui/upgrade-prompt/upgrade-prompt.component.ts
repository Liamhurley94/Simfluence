import { Component, inject } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { UpgradePromptService } from '../../../core/upgrade/upgrade-prompt.service';

@Component({
  selector: 'app-upgrade-prompt',
  standalone: true,
  imports: [TitleCasePipe],
  template: `
    @if (service.current(); as req) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-6"
        style="background: rgba(0, 0, 0, 0.65);"
        (click)="service.close()"
        data-testid="upgrade-backdrop"
      >
        <div
          class="max-w-sm w-full rounded-lg p-6"
          style="background: var(--color-bg-2); border: 1px solid var(--color-border-strong);"
          (click)="$event.stopPropagation()"
          data-testid="upgrade-dialog"
        >
          <div
            class="text-[10px] uppercase tracking-[0.12em] mb-2"
            style="color: var(--color-sf-gold);"
          >
            Upgrade required
          </div>
          <h2 class="text-lg font-bold mb-2" style="color: var(--color-text);">
            {{ req.feature }}
          </h2>
          <p class="text-sm mb-5" style="color: var(--color-text-muted);">
            Available on {{ req.requiredTier | titlecase }} and above. Upgrade your plan to unlock
            this feature.
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 py-2 rounded font-semibold text-sm"
              style="background: var(--color-sf-blue); color: white;"
              data-testid="upgrade-cta"
            >
              See plans
            </button>
            <button
              type="button"
              (click)="service.close()"
              class="flex-1 py-2 rounded font-semibold text-sm"
              style="background: transparent; border: 1px solid var(--color-border); color: var(--color-text);"
              data-testid="upgrade-close"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class UpgradePromptComponent {
  readonly service = inject(UpgradePromptService);
}