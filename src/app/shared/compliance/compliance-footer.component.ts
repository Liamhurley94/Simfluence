import { Component } from '@angular/core';
import { COMPLIANCE_FOOTER } from './compliance-copy';

/**
 * App-shell compliance footer — a slim bar fixed to the bottom of the viewport,
 * present on every authenticated (/app) page. Mounted once in MainShellComponent
 * so it never appears on public/marketing routes (landing, login, pricing).
 *
 * Carries the YouTube III.E.4h disclaimer always-visibly, so any screenshot of
 * any data page contains it. Sits below the modal overlays (z-40 vs their z-50);
 * the profile modal carries its own per-box disclaimers when open.
 */
@Component({
  selector: 'app-compliance-footer',
  standalone: true,
  template: `
    <div
      class="fixed bottom-0 left-0 right-0 z-40 px-4 py-1.5 text-center text-[10px] leading-snug sf-disclaimer"
      style="background: var(--color-bg-2); border-top: 1px solid var(--color-border);"
      data-testid="compliance-footer"
    >
      {{ text }}
    </div>
  `,
})
export class ComplianceFooterComponent {
  protected readonly text = COMPLIANCE_FOOTER;
}
