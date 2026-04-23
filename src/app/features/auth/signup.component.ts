import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-signup',
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
        data-testid="signup-email"
      />
      <input
        type="password"
        formControlName="password"
        placeholder="Create password (min 8 chars)"
        autocomplete="new-password"
        class="w-full px-3 py-2 rounded text-sm"
        style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
        data-testid="signup-password"
      />
      @if (error()) {
        <div class="text-xs" style="color: var(--color-sf-red);" data-testid="signup-error">
          {{ error() }}
        </div>
      }
      <button
        type="submit"
        [disabled]="busy()"
        class="w-full py-2 rounded font-semibold text-sm disabled:opacity-60"
        style="background: var(--color-sf-blue); color: white;"
        data-testid="signup-submit"
      >
        {{ busy() ? 'Creating account…' : 'Create free account' }}
      </button>
      <a
        href="https://calendly.com/"
        target="_blank"
        rel="noopener"
        class="text-xs mt-1 self-center"
        style="color: var(--color-sf-gold);"
        data-testid="signup-demo-link"
      >
        📅 BOOK A LIVE DEMO INSTEAD
      </a>
    </form>
  `,
})
export class SignupComponent {
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  readonly signedUp = output<void>();

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.error.set('Please enter a valid email and password (8+ chars).');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.signUp(email, password);
      this.signedUp.emit();
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message ??
        'Please enter a valid email and password (8+ chars).';
      this.error.set(message);
    } finally {
      this.busy.set(false);
    }
  }
}