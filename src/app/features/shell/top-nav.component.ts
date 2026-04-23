import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ProfileDropdownComponent } from './profile-dropdown.component';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [ProfileDropdownComponent],
  template: `
    <header
      class="flex items-center justify-between px-4 py-3 border-b"
      style="background: var(--color-bg-2); border-color: var(--color-border);"
    >
      <div class="text-sm font-bold" style="color: var(--color-sf-blue);">Simfluence</div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          (click)="theme.toggle()"
          class="text-xs px-2 py-1 rounded"
          style="color: var(--color-text);"
          [attr.aria-label]="'Switch to ' + (theme.theme() === 'dark' ? 'light' : 'dark') + ' mode'"
          data-testid="theme-toggle"
        >
          {{ theme.theme() === 'dark' ? '🌙' : '☀️' }}
        </button>

        <div class="relative">
          <button
            type="button"
            (click)="toggleProfile()"
            class="text-xs px-3 py-1.5 rounded"
            style="background: var(--color-bg-3); color: var(--color-text);"
            [attr.aria-expanded]="profileOpen()"
            data-testid="profile-toggle"
          >
            {{ shortLabel() }}
          </button>
          @if (profileOpen()) {
            <app-profile-dropdown />
          }
        </div>
      </div>
    </header>
  `,
})
export class TopNavComponent {
  protected theme = inject(ThemeService);
  private auth = inject(AuthService);

  protected readonly profileOpen = signal(false);

  protected readonly shortLabel = computed(() => {
    const email = this.auth.user()?.email;
    if (!email) return 'Account';
    // show first part of email, e.g. 'brandon' from 'brandon@example.com'
    return email.split('@')[0];
  });

  toggleProfile(): void {
    this.profileOpen.update((v) => !v);
  }
}
