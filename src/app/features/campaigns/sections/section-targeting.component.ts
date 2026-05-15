import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreatorsService } from '../../../core/creators/creators.service';
import { Campaign, UpdateCampaign } from '../../../core/campaigns/campaign.types';

@Component({
  selector: 'app-section-targeting',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section
      class="p-4 rounded-lg"
      style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
      data-testid="section-targeting"
    >
      <h2 class="text-xs uppercase tracking-wider font-bold mb-3" style="color: var(--color-text-muted);">
        Targeting
      </h2>

      <label class="block">
        <span class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">Genre</span>
        <select
          [(ngModel)]="selected"
          (change)="commit()"
          [disabled]="readonly"
          class="w-full mt-1 px-2 py-1.5 rounded text-sm"
          style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text);"
          data-testid="targeting-genre"
        >
          <option value="">— Select a genre —</option>
          @for (g of creators.genres(); track g) {
            <option [value]="g">{{ g }}</option>
          }
        </select>
      </label>
    </section>
  `,
})
export class SectionTargetingComponent {
  protected creators = inject(CreatorsService);

  @Input({ required: true }) set campaign(c: Campaign) {
    this.selected = c.genre ?? '';
    this.initial = c.genre ?? '';
  }
  @Input() readonly = false;
  @Output() patch = new EventEmitter<UpdateCampaign>();

  selected = '';
  private initial = '';

  commit(): void {
    const next = this.selected || null;
    if (next !== (this.initial || null)) {
      this.patch.emit({ genre: next });
    }
  }
}
