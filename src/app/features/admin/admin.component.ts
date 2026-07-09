import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { EnterpriseService } from '../../core/enterprise/enterprise.service';
import { EnterpriseWithStats } from '../../core/enterprise/enterprise.types';
import { AdminCreatorsComponent } from './admin-creators.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterLink, RouterOutlet, DatePipe, AdminCreatorsComponent],
  template: `
    <section class="py-8 sf-appear">
      <header class="mb-6">
        <h1 class="text-2xl font-bold" style="color: var(--color-text);">Admin</h1>
        <p class="text-sm mt-1" style="color: var(--color-text-muted);">Manage enterprises and creators.</p>
      </header>

      <router-outlet />

      <div class="rounded-xl overflow-hidden" style="border: 1px solid var(--color-border);">
        <div class="flex" role="tablist" style="border-bottom: 1px solid var(--color-border);">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="tab() === 'enterprises'"
            (click)="tab.set('enterprises')"
            class="px-5 py-3 text-sm transition-colors"
            style="border-bottom-width: 2px; border-bottom-style: solid; margin-bottom: -1px;"
            [style.border-bottom-color]="tab() === 'enterprises' ? 'var(--color-sf-gold)' : 'transparent'"
            [style.color]="tab() === 'enterprises' ? 'var(--color-text)' : 'var(--color-text-muted)'"
            [style.font-weight]="tab() === 'enterprises' ? '600' : '400'"
            data-testid="admin-tab-enterprises"
          >Enterprises</button>
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="tab() === 'creators'"
            (click)="tab.set('creators')"
            class="px-5 py-3 text-sm transition-colors"
            style="border-bottom-width: 2px; border-bottom-style: solid; margin-bottom: -1px;"
            [style.border-bottom-color]="tab() === 'creators' ? 'var(--color-sf-gold)' : 'transparent'"
            [style.color]="tab() === 'creators' ? 'var(--color-text)' : 'var(--color-text-muted)'"
            [style.font-weight]="tab() === 'creators' ? '600' : '400'"
            data-testid="admin-tab-creators"
          >Creators</button>
        </div>
        <div class="p-5">

      @switch (tab()) {
      @case ('enterprises') {

      @if (loading()) {
        <p class="text-sm" style="color: var(--color-text-muted);">Loading enterprises…</p>
      } @else if (error()) {
        <p class="text-sm" style="color: var(--color-sf-red);">{{ error() }}</p>
      } @else if (enterprises().length === 0) {
        <p class="text-sm" style="color: var(--color-text-muted);">No enterprises yet.</p>
      } @else {
        <div class="sf-card overflow-hidden">
          <table class="w-full text-sm" data-testid="admin-enterprises-table">
            <thead>
              <tr style="color: var(--color-text-muted); background: var(--color-bg-3);">
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
                      class="sf-chip"
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

      }
      @case ('creators') {
        <app-admin-creators />
      }
      }
        </div>
      </div>
    </section>
  `,
})
export class AdminComponent {
  private svc = inject(EnterpriseService);

  protected readonly enterprises = signal<EnterpriseWithStats[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Active admin tab. The enterprise-detail `<router-outlet />` renders a modal
   *  overlay, so it stays outside the switch and works regardless of active tab. */
  readonly tab = signal<'enterprises' | 'creators'>('enterprises');

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
      case 'pending':  return 'color-mix(in srgb, var(--color-sf-gold) 15%, transparent)';
      case 'active':   return 'color-mix(in srgb, var(--color-sf-green) 15%, transparent)';
      case 'rejected': return 'color-mix(in srgb, var(--color-sf-red) 15%, transparent)';
      default:         return 'var(--color-bg-3)';
    }
  }
  protected badgeFg(status: string): string {
    switch (status) {
      case 'pending':  return 'var(--color-sf-gold)';
      case 'active':   return 'var(--color-sf-green)';
      case 'rejected': return 'var(--color-sf-red)';
      default:         return 'var(--color-text-muted)';
    }
  }
}
