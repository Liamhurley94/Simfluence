import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    <div class="flex items-center justify-center gap-2" data-testid="pagination">
      <button
        type="button"
        (click)="go(page() - 1)"
        [disabled]="page() <= 0"
        class="text-xs px-3 py-1.5 rounded disabled:opacity-40"
        style="background: var(--color-bg-3); color: var(--color-text);"
        data-testid="page-prev"
      >
        ← Prev
      </button>
      <span class="text-xs" style="color: var(--color-text-muted);" data-testid="page-indicator">
        Page {{ page() + 1 }} of {{ pageCount() }}
      </span>
      <button
        type="button"
        (click)="go(page() + 1)"
        [disabled]="page() >= pageCount() - 1"
        class="text-xs px-3 py-1.5 rounded disabled:opacity-40"
        style="background: var(--color-bg-3); color: var(--color-text);"
        data-testid="page-next"
      >
        Next →
      </button>
    </div>
  `,
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly pageCount = input.required<number>();
  readonly pageChange = output<number>();

  go(target: number): void {
    if (target < 0 || target >= this.pageCount()) return;
    this.pageChange.emit(target);
  }
}
