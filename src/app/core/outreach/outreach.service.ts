import { Injectable, computed, inject, signal } from '@angular/core';
import { OutreachRepository } from './outreach.repository';
import {
  NewOutreachRecord,
  OUTREACH_STATUSES,
  OutreachRecord,
  OutreachStatus,
  UpdateOutreachRecord,
} from './outreach.types';

export interface OutreachFilters {
  campaignId?: string | null; // null means "unassigned"; undefined means "any"
  status?: OutreachStatus;
}

export type StatusCounts = Record<OutreachStatus, number>;

const ZERO_COUNTS: StatusCounts = {
  shortlisted: 0,
  contacted: 0,
  negotiating: 0,
  confirmed: 0,
  declined: 0,
};

@Injectable({ providedIn: 'root' })
export class OutreachService {
  private repo = inject(OutreachRepository);

  readonly records = signal<OutreachRecord[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly filters = signal<OutreachFilters>({});

  readonly byStatus = computed<StatusCounts>(() => {
    const counts: StatusCounts = { ...ZERO_COUNTS };
    for (const r of this.records()) counts[r.status]++;
    return counts;
  });

  readonly filtered = computed<OutreachRecord[]>(() => {
    const f = this.filters();
    return this.records().filter((r) => {
      if (f.status && r.status !== f.status) return false;
      if (f.campaignId !== undefined && r.campaignId !== f.campaignId) return false;
      return true;
    });
  });

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const rows = await this.repo.list();
      this.records.set(rows);
    } catch (err) {
      this.error.set(this.message(err));
    } finally {
      this.loading.set(false);
    }
  }

  async create(dto: NewOutreachRecord): Promise<OutreachRecord | null> {
    try {
      const created = await this.repo.create(dto);
      this.records.update((list) => [created, ...list]);
      return created;
    } catch (err) {
      this.error.set(this.message(err));
      return null;
    }
  }

  async update(id: string, dto: UpdateOutreachRecord): Promise<OutreachRecord | null> {
    try {
      const updated = await this.repo.update(id, dto);
      this.records.update((list) => list.map((r) => (r.id === id ? updated : r)));
      return updated;
    } catch (err) {
      this.error.set(this.message(err));
      return null;
    }
  }

  async remove(id: string): Promise<void> {
    const snapshot = this.records();
    this.records.update((list) => list.filter((r) => r.id !== id));
    try {
      await this.repo.remove(id);
    } catch (err) {
      this.records.set(snapshot);
      this.error.set(this.message(err));
    }
  }

  setFilter(filters: OutreachFilters): void {
    this.filters.set(filters);
  }

  readonly allStatuses = OUTREACH_STATUSES;

  private message(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
