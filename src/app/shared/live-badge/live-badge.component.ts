import { Component, input } from '@angular/core';

@Component({
  selector: 'app-live-badge',
  standalone: true,
  template: `
    <span
      class="inline-flex items-center gap-1 text-[8px] uppercase tracking-wider font-bold"
      style="color: var(--color-sf-red);"
      data-testid="live-badge"
    >
      <span
        class="inline-block rounded-full"
        style="width: 6px; height: 6px; background: var(--color-sf-red); animation: livePulse 1.4s ease-in-out infinite;"
      ></span>
      @if (showLabel()) {
        <span>Live</span>
      }
    </span>
  `,
})
export class LiveBadgeComponent {
  // Hide the "Live" text when there isn't room — dot-only mode.
  readonly showLabel = input(true);
}
