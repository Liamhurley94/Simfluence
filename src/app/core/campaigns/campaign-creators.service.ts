import { Injectable, computed, inject, signal } from '@angular/core';
import { CampaignCreatorsRepository } from './campaign-creators.repository';
import {
  CAMPAIGN_CREATOR_STATUSES,
  CampaignCreator,
  CampaignCreatorStatus,
  NewCampaignCreator,
  SponsorshipFormat,
  UpdateCampaignCreator,
} from './campaign-creators.types';

@Injectable({ providedIn: 'root' })
export class CampaignCreatorsService {
  private repo = inject(CampaignCreatorsRepository);

  readonly records = signal<CampaignCreator[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly currentCampaignId = signal<string | null>(null);

  readonly byStatus = computed<Record<CampaignCreatorStatus, CampaignCreator[]>>(() => {
    const buckets: Record<CampaignCreatorStatus, CampaignCreator[]> = {
      shortlisted: [], contacted: [], negotiating: [], confirmed: [], declined: [],
    };
    for (const r of this.records()) buckets[r.status].push(r);
    return buckets;
  });

  readonly statusCounts = computed<Record<CampaignCreatorStatus, number>>(() => {
    const buckets = this.byStatus();
    return CAMPAIGN_CREATOR_STATUSES.reduce(
      (acc, s) => ({ ...acc, [s]: buckets[s].length }),
      {} as Record<CampaignCreatorStatus, number>,
    );
  });

  async loadFor(campaignId: string): Promise<void> {
    this.currentCampaignId.set(campaignId);
    this.loading.set(true);
    this.error.set(null);
    try {
      const rows = await this.repo.listFor(campaignId);
      this.records.set(rows);
    } catch (err) {
      this.error.set(this.message(err));
    } finally {
      this.loading.set(false);
    }
  }

  async add(dto: NewCampaignCreator): Promise<CampaignCreator | null> {
    try {
      const created = await this.repo.add(dto);
      if (created.campaignId === this.currentCampaignId()) {
        this.records.update((list) => [...list, created]);
      }
      return created;
    } catch (err) {
      this.error.set(this.message(err));
      return null;
    }
  }

  async updateStatus(id: string, status: CampaignCreatorStatus): Promise<CampaignCreator | null> {
    return this.patch(id, { status });
  }

  async updateFormat(id: string, format: SponsorshipFormat | null): Promise<CampaignCreator | null> {
    return this.patch(id, { format });
  }

  async updateContact(id: string, fields: Pick<UpdateCampaignCreator, 'contactEmail' | 'contactHandle' | 'notes' | 'lastContactAt' | 'rateEstimate'>): Promise<CampaignCreator | null> {
    return this.patch(id, fields);
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

  private async patch(id: string, dto: UpdateCampaignCreator): Promise<CampaignCreator | null> {
    try {
      const updated = await this.repo.update(id, dto);
      this.records.update((list) => list.map((r) => (r.id === id ? updated : r)));
      return updated;
    } catch (err) {
      this.error.set(this.message(err));
      return null;
    }
  }

  private message(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
