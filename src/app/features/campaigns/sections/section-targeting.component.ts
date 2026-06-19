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
      class="sf-panel p-5"
      data-testid="section-targeting"
    >
      <h2 class="text-xs uppercase tracking-wider font-bold mb-4" style="color: var(--color-text-muted);">
        Targeting
      </h2>

      <label class="block">
        <span class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">Genre</span>
        <select
          [(ngModel)]="selected"
          (change)="commit()"
          [disabled]="readonly"
          class="sf-select mt-1"
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
