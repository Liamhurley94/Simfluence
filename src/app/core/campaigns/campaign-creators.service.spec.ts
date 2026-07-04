import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignCreatorsService } from './campaign-creators.service';
import { CampaignCreatorsRepository } from './campaign-creators.repository';
import { CampaignCreator } from './campaign-creators.types';

function sampleCC(overrides: Partial<CampaignCreator> = {}): CampaignCreator {
  return {
    id: 'cc-1', campaignId: 'c-1', creatorId: 7, status: 'confirmed', source: 'manual',
    format: 'Integrated', contactEmail: null, contactHandle: null, notes: null, lastContactAt: null,
    rateEstimate: null, cpiAtAdd: null,
    actualImpressions: null, actualClicks: null, actualConversions: null,
    actualSpend: null, actualRevenue: null, debriefNotes: null,
    addedAt: '', updatedAt: '', ...overrides,
  };
}

function setup() {
  const repo = {
    listFor: vi.fn().mockResolvedValue([]),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: CampaignCreatorsRepository, useValue: repo as unknown as CampaignCreatorsRepository }],
  });
  return { service: TestBed.inject(CampaignCreatorsService), repo };
}

describe('CampaignCreatorsService actuals', () => {
  beforeEach(() => { /* noop */ });

  it('updateActuals patches mapped fields and replaces the record in the signal', async () => {
    const { service, repo } = setup();
    const updated = sampleCC({ actualImpressions: 1000, actualClicks: 30, actualRevenue: 400 });
    repo.update.mockResolvedValue(updated);
    service.records.set([sampleCC()]);

    const res = await service.updateActuals('cc-1', { actualImpressions: 1000, actualClicks: 30, actualRevenue: 400 });

    expect(repo.update).toHaveBeenCalledWith('cc-1', { actualImpressions: 1000, actualClicks: 30, actualRevenue: 400 });
    expect(res).toEqual(updated);
    expect(service.records()[0].actualImpressions).toBe(1000);
  });

  it('updateDebriefNotes patches debriefNotes', async () => {
    const { service, repo } = setup();
    repo.update.mockResolvedValue(sampleCC({ debriefNotes: 'Overdelivered' }));
    service.records.set([sampleCC()]);

    await service.updateDebriefNotes('cc-1', 'Overdelivered');

    expect(repo.update).toHaveBeenCalledWith('cc-1', { debriefNotes: 'Overdelivered' });
    expect(service.records()[0].debriefNotes).toBe('Overdelivered');
  });
});
