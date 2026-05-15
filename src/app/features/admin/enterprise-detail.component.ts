import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { EnterpriseService } from '../../core/enterprise/enterprise.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Enterprise, EnterpriseInvite } from '../../core/enterprise/enterprise.types';

interface MemberRow { id: string; email: string | null; tier: string | null; }

@Component({
  selector: 'app-enterprise-detail',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div
      class="fixed inset-0 z-40 flex items-start justify-center p-6 overflow-auto"
      style="background: rgba(0,0,0,0.7);"
      (click)="close()"
    >
      <div
        class="max-w-2xl w-full p-6 rounded-lg flex flex-col gap-4 mt-12"
        style="background: var(--color-bg-2); border: 1px solid var(--color-border-strong);"
        (click)="$event.stopPropagation()"
        data-testid="enterprise-detail"
      >
        @if (loading()) {
          <p class="text-sm" style="color: var(--color-text-muted);">Loading…</p>
        } @else if (error()) {
          <p class="text-sm" style="color: #ff8080;">{{ error() }}</p>
        } @else if (enterprise(); as e) {
          <header class="flex justify-between items-start">
            <div>
              <h2 class="text-xl font-bold" style="color: var(--color-text);">{{ e.name }}</h2>
              <p class="text-xs uppercase tracking-wider" [style.color]="statusColor(e.status)">{{ e.status }}</p>
            </div>
            <button
              type="button"
              (click)="close()"
              class="text-xs"
              style="color: var(--color-text-muted);"
            >✕</button>
          </header>

          <dl class="text-sm grid grid-cols-[140px_1fr] gap-y-1" style="color: var(--color-text);">
            <dt style="color: var(--color-text-muted);">Contact</dt><dd>{{ e.contact_email }}</dd>
            @if (e.address) { <dt style="color: var(--color-text-muted);">Address</dt><dd>{{ e.address }}</dd> }
            <dt style="color: var(--color-text-muted);">Applied</dt><dd>{{ e.created_at | date:'medium' }}</dd>
            @if (e.approved_at) {
              <dt style="color: var(--color-text-muted);">Approved</dt><dd>{{ e.approved_at | date:'medium' }}</dd>
            }
            @if (e.rejected_reason) {
              <dt style="color: var(--color-text-muted);">Reject reason</dt><dd>{{ e.rejected_reason }}</dd>
            }
          </dl>

          <section>
            <h3 class="text-sm font-bold mb-2 uppercase tracking-wider" style="color: var(--color-text-muted);">Members ({{ members().length }})</h3>
            @if (members().length === 0) {
              <p class="text-sm" style="color: var(--color-text-muted);">No members yet.</p>
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
          </section>

          <section>
            <h3 class="text-sm font-bold mb-2 uppercase tracking-wider" style="color: var(--color-text-muted);">Pending invites ({{ pendingInvites().length }})</h3>
            @if (pendingInvites().length === 0) {
              <p class="text-sm" style="color: var(--color-text-muted);">None.</p>
            } @else {
              <ul class="text-sm flex flex-col gap-1">
                @for (i of pendingInvites(); track i.id) {
                  <li class="flex justify-between" style="color: var(--color-text);">
                    <span>{{ i.email }}</span>
                    <span class="text-xs" style="color: var(--color-text-muted);">expires {{ i.expires_at | date:'mediumDate' }}</span>
                  </li>
                }
              </ul>
            }
          </section>

          @if (e.status === 'pending') {
            <div class="flex gap-2 justify-end mt-2 border-t pt-4" style="border-color: var(--color-border);">
              <button
                type="button"
                (click)="showRejectForm.set(!showRejectForm())"
                [disabled]="busy()"
                class="px-4 py-2 rounded text-sm"
                style="background: rgba(255,80,80,0.15); color: #ff8080;"
                data-testid="admin-reject"
              >
                Reject
              </button>
              <button
                type="button"
                (click)="onApprove()"
                [disabled]="busy()"
                class="px-4 py-2 rounded text-sm font-medium"
                style="background: var(--color-sf-gold); color: #000;"
                data-testid="admin-approve"
              >
                {{ busy() ? 'Working…' : 'Approve' }}
              </button>
            </div>

            @if (showRejectForm()) {
              <div class="border-t pt-3" style="border-color: var(--color-border);">
                <label class="text-[10px] uppercase tracking-wider mb-1 block" style="color: var(--color-text-muted);">Rejection reason (optional)</label>
                <textarea
                  rows="2"
                  [value]="rejectReason()"
                  (input)="rejectReason.set($any($event.target).value)"
                  class="w-full px-3 py-2 rounded text-sm"
                  style="background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text);"
                  data-testid="admin-reject-reason"
                ></textarea>
                <button
                  type="button"
                  (click)="onReject()"
                  [disabled]="busy()"
                  class="mt-2 px-4 py-2 rounded text-sm"
                  style="background: rgba(255,80,80,0.15); color: #ff8080;"
                  data-testid="admin-reject-confirm"
                >Confirm reject</button>
              </div>
            }
          }
        }
      </div>
    </div>
  `,
})
export class EnterpriseDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(EnterpriseService);
  private supabase = inject(SupabaseService);

  private readonly paramId = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly enterprise = signal<Enterprise | null>(null);
  protected readonly members = signal<MemberRow[]>([]);
  protected readonly invites = signal<EnterpriseInvite[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly showRejectForm = signal(false);
  protected readonly rejectReason = signal('');

  protected readonly pendingInvites = computed(() => this.invites().filter((i) => i.status === 'pending'));

  constructor() {
    void this.load();
  }

  private get id(): string | null {
    return this.paramId().get('id');
  }

  private async load(): Promise<void> {
    const id = this.id;
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const [entRes, memRes, invRes] = await Promise.all([
        this.supabase.client.from('enterprises').select('*').eq('id', id).maybeSingle(),
        this.supabase.client.from('profiles').select('id, email, tier').eq('enterprise_id', id),
        this.supabase.client.from('enterprise_invites').select('*').eq('enterprise_id', id),
      ]);
      if (entRes.error) throw entRes.error;
      this.enterprise.set(entRes.data as Enterprise | null);
      this.members.set((memRes.data ?? []) as MemberRow[]);
      this.invites.set((invRes.data ?? []) as EnterpriseInvite[]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      this.loading.set(false);
    }
  }

  async onApprove(): Promise<void> {
    const id = this.enterprise()?.id;
    if (!id) return;
    this.busy.set(true);
    try {
      await this.svc.adminApprove(id);
      await this.load();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      this.busy.set(false);
    }
  }

  async onReject(): Promise<void> {
    const id = this.enterprise()?.id;
    if (!id) return;
    this.busy.set(true);
    try {
      await this.svc.adminReject(id, this.rejectReason().trim() || undefined);
      this.showRejectForm.set(false);
      await this.load();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      this.busy.set(false);
    }
  }

  close(): void {
    void this.router.navigate(['/app/admin']);
  }

  protected statusColor(status: string): string {
    switch (status) {
      case 'pending':  return 'var(--color-sf-gold)';
      case 'active':   return '#00c46a';
      case 'rejected': return '#ff8080';
      default:         return 'var(--color-text-muted)';
    }
  }
}
