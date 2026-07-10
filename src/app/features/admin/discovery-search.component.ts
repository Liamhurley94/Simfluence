import { Component, output } from '@angular/core';

/** Search sub-view of the Add-creators tab — placeholder shell so the tab
 *  wires and builds ahead of the real implementation (Task 6/7 backend +
 *  a later frontend task). Emits `staged` whenever a candidate gets added
 *  to the queue, so the shell can refresh its badge counts. */
@Component({
  selector: 'app-discovery-search',
  standalone: true,
  template: `
    <div data-testid="discovery-search" class="text-sm" style="color: var(--color-text-muted);">
      Search — coming in the next task.
    </div>
  `,
})
export class DiscoverySearchComponent {
  readonly staged = output<void>();
}
