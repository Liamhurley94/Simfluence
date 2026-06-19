import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ProfileDropdownComponent } from './profile-dropdown.component';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [ProfileDropdownComponent, IconComponent],
  template: `
    <header
      class="flex items-center justify-between px-4 py-3 border-b"
      style="background: var(--color-bg-2); border-color: var(--color-border);"
    >
      <div
        class="font-bold tracking-tight"
        style="font-family: var(--font-display); font-size: 1.05rem; background: var(--gradient-brand); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
      >Simfluence</div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          (click)="theme.toggle()"
          class="sf-btn sf-btn-ghost text-xs"
          [attr.aria-label]="'Switch to ' + (theme.theme() === 'dark' ? 'light' : 'dark') + ' mode'"
          data-testid="theme-toggle"
        >
          <app-icon [name]="theme.theme() === 'dark' ? 'moon' : 'sun'" [size]="14" />
        </button>

        <div class="relative">
          <button
            type="button"
            (click)="toggleProfile()"
            class="sf-btn sf-btn-ghost text-xs"
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
