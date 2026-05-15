import { Injectable, inject } from '@angular/core';
import { EdgeClient } from '../api/edge.client';
import { Creator } from '../data/creator.types';

export interface CampaignSuggestion {
  creator: Creator;
  gfi: number;
  rateEstimate: unknown;
}

interface SuggestionsResponse {
  suggestions: CampaignSuggestion[];
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class CampaignSuggestionsService {
  private edge = inject(EdgeClient);

  async suggest(campaignId: string, count = 10): Promise<CampaignSuggestion[]> {
    try {
      const res = await this.edge.post<SuggestionsResponse>('campaign-suggest-creators', {
        campaign_id: campaignId,
        count,
      });
      if (res.error || !res.suggestions) return [];
      return res.suggestions;
    } catch (err) {
      console.error('[CampaignSuggestionsService] suggest failed:', err);
      return [];
    }
  }
}
