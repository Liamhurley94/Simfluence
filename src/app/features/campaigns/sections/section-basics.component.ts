import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Campaign, UpdateCampaign } from '../../../core/campaigns/campaign.types';

@Component({
  selector: 'app-section-basics',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section
      class="p-4 rounded-lg"
      style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
      data-testid="section-basics"
    >
      <h2 class="text-xs uppercase tracking-wider font-bold mb-3" style="color: var(--color-text-muted);">
        Basics
      </h2>

      <label class="block mb-3">
        <span class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">Name</span>
        <input
          type="text"
          [(ngModel)]="name"
          (blur)="commitName()"
          [readOnly]="readonly"
          class="w-full mt-1 px-2 py-1.5 rounded text-sm"
          style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text);"
          data-testid="basics-name"
        />
      </label>

      <label class="block">
        <span class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">Client</span>
        <input
          type="text"
          [(ngModel)]="client"
          (blur)="commitClient()"
          [readOnly]="readonly"
          placeholder="Brand or sponsor name"
          class="w-full mt-1 px-2 py-1.5 rounded text-sm"
          style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text);"
          data-testid="basics-client"
        />
      </label>
    </section>
  `,
})
export class SectionBasicsComponent {
  @Input({ required: true }) set campaign(c: Campaign) {
    this.name = c.name;
    this.client = c.client ?? '';
    this.initial = { name: c.name, client: c.client ?? '' };
  }
  @Input() readonly = false;
  @Output() patch = new EventEmitter<UpdateCampaign>();

  name = '';
  client = '';
  private initial: { name: string; client: string } = { name: '', client: '' };

  commitName(): void {
    const trimmed = this.name.trim();
    if (trimmed && trimmed !== this.initial.name) {
      this.patch.emit({ name: trimmed });
    } else if (!trimmed) {
      this.name = this.initial.name; // revert empty
    }
  }

  commitClient(): void {
    const trimmed = this.client.trim();
    if (trimmed !== this.initial.client) {
      this.patch.emit({ client: trimmed || null });
    }
  }
}
