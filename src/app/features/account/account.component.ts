import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { EnterpriseService } from '../../core/enterprise/enterprise.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { EnterpriseInvite } from '../../core/enterprise/enterprise.types';

interface MemberRow {
  id: string;
  email: string | null;
  tier: string | null;
}

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <section class="max-w-3xl mx-auto py-8 flex flex-col gap-6 sf-appear">
      <header>
        <h1 class="text-2xl font-bold" style="color: var(--color-text);">Account</h1>
        <p class="mt-1 text-sm" style="color: var(--color-text-muted);">
          {{ statusLabel() }}
        </p>
      </header>

      <!-- BASIC: two CTAs -->
      @if (status() === 'basic') {
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="sf-card p-5">
            <h2 class="text-lg font-bold mb-1" style="color: var(--color-text);">Upgrade to Full</h2>
            <p class="text-sm mb-4" style="color: var(--color-text-muted);">Unlock all features for an individual account.</p>
            <button
              type="button"
              (click)="onUpgradeToFull()"
              [disabled]="busy()"
              class="sf-btn sf-btn-primary"
              data-testid="account-upgrade-full"
            >
              {{ busy() ? 'Working…' : 'Upgrade to Full' }}
            </button>
          </div>

          <div class="sf-card p-5">
            <h2 class="text-lg font-bold mb-1" style="color: var(--color-text);">Apply for Enterprise</h2>
            <p class="text-sm mb-4" style="color: var(--color-text-muted);">Invite teammates after admin approval.</p>
            <button
              type="button"
              (click)="showApplyForm.set(true)"
              class="sf-btn sf-btn-ghost"
              data-testid="account-apply-enterprise"
            >
              Apply for Enterprise
            </button>
          </div>
        </div>
      }

      <!-- FULL: still allow applying for enterprise -->
      @if (status() === 'full') {
        <div class="sf-card p-5">
          <h2 class="text-lg font-bold mb-1" style="color: var(--color-text);">Full account</h2>
          <p class="text-sm mb-4" style="color: var(--color-text-muted);">You have full access. Want to add teammates?</p>
          <button
            type="button"
            (click)="showApplyForm.set(true)"
            class="sf-btn sf-btn-ghost"
            data-testid="account-apply-enterprise"
          >
            Apply for Enterprise
          </button>
        </div>
      }

      <!-- PENDING banner -->
      @if (status() === 'enterprise_pending') {
        <div class="sf-card p-5" style="border-color: var(--color-sf-gold);">
          <h2 class="text-lg font-bold mb-1" style="color: var(--color-sf-gold);">Enterprise application pending</h2>
          <p class="text-sm" style="color: var(--color-text-muted);">An admin will review your application shortly.</p>
          @if (auth.enterprise(); as ent) {
            <dl class="mt-4 text-sm grid grid-cols-[120px_1fr] gap-y-1" style="color: var(--color-text);">
              <dt style="color: var(--color-text-muted);">Company</dt><dd>{{ ent.name }}</dd>
              <dt style="color: var(--color-text-muted);">Contact</dt><dd>{{ ent.contact_email }}</dd>
              @if (ent.address) { <dt style="color: var(--color-text-muted);">Address</dt><dd>{{ ent.address }}</dd> }
            </dl>
          }
        </div>
      }

      <!-- REJECTED banner -->
      @if (status() === 'enterprise_rejected') {
        <div class="sf-card p-5" style="border-color: color-mix(in srgb, var(--color-sf-red) 50%, transparent);">
          <h2 class="text-lg font-bold mb-1" style="color: var(--color-sf-red);">Enterprise application rejected</h2>
          @if (auth.enterprise()?.rejected_reason; as reason) {
            <p class="text-sm" style="color: var(--color-text);">{{ reason }}</p>
          }
          <button
            type="button"
            (click)="showApplyForm.set(true)"
            class="sf-btn sf-btn-ghost mt-3"
            data-testid="account-reapply-enterprise"
          >
            Re-apply
          </button>
        </div>
      }

      <!-- MEMBER (read-only) -->
      @if (status() === 'enterprise_member') {
        <div class="sf-card p-5">
          <h2 class="text-lg font-bold mb-1" style="color: var(--color-text);">{{ auth.enterprise()?.name }}</h2>
          <p class="text-sm" style="color: var(--color-text-muted);">You are a member of this enterprise.</p>
        </div>
      }

      <!-- OWNER: enterprise info + members + invite -->
      @if (status() === 'enterprise_owner' && auth.enterprise(); as ent) {
        <div class="sf-card p-5">
          <h2 class="text-lg font-bold mb-1" style="color: var(--color-text);">{{ ent.name }}</h2>
          <p class="text-xs uppercase tracking-wider" style="color: var(--color-sf-gold);">Active enterprise · owner</p>
        </div>

        <div class="sf-card p-5">
          <h3 class="text-sm font-bold mb-3 uppercase tracking-wider" style="color: var(--color-text-muted);">Invite teammate</h3>
          <form [formGroup]="inviteForm" (ngSubmit)="onInvite()" class="flex gap-2">
            <input
              type="email"
              formControlName="email"
              placeholder="teammate@example.com"
              class="sf-input flex-1"
              data-testid="account-invite-email"
            />
            <button
              type="submit"
              [disabled]="busy() || inviteForm.invalid"
              class="sf-btn sf-btn-primary"
              data-testid="account-invite-submit"
            >
              {{ busy() ? 'Sending…' : 'Invite' }}
            </button>
          </form>
          @if (inviteError()) {
            <p class="mt-2 text-xs" style="color: var(--color-sf-red);">{{ inviteError() }}</p>
          }
          @if (inviteSuccess()) {
            <p class="mt-2 text-xs" style="color: var(--color-sf-gold);">{{ inviteSuccess() }}</p>
          }
        </div>

        <div class="sf-card p-5">
          <h3 class="text-sm font-bold mb-3 uppercase tracking-wider" style="color: var(--color-text-muted);">Pending invites</h3>
          @if (enterprise.invitesLoading()) {
            <p class="text-sm" style="color: var(--color-text-muted);">Loading…</p>
          } @else if (pendingInvites().length === 0) {
            <p class="text-sm" style="color: var(--color-text-muted);">No pending invites.</p>
          } @else {
            <ul class="text-sm flex flex-col gap-1">
              @for (inv of pendingInvites(); track inv.id) {
                <li class="flex justify-between" style="color: var(--color-text);">
                  <span>{{ inv.email }}</span>
                  <span class="text-xs" style="color: var(--color-text-muted);">expires {{ inv.expires_at | date:'mediumDate' }}</span>
                </li>
              }
            </ul>
          }
        </div>

        <div class="sf-card p-5">
          <h3 class="text-sm font-bold mb-3 uppercase tracking-wider" style="color: var(--color-text-muted);">Members</h3>
          @if (members().length === 0) {
            <p class="text-sm" style="color: var(--color-text-muted);">Just you for now.</p>
          } @else {
            <ul class="text-sm flex flex-col gap-1">
              @for (m of members(); track m.id) {
                <li class="flex justify-between" style="color: var(--color-text);">
                  <span>{{ m.email }}</span>
                  <span class="text-xs" style="color: var(--color-text-muted);">{{ m.tier ?? '—' }}</span>
                </li>
              }
            </ul>
          }
        </div>
      }

      <!-- APPLY FOR ENTERPRISE FORM (modal) -->
      @if (showApplyForm()) {
        <div
          class="fixed inset-0 z-40 flex items-center justify-center p-6 sf-fade-in"
          style="background: var(--color-overlay);"
          (click)="showApplyForm.set(false)"
        >
          <form
            [formGroup]="applyForm"
            (ngSubmit)="onApply()"
            (click)="$event.stopPropagation()"
            class="sf-card max-w-lg w-full p-6 flex flex-col gap-3 sf-modal-in"
            data-testid="apply-enterprise-form"
          >
            <h2 class="text-lg font-bold mb-2" style="color: var(--color-text);">Apply for Enterprise</h2>

            <div>
              <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">Company name *</label>
              <input
                type="text"
                formControlName="name"
                class="sf-input"
                data-testid="apply-enterprise-name"
              />
            </div>
            <div>
              <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">Contact email *</label>
              <input
                type="email"
                formControlName="contact_email"
                class="sf-input"
                data-testid="apply-enterprise-contact"
              />
            </div>
            <div>
              <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">Address</label>
              <textarea
                rows="3"
                formControlName="address"
                class="sf-input"
                data-testid="apply-enterprise-address"
              ></textarea>
            </div>

            @if (applyError()) {
              <p class="text-xs" style="color: var(--color-sf-red);">{{ applyError() }}</p>
            }

            <div class="flex justify-end gap-2 mt-2">
              <button
                type="button"
                (click)="showApplyForm.set(false)"
                class="sf-btn sf-btn-ghost"
              >Cancel</button>
              <button
                type="submit"
                [disabled]="busy() || applyForm.invalid"
                class="sf-btn sf-btn-primary"
                data-testid="apply-enterprise-submit"
              >
                {{ busy() ? 'Submitting…' : 'Submit application' }}
              </button>
            </div>
          </form>
        </div>
      }
    </section>
  `,
})
export class AccountComponent {
  protected readonly auth = inject(AuthService);
  protected readonly enterprise = inject(EnterpriseService);
  private supabase = inject(SupabaseService);
  private fb = inject(FormBuilder);

  protected readonly status = this.auth.accountStatus;
  protected readonly busy = signal(false);
  protected readonly showApplyForm = signal(false);
  protected readonly applyError = signal<string | null>(null);
  protected readonly inviteError = signal<string | null>(null);
  protected readonly inviteSuccess = signal<string | null>(null);
  protected readonly members = signal<MemberRow[]>([]);

  protected readonly pendingInvites = computed<EnterpriseInvite[]>(() =>
    this.enterprise.invites().filter((i) => i.status === 'pending'),
  );

  protected readonly statusLabel = computed(() => {
    switch (this.status()) {
      case 'basic':                return 'Free account — choose how to upgrade.';
      case 'full':                 return 'Full account — all individual features unlocked.';
      case 'enterprise_pending':   return 'Awaiting admin approval.';
      case 'enterprise_rejected':  return 'Application rejected. You can re-apply below.';
      case 'enterprise_member':    return 'Enterprise member.';
      case 'enterprise_owner':     return 'Enterprise owner.';
      default:                     return '';
    }
  });

  protected readonly applyForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    contact_email: ['', [Validators.required, Validators.email]],
    address: [''],
  });

  protected readonly inviteForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    // Load enterprise-scoped data when state is right.
    queueMicrotask(() => void this.refreshOwnerData());
  }

  private async refreshOwnerData(): Promise<void> {
    const eid = this.auth.enterpriseId();
    if (!eid || this.status() !== 'enterprise_owner') return;
    await this.enterprise.loadInvites(eid);
    const { data } = await this.supabase.client
      .from('profiles')
      .select('id, email, tier')
      .eq('enterprise_id', eid);
    this.members.set((data ?? []) as MemberRow[]);
  }

  async onUpgradeToFull(): Promise<void> {
    this.busy.set(true);
    try {
      await this.enterprise.upgradeToFull();
      await this.auth.refresh();
    } finally {
      this.busy.set(false);
    }
  }

  async onApply(): Promise<void> {
    if (this.applyForm.invalid) return;
    this.applyError.set(null);
    this.busy.set(true);
    try {
      const raw = this.applyForm.getRawValue();
      await this.enterprise.applyForEnterprise({
        name: raw.name.trim(),
        contact_email: raw.contact_email.trim(),
        address: raw.address.trim() || null,
      });
      await this.auth.refresh();
      this.showApplyForm.set(false);
      this.applyForm.reset();
    } catch (err) {
      this.applyError.set(this.message(err));
    } finally {
      this.busy.set(false);
    }
  }

  async onInvite(): Promise<void> {
    if (this.inviteForm.invalid) return;
    this.inviteError.set(null);
    this.inviteSuccess.set(null);
    this.busy.set(true);
    try {
      const email = this.inviteForm.getRawValue().email.trim();
      await this.enterprise.inviteUser(email);
      this.inviteSuccess.set(`Invitation sent to ${email}.`);
      this.inviteForm.reset();
      await this.refreshOwnerData();
    } catch (err) {
      this.inviteError.set(this.message(err));
    } finally {
      this.busy.set(false);
    }
  }

  private message(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err && 'error' in err) {
      const e = (err as { error?: { error?: string } }).error;
      if (e?.error) return e.error;
    }
    return 'Something went wrong.';
  }
}
