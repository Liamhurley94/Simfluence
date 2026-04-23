import { Injectable, inject, signal } from '@angular/core';
import { CampaignsRepository } from './campaigns.repository';
import { Campaign, NewCampaign, UpdateCampaign } from './campaign.types';

@Injectable({ providedIn: 'root' })
export class CampaignsService {
  private repo = inject(CampaignsRepository);

  readonly campaigns = signal<Campaign[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const rows = await this.repo.list();
      this.campaigns.set(rows);
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
    // Optimistic — remove from UI before the repo call returns.
    this.campaigns.update((list) => list.filter((c) => c.id !== id));
    try {
      await this.repo.remove(id);
    } catch (err) {
      this.campaigns.set(snapshot);
      this.error.set(this.message(err));
    }
  }

  byId(id: string): Campaign | undefined {
    return this.campaigns().find((c) => c.id === id);
  }

  private message(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
