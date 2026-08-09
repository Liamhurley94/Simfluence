import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { SectionResultsComponent } from './section-results.component';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import { CampaignsService } from '../../../core/campaigns/campaigns.service';
import { CreatorsService } from '../../../core/creators/creators.service';
import { Campaign } from '../../../core/campaigns/campaign.types';

function mkCampaign(status: Campaign['status'], withForecast = true): Campaign {
  return {
    id: 'c1', createdBy: 'u', enterpriseId: null, status, name: 'Acme', client: null,
    genre: 'Gaming & Esports', budget: 50_000, notes: null, objectives: [], debriefNotes: null,
    forecast: withForecast ? {
      impressions: 100, ctr: 3.2, roas: 2.4, cvr: 1.8,
      p10: { impressions: 68, ctr: 2.2, roas: 1.6 },
      p50: { impressions: 100, ctr: 3.2, roas: 2.4 },
      p90: { impressions: 142, ctr: 4.5, roas: 3.4 },
      creatorBreakdowns: [{ id: 7, impressions: 90, clicks: 3, conversions: 1, spend: 40000, revenue: 96000 }],
    } : null,
    startedAt: null, completedAt: null, createdAt: '', updatedAt: '',
  };
}

function ccRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cc1', campaignId: 'c1', creatorId: 7, status: 'confirmed', source: 'manual', format: 'Integrated',
    contactEmail: null, contactHandle: null, notes: null, lastContactAt: null, rateEstimate: null, cpiAtAdd: null,
    actualImpressions: null, actualClicks: null, actualConversions: null, actualSpend: null, actualRevenue: null,
    debriefNotes: null, addedAt: '', updatedAt: '', ...overrides,
  };
}

function setup(campaign: Campaign, records = signal<any[]>([ccRecord()])) {
  const updateActuals = vi.fn().mockResolvedValue(null);
  const updateDebriefNotes = vi.fn().mockResolvedValue(null);
  const update = vi.fn().mockResolvedValue(campaign);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [SectionResultsComponent],
    providers: [
      { provide: CampaignCreatorsService, useValue: { records, updateActuals, updateDebriefNotes } },
      { provide: CampaignsService, useValue: { update } },
      { provide: CreatorsService, useValue: { byIds: vi.fn(async (ids: number[]) => ids.map((id) => ({ id, name: `C${id}` }))) } },
    ],
  });
  const f = TestBed.createComponent(SectionResultsComponent);
  f.componentRef.setInput('campaign', campaign);
  return { f, updateActuals, updateDebriefNotes, update };
}

describe('SectionResultsComponent', () => {
  it('completed: debrief shows delta and in-band hit for a summed actual', async () => {
    const { f } = setup(mkCampaign('completed'), signal<any[]>([ccRecord({ actualImpressions: 90 })]));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const row = f.nativeElement.querySelector('[data-testid="debrief-row-impressions"]');
    expect(row.textContent).toContain('-10%');            // (90/100 - 1)*100
    expect(f.nativeElement.querySelector('[data-testid="debrief-band-impressions"]').textContent).toContain('✓');
  });

  it('partial revenue: headline ROAS is hidden with a hint', async () => {
    const { f } = setup(mkCampaign('completed'), signal<any[]>([ccRecord({ actualSpend: 40000, actualRevenue: null })]));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="results-roas-hint"]')).toBeTruthy();
    const roasRow = f.nativeElement.querySelector('[data-testid="debrief-row-roas"]');
    expect(roasRow.querySelector('[data-testid="debrief-actual-roas"]').textContent).toContain('—');
  });

  it('no forecast: shows the no-forecast note, still renders entry inputs', async () => {
    const { f } = setup(mkCampaign('completed', false));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="results-no-forecast"]')).toBeTruthy();
    expect(f.nativeElement.querySelector('[data-testid="actual-actualImpressions-cc1"]')).toBeTruthy();
  });

  it('active: entering an actual calls updateActuals; archived is read-only', async () => {
    const { f, updateActuals } = setup(mkCampaign('active'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const input: HTMLInputElement = f.nativeElement.querySelector('[data-testid="actual-actualClicks-cc1"]');
    expect(input.readOnly).toBe(false);
    input.value = '35';
    input.dispatchEvent(new Event('blur'));
    await f.whenStable();
    expect(updateActuals).toHaveBeenCalledWith('cc1', { actualClicks: 35 });

    const archived = setup(mkCampaign('archived'));
    archived.f.detectChanges(); await archived.f.whenStable(); archived.f.detectChanges();
    expect((archived.f.nativeElement.querySelector('[data-testid="actual-actualClicks-cc1"]') as HTMLInputElement).readOnly).toBe(true);
  });

  it('editing the campaign debrief note calls CampaignsService.update', async () => {
    const { f, update } = setup(mkCampaign('completed'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const note: HTMLTextAreaElement = f.nativeElement.querySelector('[data-testid="campaign-debrief-note"]');
    note.value = 'EMEA underperformed';
    note.dispatchEvent(new Event('blur'));
    await f.whenStable();
    expect(update).toHaveBeenCalledWith('c1', { debriefNotes: 'EMEA underperformed' });
  });

  it('populates the per-creator forecast column from a saved breakdown', () => {
    const { f } = setup(mkCampaign('completed'));
    f.detectChanges();
    const el: HTMLElement = f.nativeElement.querySelector('[data-testid="creator-forecast"]');
    expect(el).toBeTruthy();
    expect(el.textContent).toContain('90');       // forecast impressions for creator 7
    expect(el.textContent).toContain('40,000');   // forecast spend
    expect(el.textContent).toContain('96,000');   // forecast revenue
  });

  it('omits the per-creator forecast line when the saved breakdown id does not match the roster', () => {
    const campaign = mkCampaign('completed');
    // Same shape as a real saved forecast, but the breakdown's id (999) has no
    // matching creatorId in the roster (ccRecord() defaults to creatorId 7) –
    // this is the id-mismatch regression the string/number fix guards against.
    const forecast = { ...campaign.forecast!,
      creatorBreakdowns: [{ id: 999, impressions: 90, clicks: 3, conversions: 1, spend: 40000, revenue: 96000 }] };
    const { f } = setup({ ...campaign, forecast });
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="creator-forecast"]')).toBeNull();
  });
});
