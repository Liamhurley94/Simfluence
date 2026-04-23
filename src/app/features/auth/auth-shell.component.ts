import { Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { LoginComponent } from './login.component';
import { SignupComponent } from './signup.component';
import { RecoverComponent } from './recover.component';

type TabKey = 'signup' | 'signin' | 'recover';

@Component({
  selector: 'app-auth-shell',
  standalone: true,
  imports: [LoginComponent, SignupComponent, RecoverComponent],
  template: `
    <div class="min-h-screen flex items-center justify-center p-6">
      <div
        class="max-w-md w-full p-8 rounded-lg"
        style="background: var(--color-bg-2); border: 1px solid var(--color-border);"
      >
        <div class="mb-6 text-lg font-bold" style="color: var(--color-sf-blue);">
          Simfluence
        </div>

        @if (tab() !== 'recover') {
          <div
            class="flex gap-4 mb-6 text-[10px] uppercase tracking-[0.12em]"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="tab() === 'signup'"
              (click)="tab.set('signup')"
              [class.font-bold]="tab() === 'signup'"
              [class.opacity-40]="tab() !== 'signup'"
              style="color: var(--color-text);"
              data-testid="tab-signup"
            >
              Sign up free
            </button>
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="tab() === 'signin'"
              (click)="tab.set('signin')"
              [class.font-bold]="tab() === 'signin'"
              [class.opacity-40]="tab() !== 'signin'"
              style="color: var(--color-text);"
              data-testid="tab-signin"
            >
              Sign in
            </button>
          </div>
        }

        @switch (tab()) {
          @case ('signup') {
            <app-signup (signedUp)="onAuthed()" />
          }
          @case ('signin') {
            <app-login (signedIn)="onAuthed()" (forgot)="tab.set('recover')" />
          }
          @case ('recover') {
            <app-recover (back)="tab.set('signin')" />
          }
        }
      </div>
    </div>
  `,
})
export class AuthShellComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  /** `returnTo` query param (from authGuard redirect). */
  readonly returnTo = input<string | undefined>(undefined);

  readonly tab = signal<TabKey>('signin');

  constructor() {
    // If the user is already authenticated, bounce to the app.
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.navigateAway();
      }
    });
  }

  onAuthed(): void {
    this.navigateAway();
  }

  private navigateAway(): void {
    const target = this.returnTo() || '/app/dashboard';
    void this.router.navigateByUrl(target);
  }
}