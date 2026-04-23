import { Injectable } from '@angular/core';
import { Campaign, NewCampaign, UpdateCampaign } from './campaign.types';

/**
 * Abstract injection token for campaign persistence.
 *
 * This plan ships the in-memory implementation. The separate backend repo
 * will add a Supabase-backed implementation; swap the binding in
 * `app.config.ts` when that's ready — no other code needs to change.
 *
 * Contract:
 *  - `list()` returns all campaigns for the current user, newest first.
 *  - `create()` generates a new id + timestamps; returns the full Campaign.
 *  - `update()` merges partial patch + bumps `updatedAt`; returns the merged row.
 *    Throws if the id is unknown.
 *  - `remove()` deletes by id; silent no-op if the id is unknown.
 */
export abstract class CampaignsRepository {
  abstract list(): Promise<Campaign[]>;
  abstract create(dto: NewCampaign): Promise<Campaign>;
  abstract update(id: string, dto: UpdateCampaign): Promise<Campaign>;
  abstract remove(id: string): Promise<void>;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Default binding — data survives for the life of the Angular app, not reloads.
 * Bound to `CampaignsRepository` via `useClass` in `app.config.ts`.
 */
@Injectable()
export class InMemoryCampaignsRepository extends CampaignsRepository {
  private store = new Map<string, Campaign>();

  async list(): Promise<Campaign[]> {
    return Array.from(this.store.values()).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    );
  }

  async create(dto: NewCampaign): Promise<Campaign> {
    const now = new Date().toISOString();
    const campaign: Campaign = { ...dto, id: newId(), createdAt: now, updatedAt: now };
    this.store.set(campaign.id, campaign);
    return campaign;
  }

  async update(id: string, dto: UpdateCampaign): Promise<Campaign> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`Campaign ${id} not found`);
    const merged: Campaign = {
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

  /** Test-only helper — resets the store between tests. */
  _resetForTests(): void {
    this.store.clear();
  }
}
