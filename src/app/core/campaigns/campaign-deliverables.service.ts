import { Injectable, computed, inject, signal } from '@angular/core';
import { CampaignDeliverablesRepository } from './campaign-deliverables.repository';
import {
  CampaignDeliverable, NewCampaignDeliverable, UpdateCampaignDeliverable,
} from './campaign-deliverables.types';

@Injectable({ providedIn: 'root' })
export class CampaignDeliverablesService {
  private repo = inject(CampaignDeliverablesRepository);

  readonly records = signal<CampaignDeliverable[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly byCampaignCreator = computed<Map<string, CampaignDeliverable[]>>(() => {
    const map = new Map<string, CampaignDeliverable[]>();
    for (const d of this.records()) {
      const list = map.get(d.campaignCreatorId) ?? [];
      list.push(d);
      map.set(d.campaignCreatorId, list);
    }
    return map;
  });

  async loadFor(ccIds: string[]): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.records.set(await this.repo.listForCampaignCreators(ccIds));
    } catch (err) {
      this.error.set(this.message(err));
    } finally {
      this.loading.set(false);
    }
  }

  async add(dto: NewCampaignDeliverable): Promise<CampaignDeliverable | null> {
    try {
      const created = await this.repo.add(dto);
      this.records.update((list) => [...list, created]);
      return created;
    } catch (err) {
      this.error.set(this.message(err));
      return null;
    }
  }

  async update(id: string, dto: UpdateCampaignDeliverable): Promise<CampaignDeliverable | null> {
    try {
      const updated = await this.repo.update(id, dto);
      this.records.update((list) => list.map((d) => (d.id === id ? updated : d)));
      return updated;
    } catch (err) {
      this.error.set(this.message(err));
      return null;
    }
  }

  async remove(id: string): Promise<void> {
    const snapshot = this.records();
    this.records.update((list) => list.filter((d) => d.id !== id));
    try {
      await this.repo.remove(id);
    } catch (err) {
      this.records.set(snapshot);
      this.error.set(this.message(err));
    }
  }

  private message(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
