import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-3" novalidate>
      <input
        type="email"
        formControlName="email"
        placeholder="Email"
        autocomplete="email"
        class="w-full px-3 py-2 rounded text-sm"
        style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
        data-testid="login-email"
      />
      <input
        type="password"
        formControlName="password"
        placeholder="Password"
        autocomplete="current-password"
        class="w-full px-3 py-2 rounded text-sm"
        style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
        data-testid="login-password"
      />
      @if (error()) {
        <div class="text-xs" style="color: var(--color-sf-red);" data-testid="login-error">
          {{ error() }}
        </div>
      }
      <button
        type="submit"
        [disabled]="busy()"
        class="w-full py-2 rounded font-semibold text-sm disabled:opacity-60"
        style="background: var(--color-sf-blue); color: white;"
        data-testid="login-submit"
      >
        {{ busy() ? 'Signing in…' : 'Sign in' }}
      </button>
      <button
        type="button"
        (click)="forgot.emit()"
        class="text-xs mt-1 self-center"
        style="color: var(--color-text-muted);"
        data-testid="login-forgot"
      >
        Forgot password?
      </button>
    </form>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  readonly signedIn = output<void>();
  readonly forgot = output<void>();

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.error.set('Incorrect email or password. Try again.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.signIn(email, password);
      this.signedIn.emit();
    } catch {
      this.error.set('Incorrect email or password. Try again.');
    } finally {
      this.busy.set(false);
    }
  }
}