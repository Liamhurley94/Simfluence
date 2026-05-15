import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from '../auth/auth.service';
import { Campaign, CampaignForecast, CampaignStatus, NewCampaign, UpdateCampaign } from './campaign.types';

interface CampaignRow {
  id: string;
  created_by: string;
  enterprise_id: string | null;
  status: CampaignStatus;
  name: string;
  client: string | null;
  genre: string | null;
  budget: number | string | null;
  notes: string | null;
  objectives: string[] | null;
  forecast: CampaignForecast | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Abstract injection token for campaign persistence.
 * Only Supabase-backed; the in-memory implementation was retired when
 * campaigns became first-class entities.
 */
export abstract class CampaignsRepository {
  abstract list(): Promise<Campaign[]>;
  abstract byId(id: string): Promise<Campaign | null>;
  abstract create(dto: NewCampaign): Promise<Campaign>;
  abstract update(id: string, dto: UpdateCampaign): Promise<Campaign>;
  abstract remove(id: string): Promise<void>;
}

function rowToCampaign(r: CampaignRow): Campaign {
  return {
    id: r.id,
    createdBy: r.created_by,
    enterpriseId: r.enterprise_id,
    status: r.status,
    name: r.name,
    client: r.client,
    genre: r.genre,
    budget: r.budget == null ? null : Number(r.budget),
    notes: r.notes,
    objectives: r.objectives ?? [],
    forecast: r.forecast,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_COLS =
  'id, created_by, enterprise_id, status, name, client, genre, budget, notes, ' +
  'objectives, forecast, started_at, completed_at, created_at, updated_at';

@Injectable()
export class SupabaseCampaignsRepository extends CampaignsRepository {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);

  async list(): Promise<Campaign[]> {
    // RLS returns both personal (created_by = me) and enterprise (enterprise_id = my_enterprise) rows in one query.
    const { data, error } = await this.supabase.client
      .from('campaigns')
      .select(SELECT_COLS)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => rowToCampaign(r as unknown as CampaignRow));
  }

  async byId(id: string): Promise<Campaign | null> {
    const { data, error } = await this.supabase.client
      .from('campaigns')
      .select(SELECT_COLS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToCampaign(data as unknown as CampaignRow) : null;
  }

  async create(dto: NewCampaign): Promise<Campaign> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Must be signed in to create a campaign');

    const insert = {
      created_by: userId,
      // Snapshot ownership at create time. Personal users get NULL.
      enterprise_id: dto.enterpriseId !== undefined ? dto.enterpriseId : this.auth.enterpriseId(),
      name: dto.name,
      client: dto.client ?? null,
      genre: dto.genre ?? null,
      budget: dto.budget ?? null,
      notes: dto.notes ?? null,
      objectives: dto.objectives ?? [],
    };

    const { data, error } = await this.supabase.client
      .from('campaigns')
      .insert(insert)
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    return rowToCampaign(data as unknown as CampaignRow);
  }

  async update(id: string, dto: UpdateCampaign): Promise<Campaign> {
    // Map camelCase → snake_case for the columns we allow to be patched.
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch['name'] = dto.name;
    if (dto.client !== undefined) patch['client'] = dto.client;
    if (dto.genre !== undefined) patch['genre'] = dto.genre;
    if (dto.budget !== undefined) patch['budget'] = dto.budget;
    if (dto.notes !== undefined) patch['notes'] = dto.notes;
    if (dto.objectives !== undefined) patch['objectives'] = dto.objectives;
    if (dto.status !== undefined) patch['status'] = dto.status;
    if (dto.forecast !== undefined) patch['forecast'] = dto.forecast;
    if (dto.startedAt !== undefined) patch['started_at'] = dto.startedAt;
    if (dto.completedAt !== undefined) patch['completed_at'] = dto.completedAt;

    const { data, error } = await this.supabase.client
      .from('campaigns')
      .update(patch)
      .eq('id', id)
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    return rowToCampaign(data as unknown as CampaignRow);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('campaigns').delete().eq('id', id);
    if (error) throw error;
  }
}
