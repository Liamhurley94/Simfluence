import { Component, computed, inject } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-profile-dropdown',
  standalone: true,
  imports: [TitleCasePipe],
  template: `
    <div
      class="absolute right-0 top-full mt-1 w-56 rounded-lg p-2 z-40"
      style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
      data-testid="profile-dropdown"
    >
      <div class="px-3 py-2 border-b" style="border-color: var(--color-border);">
        <div class="text-xs truncate" style="color: var(--color-text);" data-testid="profile-email">
          {{ email() || 'Not signed in' }}
        </div>
        <div
          class="text-[10px] uppercase tracking-wider mt-1"
          style="color: var(--color-sf-gold);"
          data-testid="profile-tier"
        >
          {{ tier() | titlecase }}
        </div>
      </div>
      <button
        type="button"
        (click)="signOut()"
        class="w-full text-left px-3 py-2 mt-1 rounded text-sm hover:bg-[color:var(--color-bg-3)]"
        style="color: var(--color-text);"
        data-testid="profile-signout"
      >
        Sign out
      </button>
    </div>
  `,
})
export class ProfileDropdownComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly email = computed(() => this.auth.user()?.email ?? '');
  readonly tier = this.auth.tier;

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
