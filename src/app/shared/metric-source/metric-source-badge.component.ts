import { Component, computed, input } from '@angular/core';

export type MetricSource = 'youtube' | 'twitch' | 'simfluence';

interface SourceMeta {
  /** Theme token (CSS var name) for the dot + text color. */
  colorVar: string;
  /** Default human label when no explicit `label` is provided. */
  defaultLabel: string;
}

const SOURCE_META: Record<MetricSource, SourceMeta> = {
  youtube: { colorVar: '--color-sf-red', defaultLabel: 'YouTube' },
  twitch: { colorVar: '--color-twitch', defaultLabel: 'Twitch' },
  simfluence: { colorVar: '--color-sf-blue', defaultLabel: 'Simfluence' },
};

/**
 * Small inline indicator clarifying where a metric comes from: a platform
 * (YouTube / Twitch — live stats) or Simfluence (computed: CPI/GFI/budget/
 * benchmarks). Theme-token driven so the colors track light + dark mode.
 *
 * Generic by design — it carries no metric value, just the source label, so it
 * can sit beside any number across discovery cards, the profile modal, the
 * simulator, etc. in the rendering phase.
 *
 * Usage: `<app-metric-source-badge source="youtube" />`
 *        `<app-metric-source-badge source="simfluence" label="Estimated" />`
 */
@Component({
  selector: 'app-metric-source-badge',
  standalone: true,
  template: `
    <span
      class="inline-flex items-center gap-1 text-[10px] leading-none uppercase tracking-wider whitespace-nowrap"
      [style.color]="'var(' + colorVar() + ')'"
      [attr.data-testid]="'metric-source-' + source()"
      [attr.title]="text()"
    >
      <span
        class="block rounded-full shrink-0"
        style="width: 6px; height: 6px;"
        [style.background]="'var(' + colorVar() + ')'"
        aria-hidden="true"
      ></span>
      {{ text() }}
    </span>
  `,
})
export class MetricSourceBadgeComponent {
  readonly source = input.required<MetricSource>();
  readonly label = input<string>();

  protected readonly colorVar = computed(() => SOURCE_META[this.source()].colorVar);
  protected readonly text = computed(() => this.label() ?? SOURCE_META[this.source()].defaultLabel);
}
