import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { EnterpriseService } from '../../core/enterprise/enterprise.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-3" novalidate>
      @if (inviteToken()) {
        <div
          class="text-xs px-3 py-2 rounded"
          style="background: rgba(255,212,0,0.08); border: 1px solid var(--color-sf-gold); color: var(--color-text);"
          data-testid="signup-invite-banner"
        >
          You've been invited to join an enterprise. Complete signup below.
        </div>
      }
      <input
        type="email"
        formControlName="email"
        placeholder="Email"
        autocomplete="email"
        [readonly]="!!inviteToken()"
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
        {{ busy() ? 'Creating account…' : (inviteToken() ? 'Join enterprise' : 'Create free account') }}
      </button>
      @if (!inviteToken()) {
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
      }
    </form>
  `,
})
export class SignupComponent {
  private auth = inject(AuthService);
  private enterprise = inject(EnterpriseService);
  private fb = inject(FormBuilder);

  readonly signedUp = output<void>();

  readonly inviteToken = input<string | undefined>(undefined);
  readonly inviteEmail = input<string | undefined>(undefined);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    // Pre-fill (and lock) the email from invite param.
    effect(() => {
      const e = this.inviteEmail();
      if (e) {
        this.form.controls.email.setValue(e);
      }
    });
  }

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
      const token = this.inviteToken();
      if (token) {
        try {
          await this.enterprise.acceptInvite(token);
          await this.auth.refresh();
        } catch (inviteErr) {
          // Sign-up succeeded but linking failed. Surface a soft message and continue.
          this.error.set(
            'Account created, but the invite could not be applied. Contact your enterprise owner.',
          );
        }
      }
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