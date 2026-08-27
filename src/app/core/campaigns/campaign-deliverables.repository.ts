import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CampaignDeliverable, DeliverableFormat, DeliverablePlatform,
  NewCampaignDeliverable, UpdateCampaignDeliverable, UpdateDeliverableActuals,
} from './campaign-deliverables.types';

interface CampaignDeliverableRow {
  id: string;
  campaign_creator_id: string;
  platform: DeliverablePlatform;
  format: DeliverableFormat;
  quantity: number;
  duration_hours: number | string | null;
  agreed_fee: number | string | null;
  actual_impressions: number | null;
  actual_clicks: number | null;
  actual_conversions: number | null;
  actual_spend: number | string | null;
  actual_revenue: number | string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToRecord(r: CampaignDeliverableRow): CampaignDeliverable {
  return {
    id: r.id,
    campaignCreatorId: r.campaign_creator_id,
    platform: r.platform,
    format: r.format,
    quantity: r.quantity,
    durationHours: r.duration_hours == null ? null : Number(r.duration_hours),
    agreedFee: r.agreed_fee == null ? null : Number(r.agreed_fee),
    actualImpressions: r.actual_impressions,
    actualClicks: r.actual_clicks,
    actualConversions: r.actual_conversions,
    actualSpend: r.actual_spend == null ? null : Number(r.actual_spend),
    actualRevenue: r.actual_revenue == null ? null : Number(r.actual_revenue),
    deliveredAt: r.delivered_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_COLS =
  'id, campaign_creator_id, platform, format, quantity, duration_hours, agreed_fee, '
  + 'actual_impressions, actual_clicks, actual_conversions, actual_spend, actual_revenue, delivered_at, '
  + 'created_at, updated_at';

@Injectable({ providedIn: 'root' })
export class CampaignDeliverablesRepository {
  private supabase = inject(SupabaseService);

  async listForCampaignCreators(ccIds: string[]): Promise<CampaignDeliverable[]> {
    if (ccIds.length === 0) return [];
    const { data, error } = await this.supabase.client
      .from('campaign_deliverables')
      .select(SELECT_COLS)
      .in('campaign_creator_id', ccIds)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as unknown as CampaignDeliverableRow[]).map(rowToRecord);
  }

  async add(dto: NewCampaignDeliverable): Promise<CampaignDeliverable> {
    const { data, error } = await this.supabase.client
      .from('campaign_deliverables')
      .insert({
        campaign_creator_id: dto.campaignCreatorId,
        platform: dto.platform,
        format: dto.format,
        quantity: dto.quantity ?? 1,
        duration_hours: dto.durationHours ?? null,
        agreed_fee: dto.agreedFee ?? null,
      })
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    return rowToRecord(data as unknown as CampaignDeliverableRow);
  }

  async update(id: string, dto: UpdateCampaignDeliverable): Promise<CampaignDeliverable> {
    const patch: Record<string, unknown> = {};
    if (dto.platform !== undefined) patch['platform'] = dto.platform;
    if (dto.format !== undefined) patch['format'] = dto.format;
    if (dto.quantity !== undefined) patch['quantity'] = dto.quantity;
    if (dto.durationHours !== undefined) patch['duration_hours'] = dto.durationHours;
    if (dto.agreedFee !== undefined) patch['agreed_fee'] = dto.agreedFee;
    const { data, error } = await this.supabase.client
      .from('campaign_deliverables')
      .update(patch)
      .eq('id', id)
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    return rowToRecord(data as unknown as CampaignDeliverableRow);
  }

  async updateActuals(id: string, dto: UpdateDeliverableActuals): Promise<CampaignDeliverable> {
    const patch: Record<string, unknown> = {};
    if (dto.actualImpressions !== undefined) patch['actual_impressions'] = dto.actualImpressions;
    if (dto.actualClicks !== undefined) patch['actual_clicks'] = dto.actualClicks;
    if (dto.actualConversions !== undefined) patch['actual_conversions'] = dto.actualConversions;
    if (dto.actualSpend !== undefined) patch['actual_spend'] = dto.actualSpend;
    if (dto.actualRevenue !== undefined) patch['actual_revenue'] = dto.actualRevenue;
    if (dto.deliveredAt !== undefined) patch['delivered_at'] = dto.deliveredAt;
    const { data, error } = await this.supabase.client
      .from('campaign_deliverables')
      .update(patch)
      .eq('id', id)
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    return rowToRecord(data as unknown as CampaignDeliverableRow);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('campaign_deliverables')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
