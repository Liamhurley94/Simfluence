import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { EnterpriseService } from '../../core/enterprise/enterprise.service';
import { EnterpriseWithStats } from '../../core/enterprise/enterprise.types';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterLink, RouterOutlet, DatePipe],
  template: `
    <section class="py-8">
      <header class="mb-6">
        <h1 class="text-2xl font-bold" style="color: var(--color-text);">Admin</h1>
        <p class="text-sm mt-1" style="color: var(--color-text-muted);">Enterprise approvals.</p>
      </header>

      <router-outlet />

      @if (loading()) {
        <p class="text-sm" style="color: var(--color-text-muted);">Loading enterprises…</p>
      } @else if (error()) {
        <p class="text-sm" style="color: #ff8080;">{{ error() }}</p>
      } @else if (enterprises().length === 0) {
        <p class="text-sm" style="color: var(--color-text-muted);">No enterprises yet.</p>
      } @else {
        <div class="rounded-lg overflow-hidden" style="background: var(--color-bg-2); border: 1px solid var(--color-border);">
          <table class="w-full text-sm" data-testid="admin-enterprises-table">
            <thead>
              <tr style="color: var(--color-text-muted); background: rgba(255,255,255,0.03);">
                <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider font-medium">Name</th>
                <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider font-medium">Contact</th>
                <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider font-medium">Owner</th>
                <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider font-medium">Status</th>
                <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider font-medium">Members</th>
                <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider font-medium">Applied</th>
              </tr>
            </thead>
            <tbody>
              @for (e of enterprises(); track e.id) {
                <tr
                  [routerLink]="['/app/admin', e.id]"
                  class="cursor-pointer"
                  style="color: var(--color-text); border-top: 1px solid var(--color-border);"
                  data-testid="admin-enterprise-row"
                >
                  <td class="px-3 py-2 font-medium">{{ e.name }}</td>
                  <td class="px-3 py-2">{{ e.contact_email }}</td>
                  <td class="px-3 py-2">{{ e.owner_email ?? '—' }}</td>
                  <td class="px-3 py-2">
                    <span
                      class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
                      [style.background]="badgeBg(e.status)"
                      [style.color]="badgeFg(e.status)"
                    >{{ e.status }}</span>
                  </td>
                  <td class="px-3 py-2">{{ e.member_count }}</td>
                  <td class="px-3 py-2 text-xs" style="color: var(--color-text-muted);">{{ e.created_at | date:'mediumDate' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class AdminComponent {
  private svc = inject(EnterpriseService);

  protected readonly enterprises = signal<EnterpriseWithStats[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const { enterprises } = await this.svc.adminListEnterprises();
      this.enterprises.set(enterprises);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      this.loading.set(false);
    }
  }

  protected badgeBg(status: string): string {
    switch (status) {
      case 'pending':  return 'rgba(255, 212, 0, 0.15)';
      case 'active':   return 'rgba(0, 196, 106, 0.15)';
      case 'rejected': return 'rgba(255, 80, 80, 0.15)';
      default:         return 'rgba(255,255,255,0.08)';
    }
  }
  protected badgeFg(status: string): string {
    switch (status) {
      case 'pending':  return 'var(--color-sf-gold)';
      case 'active':   return '#00c46a';
      case 'rejected': return '#ff8080';
      default:         return 'var(--color-text-muted)';
    }
  }
}
