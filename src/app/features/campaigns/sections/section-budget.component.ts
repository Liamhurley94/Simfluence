import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Campaign, UpdateCampaign } from '../../../core/campaigns/campaign.types';

const OBJECTIVE_OPTIONS = [
  'Brand awareness',
  'Engagement',
  'Conversions',
  'App installs',
  'Sign-ups',
];

@Component({
  selector: 'app-section-budget',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section
      class="p-4 rounded-lg"
      style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
      data-testid="section-budget"
    >
      <h2 class="text-xs uppercase tracking-wider font-bold mb-3" style="color: var(--color-text-muted);">
        Budget & objectives
      </h2>

      <label class="block mb-4">
        <span class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">Budget (USD)</span>
        <input
          type="number"
          min="0"
          step="1000"
          [(ngModel)]="budget"
          (blur)="commitBudget()"
          [readOnly]="readonly"
          class="w-full mt-1 px-2 py-1.5 rounded text-sm"
          style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text);"
          data-testid="budget-input"
        />
      </label>

      <div>
        <span class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">Objectives</span>
        <div class="mt-2 flex flex-wrap gap-2">
          @for (opt of options; track opt) {
            <button
              type="button"
              (click)="toggle(opt)"
              [disabled]="readonly"
              class="px-2 py-1 rounded text-xs"
              [style]="objectiveStyle(opt)"
              [attr.data-testid]="'objective-' + opt"
            >
              {{ opt }}
            </button>
          }
        </div>
      </div>
    </section>
  `,
})
export class SectionBudgetComponent {
  readonly options = OBJECTIVE_OPTIONS;

  @Input({ required: true }) set campaign(c: Campaign) {
    this.budget = c.budget;
    this.initialBudget = c.budget;
    this.objectives = new Set(c.objectives);
  }
  @Input() readonly = false;
  @Output() patch = new EventEmitter<UpdateCampaign>();

  budget: number | null = null;
  private initialBudget: number | null = null;
  objectives = new Set<string>();

  commitBudget(): void {
    if (this.budget !== this.initialBudget) {
      this.patch.emit({ budget: this.budget == null || this.budget < 0 ? null : Number(this.budget) });
      this.initialBudget = this.budget;
    }
  }

  toggle(opt: string): void {
    if (this.readonly) return;
    if (this.objectives.has(opt)) this.objectives.delete(opt);
    else this.objectives.add(opt);
    this.patch.emit({ objectives: Array.from(this.objectives) });
  }

  protected objectiveStyle(opt: string): string {
    if (this.objectives.has(opt)) {
      return 'background: var(--color-sf-blue); color: white;';
    }
    return 'background: var(--color-bg-3); color: var(--color-text-muted); border: 1px solid var(--color-border);';
  }
}
