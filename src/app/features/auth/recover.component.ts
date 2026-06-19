import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-recover',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-3" novalidate>
      <div class="text-sm mb-1" style="color: var(--color-text);">Reset your password</div>
      <p class="text-xs mb-2" style="color: var(--color-text-muted);">
        Enter your email and we'll send you a reset link.
      </p>
      <input
        type="email"
        formControlName="email"
        placeholder="Email"
        autocomplete="email"
        [disabled]="sent()"
        class="sf-input"
        data-testid="recover-email"
      />
      @if (sent()) {
        <div class="text-xs" style="color: var(--color-sf-green);" data-testid="recover-success">
          Reset email sent — check your inbox.
        </div>
      } @else if (error()) {
        <div class="text-xs" style="color: var(--color-sf-red);" data-testid="recover-error">
          {{ error() }}
        </div>
      }
      <button
        type="submit"
        [disabled]="busy() || sent()"
        class="sf-btn sf-btn-primary w-full"
        data-testid="recover-submit"
      >
        {{ busy() ? 'Sending…' : sent() ? 'Sent' : 'Send reset link' }}
      </button>
      <button
        type="button"
        (click)="back.emit()"
        class="text-xs mt-1 self-center"
        style="color: var(--color-text-muted);"
        data-testid="recover-back"
      >
        Back to sign in
      </button>
    </form>
  `,
})
export class RecoverComponent {
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  readonly back = output<void>();

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly sent = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.error.set('Enter a valid email address.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.recover(this.form.getRawValue().email);
      this.sent.set(true);
    } catch {
      this.error.set('Something went wrong. Try again in a moment.');
    } finally {
      this.busy.set(false);
    }
  }
}