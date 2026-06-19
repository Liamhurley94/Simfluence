import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <section class="py-8 max-w-3xl mx-auto flex flex-col gap-6">
      <header>
        <h1 class="text-2xl font-bold" style="color: var(--color-text);">Dashboard</h1>
        <p class="mt-1 text-sm" style="color: var(--color-text-muted);">Phase 2 content.</p>
      </header>
      <div class="sf-card p-5">
        <p class="text-sm" style="color: var(--color-text-muted);">Insights and metrics will appear here.</p>
      </div>
    </section>
  `,
})
export class DashboardComponent {}