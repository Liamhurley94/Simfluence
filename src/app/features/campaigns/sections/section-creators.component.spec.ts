import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { SectionCreatorsComponent } from './section-creators.component';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import { CreatorsService } from '../../../core/creators/creators.service';
import { CampaignSuggestionsService } from '../../../core/campaigns/campaign-suggestions.service';
import { Campaign } from '../../../core/campaigns/campaign.types';

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'camp-1', name: 'Test Campaign', status: 'planning',
    createdBy: 'user-uuid', enterpriseId: null,
    client: null, genre: null, objectives: [], budget: null, notes: null,
    forecast: null,
    startedAt: null, completedAt: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function setup(campaign = makeCampaign()) {
  const records = signal<any[]>([]);
  const campaignCreatorsStub = {
    records, loading: signal(false), error: signal(null),
    add: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const creatorsStub = {
    byIds: vi.fn().mockResolvedValue([]),
  };
  const suggestionsStub = {
    suggest: vi.fn().mockResolvedValue([]),
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [SectionCreatorsComponent],
    providers: [
      { provide: CampaignCreatorsService, useValue: campaignCreatorsStub },
      { provide: CreatorsService, useValue: creatorsStub },
      { provide: CampaignSuggestionsService, useValue: suggestionsStub },
    ],
    schemas: [NO_ERRORS_SCHEMA],
  });

  const fixture = TestBed.createComponent(SectionCreatorsComponent);
  fixture.componentRef.setInput('campaign', campaign);
  fixture.detectChanges();
  return { fixture, campaignCreatorsStub, creatorsStub, suggestionsStub };
}

describe('SectionCreatorsComponent — feature-flag gating', () => {
  it('does not render the suggestion-groups block when FEATURES.personas is false', () => {
    const { fixture } = setup(makeCampaign({ genre: 'Gaming & Esports' }));
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="suggestion-groups"]')).toBeNull();
  });

  it('does not render the suggestions-need-genre block when FEATURES.personas is false', () => {
    const { fixture } = setup(makeCampaign({ genre: null }));
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="suggestions-need-genre"]')).toBeNull();
  });

  it('renders the section-creators container', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.querySelector('[data-testid="section-creators"]')).toBeTruthy();
  });
});
