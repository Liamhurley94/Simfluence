import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignsComponent } from './campaigns.component';
import { AuthService } from '../../core/auth/auth.service';
import { CampaignsService } from '../../core/campaigns/campaigns.service';
import { CampaignsRepository } from '../../core/campaigns/campaigns.repository';
import { BriefPdfService } from '../../core/campaigns/brief-pdf.service';
import { Campaign } from '../../core/campaigns/campaign.types';

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
    startedAt: null,
    completedAt: null,
    createdAt: '2026-04-23T10:00:00.000Z',
    updatedAt: '2026-04-23T10:00:00.000Z',
    ...overrides,
  };
}

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
