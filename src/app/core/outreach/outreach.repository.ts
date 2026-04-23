import { Injectable } from '@angular/core';
import {
  NewOutreachRecord,
  OutreachRecord,
  UpdateOutreachRecord,
} from './outreach.types';

/**
 * Abstract injection token for outreach persistence.
 *
 * This plan ships the in-memory implementation. The separate backend repo
 * will add a Supabase-backed implementation; swap the binding in
 * `app.config.ts` when that's ready.
 *
 * Contract:
 *  - `list()` returns all outreach records for the current user, newest first.
 *  - `create()` generates a new id + timestamps; returns the full record.
 *  - `update()` merges partial patch + bumps `updatedAt`. Throws on unknown id.
 *  - `remove()` deletes by id; silent no-op on unknown id.
 */
export abstract class OutreachRepository {
  abstract list(): Promise<OutreachRecord[]>;
  abstract create(dto: NewOutreachRecord): Promise<OutreachRecord>;
  abstract update(id: string, dto: UpdateOutreachRecord): Promise<OutreachRecord>;
  abstract remove(id: string): Promise<void>;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `otr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

@Injectable()
export class InMemoryOutreachRepository extends OutreachRepository {
  private store = new Map<string, OutreachRecord>();

  async list(): Promise<OutreachRecord[]> {
    return Array.from(this.store.values()).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    );
  }

  async create(dto: NewOutreachRecord): Promise<OutreachRecord> {
    const now = new Date().toISOString();
    const record: OutreachRecord = { ...dto, id: newId(), createdAt: now, updatedAt: now };
    this.store.set(record.id, record);
    return record;
  }

  async update(id: string, dto: UpdateOutreachRecord): Promise<OutreachRecord> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`Outreach record ${id} not found`);
    const merged: OutreachRecord = {
      ...existing,
      ...dto,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.store.set(id, merged);
    return merged;
  }

  async remove(id: string): Promise<void> {
    this.store.delete(id);
  }

  _resetForTests(): void {
    this.store.clear();
  }
}
