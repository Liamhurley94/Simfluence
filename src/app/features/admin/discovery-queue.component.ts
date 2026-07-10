import { Component, output } from '@angular/core';

/** Review-queue sub-view of the Add-creators tab — placeholder shell so the
 *  tab wires and builds ahead of the real implementation (a later frontend
 *  task). Emits `changed` whenever a candidate's status flips (add/reject/
 *  shortlist), so the shell can refresh its badge counts. */
@Component({
  selector: 'app-discovery-queue',
  standalone: true,
  template: `
    <div data-testid="discovery-queue" class="text-sm" style="color: var(--color-text-muted);">
      Review queue — coming in the next task.
    </div>
  `,
})
export class DiscoveryQueueComponent {
  readonly changed = output<void>();
}
