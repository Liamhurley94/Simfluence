import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

const PRESETS: { value: number; label: string }[] = [
  { value: 10_000, label: '$10K' },
  { value: 50_000, label: '$50K' },
  { value: 250_000, label: '$250K' },
  { value: 500_000, label: '$500K' },
  { value: 1_000_000, label: '$1M' },
  { value: 2_000_000, label: '$2M' },
];

/**
 * Segmented budget picker (preset chips + Custom input). Same presets as
 * legacy prod. Emits `valueChange` whenever the selection changes.
 *
 * Used as a discovery filter (filters creators by affordability) and as a
 * context source for "Create campaign from discovery" (campaign budget is
 * pre-populated from this value).
 */
@Component({
  selector: 'app-budget-picker',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex items-center gap-2 flex-wrap" data-testid="budget-picker">
      <span class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">Budget</span>
      @for (p of presets; track p.value) {
        <button
          type="button"
          (click)="pick(p.value)"
          class="px-2 py-1 rounded text-xs"
          [style]="chipStyle(p.value)"
          [attr.data-testid]="'budget-preset-' + p.value"
        >
          {{ p.label }}
        </button>
      }
      <button
        type="button"
        (click)="enableCustom()"
        class="px-2 py-1 rounded text-xs"
        [style]="customChipStyle()"
        data-testid="budget-custom"
      >
        Custom
      </button>
      @if (customMode()) {
        <input
          type="number"
          [(ngModel)]="customValue"
          (blur)="commitCustom()"
          min="1000"
          step="1000"
          placeholder="$"
          class="w-28 px-2 py-1 rounded text-xs"
          style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text);"
          data-testid="budget-custom-input"
        />
      }
    </div>
  `,
})
export class BudgetPickerComponent {
  readonly presets = PRESETS;

  @Input() set value(v: number | null) {
    this.current = v;
    this.customMode.set(v !== null && !PRESETS.some((p) => p.value === v));
    this.customValue = v ?? null;
  }
  @Output() valueChange = new EventEmitter<number | null>();

  current: number | null = null;
  customValue: number | null = null;
  protected readonly customMode = signal(false);

  pick(v: number): void {
    this.current = v;
    this.customMode.set(false);
    this.valueChange.emit(v);
  }

  enableCustom(): void {
    this.customMode.set(true);
    if (this.customValue == null) this.customValue = this.current ?? null;
  }

  commitCustom(): void {
    if (this.customValue == null || this.customValue <= 0) return;
    this.current = Number(this.customValue);
    this.valueChange.emit(this.current);
  }

  protected chipStyle(v: number): string {
    if (this.current === v && !this.customMode()) {
      return 'background: var(--color-sf-blue); color: white;';
    }
    return 'background: var(--color-bg-3); color: var(--color-text-muted); border: 1px solid var(--color-border);';
  }

  protected customChipStyle(): string {
    if (this.customMode()) {
      return 'background: var(--color-sf-blue); color: white;';
    }
    return 'background: var(--color-bg-3); color: var(--color-text-muted); border: 1px solid var(--color-border);';
  }
}
