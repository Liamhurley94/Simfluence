import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CampaignCreator,
  CampaignCreatorSource,
  CampaignCreatorStatus,
  NewCampaignCreator,
  SponsorshipFormat,
  UpdateCampaignCreator,
} from './campaign-creators.types';

interface CampaignCreatorRow {
  id: string;
  campaign_id: string;
  creator_id: number;
  status: CampaignCreatorStatus;
  source: CampaignCreatorSource;
  format: SponsorshipFormat | null;
  contact_email: string | null;
  contact_handle: string | null;
  notes: string | null;
  last_contact_at: string | null;
  rate_estimate: number | string | null;
  cpi_at_add: number | null;
  added_at: string;
  updated_at: string;
}

function rowToRecord(r: CampaignCreatorRow): CampaignCreator {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    creatorId: r.creator_id,
    status: r.status,
    source: r.source,
    format: r.format,
    contactEmail: r.contact_email,
    contactHandle: r.contact_handle,
    notes: r.notes,
    lastContactAt: r.last_contact_at,
    rateEstimate: r.rate_estimate == null ? null : Number(r.rate_estimate),
    cpiAtAdd: r.cpi_at_add,
    addedAt: r.added_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_COLS =
  'id, campaign_id, creator_id, status, source, format, contact_email, contact_handle, ' +
  'notes, last_contact_at, rate_estimate, cpi_at_add, added_at, updated_at';

@Injectable({ providedIn: 'root' })
export class CampaignCreatorsRepository {
  private supabase = inject(SupabaseService);

  async listFor(campaignId: string): Promise<CampaignCreator[]> {
    const { data, error } = await this.supabase.client
      .from('campaign_creators')
      .select(SELECT_COLS)
      .eq('campaign_id', campaignId)
      .order('added_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => rowToRecord(r as unknown as CampaignCreatorRow));
  }

  async add(dto: NewCampaignCreator): Promise<CampaignCreator> {
    const insert = {
      campaign_id: dto.campaignId,
      creator_id: dto.creatorId,
      status: dto.status ?? 'shortlisted',
      source: dto.source ?? 'manual',
      contact_email: dto.contactEmail ?? null,
      contact_handle: dto.contactHandle ?? null,
      notes: dto.notes ?? null,
      rate_estimate: dto.rateEstimate ?? null,
      cpi_at_add: dto.cpiAtAdd ?? null,
    };

    const { data, error } = await this.supabase.client
      .from('campaign_creators')
      .insert(insert)
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    return rowToRecord(data as unknown as CampaignCreatorRow);
  }

  async update(id: string, dto: UpdateCampaignCreator): Promise<CampaignCreator> {
    const patch: Record<string, unknown> = {};
    if (dto.status !== undefined) patch['status'] = dto.status;
    if (dto.format !== undefined) patch['format'] = dto.format;
    if (dto.contactEmail !== undefined) patch['contact_email'] = dto.contactEmail;
    if (dto.contactHandle !== undefined) patch['contact_handle'] = dto.contactHandle;
    if (dto.notes !== undefined) patch['notes'] = dto.notes;
    if (dto.lastContactAt !== undefined) patch['last_contact_at'] = dto.lastContactAt;
    if (dto.rateEstimate !== undefined) patch['rate_estimate'] = dto.rateEstimate;

    const { data, error } = await this.supabase.client
      .from('campaign_creators')
      .update(patch)
      .eq('id', id)
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    return rowToRecord(data as unknown as CampaignCreatorRow);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('campaign_creators').delete().eq('id', id);
    if (error) throw error;
  }
}
