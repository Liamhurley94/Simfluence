import { Component, input } from '@angular/core';
import {
  MetricSource,
  MetricSourceBadgeComponent,
} from '../metric-source/metric-source-badge.component';

/**
 * Zone header that labels a block of metrics by data source — e.g.
 * "Source: ● YouTube API" or "Source: ● Simfluence". Used to visually separate
 * platform API data from Simfluence proprietary scores on the discovery card and
 * in the profile modal (YouTube III.E.4h). Reuses the metric-source-badge for
 * the colored dot + label, so a `label` like "YouTube API" overrides the badge's
 * default platform name.
 */
@Component({
  selector: 'app-source-zone-header',
  standalone: true,
  imports: [MetricSourceBadgeComponent],
  template: `
    <div class="flex items-center gap-1.5">
      <span class="text-[9px] uppercase tracking-widest" style="color: var(--color-text-muted);">
        Source:
      </span>
      <app-metric-source-badge [source]="source()" [label]="label()" />
    </div>
  `,
})
export class SourceZoneHeaderComponent {
  readonly source = input.required<MetricSource>();
  readonly label = input<string>();
}
