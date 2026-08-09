// campaign-simulator.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { CampaignSimulatorComponent } from './campaign-simulator.component';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import { CreatorsService } from '../../../core/creators/creators.service';
import { CampaignsService } from '../../../core/campaigns/campaigns.service';
import { AuthService } from '../../../core/auth/auth.service';
import { EdgeClient } from '../../../core/api/edge.client';
import { Campaign } from '../../../core/campaigns/campaign.types';
import { Creator } from '../../../core/data/creator.types';
import { DEFAULT_AOV } from '../../../core/simulation/simulation.types';

function mkCreator(id: number): Creator {
  return { id, name: `C${id}`, handle: `@c${id}`, platform: 'YouTube', allPlatforms: ['YouTube'],
    subs: '100K', subsParsed: 100_000, avgViews: '20K', eng: '3.0%', genre: 'Gaming & Esports',
    cpi: 80, gfi: 75, color: '#fff', verifiedDeals: 0, sponsorHistory: [], bio: '',
    ytStats: { subscriberCount: 100_000, avgViews: 20_000, engagementRate: 3, sponsorFreqPct: 5, statsRefreshedAt: null } };
}
function mkCampaign(status: Campaign['status'] = 'planning', objectives: string[] = []): Campaign {
  return { id: 'c1', createdBy: 'u', enterpriseId: null, status, name: 'Acme', client: null,
    genre: 'Gaming & Esports', budget: 50_000, notes: null, objectives, forecast: null, debriefNotes: null,
    startedAt: null, completedAt: null, createdAt: '', updatedAt: '' };
}
const RESULT = { impressions: 100, ctr: 2, cpM: 6, cvr: 0.5, conversions: 1, roas: 0.1, roasP10: 0.07,
  roasP50: 0.1, roasP90: 0.15, roasRange: '0.1–0.4×', engRate: 3, clicks: 2, budget: 50_000, reachableCount: 1,
  aov: 30, durationWeeks: 4,
  bench: { ctrBase: 2, cpmBase: 8, cvrBase: 0.5, roasBase: 2, engBase: 4 },
  p10: { impressions: 68, ctr: 1.3, roas: 0.07 }, p50: { impressions: 100, ctr: 2, roas: 0.1 },
  p90: { impressions: 142, ctr: 2.8, roas: 0.15 },
  creatorBreakdowns: [{ id: '7', gfi: 80, reachable: true, fitFormat: 'int', budgetShare: 40_000, impressions: 90, ctr: 2, clicks: 3,
    cvr: 0.5, conversions: 1, roas: 2,
    rates: { int: [1, 2], mix: [2, 3], ded: [3, 4] },
    p10: { impr: 60, ctr: 1.4, clicks: 2, conv: 1, roas: 1.3 },
    p50: { impr: 90, ctr: 2, clicks: 3, conv: 1, roas: 2 },
    p90: { impr: 130, ctr: 2.8, clicks: 4, conv: 1, roas: 2.9 } }] };

function setup(
  status: Campaign['status'] = 'planning',
  records = signal<any[]>([{ id: 'cc1', campaignId: 'c1', creatorId: 7, status: 'shortlisted', format: null }]),
) {
  localStorage.clear();
  const update = vi.fn().mockResolvedValue(mkCampaign(status));
  const post = vi.fn().mockResolvedValue(RESULT);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CampaignSimulatorComponent],
    providers: [
      { provide: CampaignCreatorsService, useValue: { records } },
      { provide: CreatorsService, useValue: { byIds: vi.fn(async (ids: number[]) => ids.map(mkCreator)), genres: signal(['Gaming & Esports']) } },
      { provide: CampaignsService, useValue: { update } },
      { provide: AuthService, useValue: { tier: signal('silver') } },
      { provide: EdgeClient, useValue: { post, get: vi.fn() } },
    ],
  });
  return { update, post };
}

describe('CampaignSimulatorComponent', () => {
  it('planning with no existing forecast: Save writes directly (no confirm dialog)', async () => {
    const { update } = setup('planning');
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', mkCampaign('planning'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="sim-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="campaign-forecast-save"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    // No prior forecast → save immediately, dialog never shows.
    expect(f.nativeElement.querySelector('[data-testid="forecast-overwrite-confirm"]')).toBeNull();
    expect(update).toHaveBeenCalledWith('c1', expect.objectContaining({ forecast: expect.objectContaining({ impressions: 100 }) }));
  });

  it('Save snapshots the per-creator breakdown into forecast.creatorBreakdowns', async () => {
    const { update } = setup('planning');
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', mkCampaign('planning'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="sim-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="campaign-forecast-save"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    expect(update).toHaveBeenCalledWith('c1', expect.objectContaining({
      forecast: expect.objectContaining({
        creatorBreakdowns: [{ id: 7, impressions: 90, clicks: 3, conversions: 1, spend: 40000, revenue: 30 }],
      }),
    }));
  });

  it('normalizes the string creator id the edge function echoes back', async () => {
    const { update } = setup('planning');
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', mkCampaign('planning'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="sim-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="campaign-forecast-save"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    const saved = update.mock.calls.at(-1)![1].forecast;
    expect(saved.creatorBreakdowns[0].id).toBe(7);
    expect(typeof saved.creatorBreakdowns[0].id).toBe('number');
  });

  it('records the assumptions and derives revenue from conversions', async () => {
    const { update } = setup('planning');
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', mkCampaign('planning'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="sim-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="campaign-forecast-save"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    const saved = update.mock.calls.at(-1)![1].forecast;
    expect(saved.creatorBreakdowns[0].revenue).toBe(30);   // 1 conversion × $30
    expect(saved.aov).toBe(30);
    expect(saved.durationWeeks).toBe(4);
  });

  it('falls back to DEFAULT_AOV when the edge fn response omits aov (older backend)', async () => {
    const { update, post } = setup('planning');
    // Simulate an edge fn predating this branch, which never echoed `aov` back.
    const { aov: _omitted, ...staleResult } = RESULT;
    post.mockResolvedValue(staleResult);
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', mkCampaign('planning'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="sim-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="campaign-forecast-save"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    const saved = update.mock.calls.at(-1)![1].forecast;
    // Without the fallback this would be NaN -> serialized to null.
    expect(saved.creatorBreakdowns[0].revenue).toBe(1 * DEFAULT_AOV);
    expect(Number.isNaN(saved.creatorBreakdowns[0].revenue)).toBe(false);
  });

  it('seeds AOV and duration controls from the saved campaign forecast', async () => {
    const withForecast: Campaign = { ...mkCampaign('planning'), forecast: {
      impressions: 50, ctr: 1, roas: 0.2, cvr: 0.3,
      p10: { impressions: 40, ctr: 0.8, roas: 0.15 },
      p50: { impressions: 50, ctr: 1, roas: 0.2 },
      p90: { impressions: 60, ctr: 1.2, roas: 0.25 },
      aov: 150, durationWeeks: 8,
    } };
    setup('planning');
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', withForecast);
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const aovInput: HTMLInputElement = f.nativeElement.querySelector('[data-testid="sim-aov"]');
    expect(aovInput.value).toBe('150');
    expect(f.nativeElement.querySelector('[data-testid="sim-duration-label"]').textContent).toContain('8');
  });

  it('Save is projected into the panel actions row next to Run', async () => {
    setup('planning');
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', mkCampaign('planning'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const actions: HTMLElement = f.nativeElement.querySelector('[data-testid="sim-actions"]');
    expect(actions).toBeTruthy();
    // The Save button lands in the panel's <ng-content> actions row, beside Run.
    expect(actions.querySelector('[data-testid="campaign-forecast-save"]')).toBeTruthy();
  });

  it('existing forecast: Save opens the confirm dialog and only updates on confirm', async () => {
    const withForecast: Campaign = { ...mkCampaign('planning'), forecast: {
      impressions: 50, ctr: 1, roas: 0.2, cvr: 0.3,
      p10: { impressions: 40, ctr: 0.8, roas: 0.15 },
      p50: { impressions: 50, ctr: 1, roas: 0.2 },
      p90: { impressions: 60, ctr: 1.2, roas: 0.25 },
    } };
    const { update } = setup('planning');
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', withForecast);
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="sim-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();

    // Clicking Save opens the confirm dialog — no update yet.
    (f.nativeElement.querySelector('[data-testid="campaign-forecast-save"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="forecast-overwrite-confirm"]')).toBeTruthy();
    expect(update).not.toHaveBeenCalled();

    // Confirming runs the save.
    (f.nativeElement.querySelector('[data-testid="forecast-overwrite-confirm-yes"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    expect(update).toHaveBeenCalledWith('c1', expect.objectContaining({ forecast: expect.objectContaining({ impressions: 100 }) }));
    // Dialog dismisses after confirm.
    expect(f.nativeElement.querySelector('[data-testid="forecast-overwrite-confirm"]')).toBeNull();
  });

  it('existing forecast: canceling the confirm dialog does not update', async () => {
    const withForecast: Campaign = { ...mkCampaign('planning'), forecast: {
      impressions: 50, ctr: 1, roas: 0.2, cvr: 0.3,
      p10: { impressions: 40, ctr: 0.8, roas: 0.15 },
      p50: { impressions: 50, ctr: 1, roas: 0.2 },
      p90: { impressions: 60, ctr: 1.2, roas: 0.25 },
    } };
    const { update } = setup('planning');
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', withForecast);
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="sim-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();

    (f.nativeElement.querySelector('[data-testid="campaign-forecast-save"]') as HTMLButtonElement).click();
    f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="forecast-overwrite-confirm-cancel"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();
    expect(update).not.toHaveBeenCalled();
    expect(f.nativeElement.querySelector('[data-testid="forecast-overwrite-confirm"]')).toBeNull();
  });

  it('forwards campaign.objectives to the panel as initialObjectives (chips selected)', async () => {
    setup('planning');
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', mkCampaign('planning', ['Awareness', 'Sales']));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const awareness: HTMLButtonElement = f.nativeElement.querySelector('[data-testid="sim-obj-awareness"]');
    const sales: HTMLButtonElement = f.nativeElement.querySelector('[data-testid="sim-obj-sales"]');
    const engagement: HTMLButtonElement = f.nativeElement.querySelector('[data-testid="sim-obj-engagement"]');
    expect(awareness.style.background).toContain('color-sf-blue');
    expect(sales.style.background).toContain('color-sf-blue');
    expect(engagement.style.background).not.toContain('color-sf-blue');
  });

  it('active: forecast is locked — no run/save controls', async () => {
    setup('active');
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', mkCampaign('active'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="sim-run"]')).toBeNull();
    expect(f.nativeElement.querySelector('[data-testid="campaign-forecast-save"]')).toBeNull();
  });

  it('runs in per-creator mode: sends each record\'s format, hides the global dropdown', async () => {
    const records = signal<any[]>([
      { id: 'cc1', campaignId: 'c1', creatorId: 1, status: 'confirmed', format: 'Dedicated' },
      { id: 'cc2', campaignId: 'c1', creatorId: 2, status: 'shortlisted', format: null },
    ]);
    const { post } = setup('planning', records);
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', mkCampaign('planning'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    // Per-creator mode hides the global Format dropdown.
    expect(f.nativeElement.querySelector('[data-testid="sim-format"]')).toBeNull();
    (f.nativeElement.querySelector('[data-testid="sim-run"]') as HTMLButtonElement).click();
    await f.whenStable(); f.detectChanges();

    const body = post.mock.calls[0][1] as { creators: Array<Record<string, unknown>>; format: string };
    const c1 = body.creators.find((e) => e['id'] === '1')!;
    const c2 = body.creators.find((e) => e['id'] === '2')!;
    expect(c1['format']).toBe('Dedicated'); // mapped from the record
    expect(c2['format']).toBeUndefined();   // null record format → omitted
    expect(body.format).toBe('Integrated'); // top-level fallback stays default
  });

  it('shows the defaulted note with the count of creators lacking a format', async () => {
    const records = signal<any[]>([
      { id: 'cc1', campaignId: 'c1', creatorId: 1, status: 'confirmed', format: 'Dedicated' },
      { id: 'cc2', campaignId: 'c1', creatorId: 2, status: 'shortlisted', format: null },
      { id: 'cc3', campaignId: 'c1', creatorId: 3, status: 'shortlisted', format: null },
    ]);
    setup('planning', records);
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', mkCampaign('planning'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const note = f.nativeElement.querySelector('[data-testid="forecast-format-default-note"]');
    expect(note).toBeTruthy();
    expect(note.textContent).toContain('2'); // two creators lack a format
    expect(note.textContent).toContain('Integrated');
  });

  it('hides the defaulted note when every creator has a format', async () => {
    const records = signal<any[]>([
      { id: 'cc1', campaignId: 'c1', creatorId: 1, status: 'confirmed', format: 'Dedicated' },
      { id: 'cc2', campaignId: 'c1', creatorId: 2, status: 'confirmed', format: 'Integrated' },
    ]);
    setup('planning', records);
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', mkCampaign('planning'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="forecast-format-default-note"]')).toBeNull();
  });

  it('hides the defaulted note when the forecast is locked (non-planning)', async () => {
    const records = signal<any[]>([
      { id: 'cc1', campaignId: 'c1', creatorId: 1, status: 'confirmed', format: null },
    ]);
    setup('active', records);
    const f = TestBed.createComponent(CampaignSimulatorComponent);
    f.componentRef.setInput('campaign', mkCampaign('active'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="forecast-format-default-note"]')).toBeNull();
  });
});
