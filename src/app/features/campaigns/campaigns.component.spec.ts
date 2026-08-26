import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignsComponent } from './campaigns.component';
import { AuthService } from '../../core/auth/auth.service';
import { CampaignsService } from '../../core/campaigns/campaigns.service';
import { CampaignsRepository } from '../../core/campaigns/campaigns.repository';
import { BriefPdfService } from '../../core/campaigns/brief-pdf.service';
import { Campaign, LegacyCampaignForecast } from '../../core/campaigns/campaign.types';
import { W2Response } from '../../core/simulation/simulation-w2.types';

function fakeRepo() {
  return {
    list: vi.fn().mockResolvedValue([]),
    byId: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
}

function setup({ tier = 'silver', enterprise = null as { name: string } | null } = {}) {
  const tierSignal = signal(tier);
  const enterpriseSignal = signal(enterprise);
  const authStub = {
    tier: tierSignal,
    user: () => null,
    isAuthenticated: () => true,
    enterprise: enterpriseSignal,
    enterpriseId: () => (enterprise ? 'ent-1' : null),
  };
  const repo = fakeRepo();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CampaignsComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authStub },
      { provide: CampaignsRepository, useValue: repo as unknown as CampaignsRepository },
    ],
  });

  return {
    svc: TestBed.inject(CampaignsService),
    pdf: TestBed.inject(BriefPdfService),
    router: TestBed.inject(Router),
    repo,
    tier: tierSignal,
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'cmp-1',
    createdBy: 'u-1',
    enterpriseId: null,
    status: 'planning',
    name: 'Alpha',
    client: 'A',
    genre: 'Gaming',
    budget: 5000,
    notes: null,
    objectives: [],
    forecast: null,
    debriefNotes: null,
    startedAt: null,
    completedAt: null,
    createdAt: '2026-04-23T10:00:00.000Z',
    updatedAt: '2026-04-23T10:00:00.000Z',
    ...overrides,
  };
}

const band = (n: number) => ({
  conservative: Math.round(n * 0.68),
  expected: n,
  optimistic: Math.round(n * 1.42),
});

const LEGACY_FORECAST: LegacyCampaignForecast = {
  impressions: 100, ctr: 3.2, roas: 2.4, cvr: 1.8,
  p10: { impressions: 68, ctr: 2.2, roas: 1.6 },
  p50: { impressions: 100, ctr: 3.2, roas: 2.4 },
  p90: { impressions: 142, ctr: 4.5, roas: 3.4 },
};

const W2_FORECAST: W2Response = {
  mode: 'campaign', budget: 5_000, genre: 'Gaming', subMode: '', objectives: [],
  model: {
    version: 'w2-2026-08',
    params: { T: 0.35, k_youtube: 1.6, k_twitch: 2.5 },
    generatedAt: '2026-08-26T00:00:00.000Z',
  },
  bench: { ctrBase: 2, cvrBase: 0.5, engBase: 4 },
  creators: [], platforms: [],
  totals: {
    impressions: 40_000, engagedClicks: 960,
    uniqueReach: { value: 32_000, upperBound: true },
    conversions: { value: 288, upperBound: true },
    cost: 6_000, forecastableCost: 6_000, costPerConversion: 20.8,
    band: {
      impressions: band(40_000),
      uniqueReach: { ...band(32_000), upperBound: true },
      engagedClicks: band(960),
      conversions: { ...band(288), upperBound: true },
    },
  },
  unallocated: 0, unallocatedMessage: null, zeroBudget: false, warnings: [],
};

describe('CampaignsComponent', () => {
  beforeEach(() => {
    /* noop */
  });

  it('shows empty state when no campaigns exist', async () => {
    setup();
    const fixture = TestBed.createComponent(CampaignsComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="campaigns-empty"]')).toBeTruthy();
  });

  it('renders a grid of campaigns and a "Personal" badge for personal ones', async () => {
    const { repo } = setup();
    repo.list.mockResolvedValueOnce([makeCampaign({ id: 'a', enterpriseId: null })]);
    const fixture = TestBed.createComponent(CampaignsComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="campaigns-grid"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="campaign-owner-a"]')?.textContent.trim()).toBe('Personal');
  });

  it('renders a W2 saved forecast on the card without percentiles or ROAS', async () => {
    const { repo } = setup();
    repo.list.mockResolvedValueOnce([makeCampaign({ id: 'a', forecast: W2_FORECAST })]);
    const fixture = TestBed.createComponent(CampaignsComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('[data-testid="campaign-forecast-w2-a"]');
    expect(card).toBeTruthy();
    expect(card.textContent).toContain('40,000');
    expect(card.textContent).toContain('288');
    expect(card.textContent.toLowerCase()).not.toContain('roas');
    expect(fixture.nativeElement.querySelector('[data-testid="campaign-forecast-legacy-a"]')).toBeNull();
  });

  it('still renders a legacy saved forecast on the card', async () => {
    const { repo } = setup();
    repo.list.mockResolvedValueOnce([makeCampaign({ id: 'a', forecast: LEGACY_FORECAST })]);
    const fixture = TestBed.createComponent(CampaignsComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('[data-testid="campaign-forecast-legacy-a"]');
    expect(card).toBeTruthy();
    expect(card.textContent).toContain('2.4');   // ROAS
    expect(fixture.nativeElement.querySelector('[data-testid="campaign-forecast-w2-a"]')).toBeNull();
  });

  it('renders the enterprise name for enterprise-owned campaigns', async () => {
    const { repo } = setup({ enterprise: { name: 'Acme Org' } });
    repo.list.mockResolvedValueOnce([makeCampaign({ id: 'a', enterpriseId: 'ent-1' })]);
    const fixture = TestBed.createComponent(CampaignsComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="campaign-owner-a"]')?.textContent.trim()).toBe('Acme Org');
  });

  it('createAndOpen creates a campaign and navigates to its detail page', async () => {
    const { repo, router } = setup();
    repo.create.mockResolvedValueOnce(makeCampaign({ id: 'new' }));
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(CampaignsComponent);
    fixture.detectChanges();
    await flush();

    await fixture.componentInstance.createAndOpen();
    expect(repo.create).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith(['/app/campaigns', 'new']);
  });
});
