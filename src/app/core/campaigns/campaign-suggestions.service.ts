import { Injectable, inject } from '@angular/core';
import { EdgeClient } from '../api/edge.client';
import { Creator } from '../data/creator.types';
import { Persona } from '../data/persona.types';

export interface CampaignSuggestion {
  creator: Creator;
  gfi: number | null;
  rateEstimate: unknown;
}

export interface CampaignSuggestionGroup {
  persona: Persona;
  personaScore: number;
  creators: CampaignSuggestion[];
}

interface SuggestionsResponse {
  groupedSuggestions?: CampaignSuggestionGroup[];
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class CampaignSuggestionsService {
  private edge = inject(EdgeClient);

  /** Returns persona-grouped suggestions. Empty array on error or no matches. */
  async suggest(campaignId: string): Promise<CampaignSuggestionGroup[]> {
    try {
      const res = await this.edge.post<SuggestionsResponse>('campaign-suggest-creators', {
        campaign_id: campaignId,
      });
      if (res.error || !res.groupedSuggestions) return [];
      return res.groupedSuggestions;
    } catch (err) {
      console.error('[CampaignSuggestionsService] suggest failed:', err);
      return [];
    }
  }
}
