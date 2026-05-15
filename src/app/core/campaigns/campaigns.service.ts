import { Injectable, computed, inject, signal } from '@angular/core';
import { CampaignsRepository } from './campaigns.repository';
import { Campaign, NewCampaign, UpdateCampaign } from './campaign.types';

@Injectable({ providedIn: 'root' })
export class CampaignsService {
  private repo = inject(CampaignsRepository);

  readonly campaigns = signal<Campaign[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly loaded = computed(() => !this.loading() && this.campaigns().length >= 0 && this.lastLoadAt() !== null);
  private lastLoadAt = signal<number | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const rows = await this.repo.list();
      this.campaigns.set(rows);
      this.lastLoadAt.set(Date.now());
    } catch (err) {
      this.error.set(this.message(err));
    } finally {
      this.loading.set(false);
    }
  }

  async create(dto: NewCampaign): Promise<Campaign | null> {
    try {
      const created = await this.repo.create(dto);
      this.campaigns.update((list) => [created, ...list]);
      return created;
    } catch (err) {
      this.error.set(this.message(err));
      return null;
    }
  }

  async update(id: string, dto: UpdateCampaign): Promise<Campaign | null> {
    try {
      const updated = await this.repo.update(id, dto);
      this.campaigns.update((list) => list.map((c) => (c.id === id ? updated : c)));
      return updated;
    } catch (err) {
      this.error.set(this.message(err));
      return null;
    }
  }

  async remove(id: string): Promise<void> {
    const snapshot = this.campaigns();
    this.campaigns.update((list) => list.filter((c) => c.id !== id));
    try {
      await this.repo.remove(id);
    } catch (err) {
      this.campaigns.set(snapshot);
      this.error.set(this.message(err));
    }
  }

  /** Cached lookup. Returns undefined if the list hasn't been loaded; use `byIdAsync` for deep-links. */
  byId(id: string): Campaign | undefined {
    return this.campaigns().find((c) => c.id === id);
  }

  /** Cache-first, falls back to a backend fetch. Updates the cache on hit. */
  async byIdAsync(id: string): Promise<Campaign | null> {
    const cached = this.byId(id);
    if (cached) return cached;
    try {
      const fetched = await this.repo.byId(id);
      if (fetched) {
        this.campaigns.update((list) => {
          const others = list.filter((c) => c.id !== id);
          return [fetched, ...others];
        });
      }
      return fetched;
    } catch (err) {
      this.error.set(this.message(err));
      return null;
    }
  }

  /** Transition planning → active. Caller is responsible for the validity gate (name/genre/budget/≥1 creator). */
  async start(id: string): Promise<Campaign | null> {
    return this.update(id, { status: 'active', startedAt: new Date().toISOString() });
  }

  /** Transition active → completed. */
  async complete(id: string): Promise<Campaign | null> {
    return this.update(id, { status: 'completed', completedAt: new Date().toISOString() });
  }

  private message(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
