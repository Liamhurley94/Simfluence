import { Component } from '@angular/core';
import { PROPRIETARY_NOTE } from './compliance-copy';

/**
 * Always-visible disclaimer caption shown beneath a "Source: Simfluence" zone
 * header (discovery card + profile modal). Carries the YouTube III.E.4h required
 * assertion that Simfluence scores are independently calculated — NOT a tooltip,
 * so it renders in the screenshots YouTube reviews. Wording: compliance-copy.ts.
 */
@Component({
  selector: 'app-proprietary-note',
  standalone: true,
  template: `
    <p
      class="text-[10px] leading-snug italic m-0 sf-disclaimer"
      data-testid="proprietary-note"
    >
      {{ note }}
    </p>
  `,
})
export class ProprietaryNoteComponent {
  protected readonly note = PROPRIETARY_NOTE;
}
