import { Component } from '@angular/core';

/** Sweeps sub-view of the Add-creators tab — placeholder shell so the tab
 *  wires and builds ahead of the real implementation (a later frontend task). */
@Component({
  selector: 'app-discovery-sweeps',
  standalone: true,
  template: `
    <div data-testid="discovery-sweeps" class="text-sm" style="color: var(--color-text-muted);">
      Sweeps — coming in the next task.
    </div>
  `,
})
export class DiscoverySweepsComponent {}
