// campaign-simulator.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignSimulatorComponent } from './campaign-simulator.component';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import { CreatorsService } from '../../../core/creators/creators.service';
import { CampaignsService } from '../../../core/campaigns/campaigns.service';
import { AuthService } from '../../../core/auth/auth.service';
import { EdgeClient } from '../../../core/api/edge.client';
import { Campaign } from '../../../core/campaigns/campaign.types';
import { Creator } from '../../../core/data/creator.types';

function mkCreator(id: number): Creator {
  return { id, name: `C${id}`, handle: `@c${id}`, platform: 'YouTube', allPlatforms: ['YouTube'],
    subs: '100K', subsParsed: 100_000, avgViews: '20K', eng: '3.0%', genre: 'Gaming & Esports',
    cpi: 80, gfi: 75, color: '#fff', verifiedDeals: 0, sponsorHistory: [], bio: '' };
}
function mkCampaign(status: Campaign['status'] = 'planning'): Campaign {
  return { id: 'c1', createdBy: 'u', enterpriseId: null, status, name: 'Acme', client: null,
    genre: 'Gaming & Esports', budget: 50_000, notes: null, objectives: [], forecast: null,
    startedAt: null, completedAt: null, createdAt: '', updatedAt: '' };
}
const RESULT = { impressions: 100, ctr: 2, cpM: 6, cvr: 0.5, conversions: 1, roas: 0.1, roasP10: 0.07,
  roasP50: 0.1, roasP90: 0.15, roasRange: '0.1–0.4×', engRate: 3, clicks: 2, budget: 50_000, reachableCount: 1,
  bench: { ctrBase: 2, cpmBase: 8, cvrBase: 0.5, roasBase: 2, engBase: 4 },
  p10: { impressions: 68, ctr: 1.3, roas: 0.07 }, p50: { impressions: 100, ctr: 2, roas: 0.1 },
  p90: { impressions: 142, ctr: 2.8, roas: 0.15 } };

function setup(status: Campaign['status'] = 'planning') {
  localStorage.clear();
  const update = vi.fn().mockResolvedValue(mkCampaign(status));
  const records = signal([{ id: 'cc1', campaignId: 'c1', creatorId: 7, status: 'shortlisted' }]);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CampaignSimulatorComponent],
    providers: [
      { provide: CampaignCreatorsService, useValue: { records } },
      { provide: CreatorsService, useValue: { byIds: vi.fn(async (ids: number[]) => ids.map(mkCreator)), genres: signal(['Gaming & Esports']) } },
      { provide: CampaignsService, useValue: { update } },
      { provide: AuthService, useValue: { tier: signal('silver') } },
      { provide: EdgeClient, useValue: { post: vi.fn().mockResolvedValue(RESULT), get: vi.fn() } },
    ],
  });
  return { update };
}

describe('CampaignSimulatorComponent', () => {
  it('planning: runs the campaign creators and Save writes the forecast', async () => {
    const { update } = setup('planning');
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', mkCampaign('planning'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="sim-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="campaign-forecast-save"]') as HTMLButtonElement).click();
    await f.whenStable();
    expect(update).toHaveBeenCalledWith('c1', expect.objectContaining({ forecast: expect.objectContaining({ impressions: 100 }) }));
  });

  it('active: forecast is locked — no run/save controls', async () => {
    setup('active');
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', mkCampaign('active'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-run"]')).toBeNull();
    expect(f.nativeElement.querySelector('[data-testid="campaign-forecast-save"]')).toBeNull();
  });
});
