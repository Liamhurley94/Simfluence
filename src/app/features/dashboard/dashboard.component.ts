import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `<h1 class="text-2xl font-bold">Dashboard</h1>
    <p class="mt-2 text-sm" style="color: var(--color-text-muted);">Phase 2 content.</p>`,
})
export class DashboardComponent {}