import { Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  template: `
    <span class="inline-flex items-center gap-2">
      <svg
        [attr.width]="size()"
        [attr.height]="size()"
        viewBox="0 0 24 24"
        fill="none"
        stroke-linecap="round"
        aria-hidden="true"
        class="animate-spin motion-reduce:animate-none"
      >
        <!-- Faint full ring -->
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="var(--color-border-strong)"
          stroke-width="2.5"
        />
        <!-- Brighter ~25% arc segment (circumference ≈ 62.83; 25% ≈ 15.7) -->
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="var(--color-text-dim)"
          stroke-width="2.5"
          stroke-dasharray="15.7 47.13"
          stroke-dashoffset="0"
        />
      </svg>
      @if (label()) {
        <span class="text-xs" style="color: var(--color-text-muted);">{{ label() }}</span>
      }
    </span>
  `,
})
export class SpinnerComponent {
  readonly size = input<number>(20);
  readonly label = input<string | undefined>(undefined);
}
