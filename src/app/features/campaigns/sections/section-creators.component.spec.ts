import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { SectionCreatorsComponent } from './section-creators.component';
import { CampaignCreatorsService } from '../../../core/campaigns/campaign-creators.service';
import { CreatorsService } from '../../../core/creators/creators.service';
import { CreatorProfileService } from '../../../core/creator-profile/creator-profile.service';
import { CreatorMatcherService, MatchResult } from '../../../core/creator-matcher/creator-matcher.service';
import { Campaign } from '../../../core/campaigns/campaign.types';

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'camp-1', name: 'Test Campaign', status: 'planning',
    createdBy: 'user-uuid', enterpriseId: null,
    client: null, genre: null, objectives: [], budget: null, notes: null,
    forecast: null,
    debriefNotes: null,
    startedAt: null, completedAt: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function matchResult(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    optimizedFor: 'fit',
    budgetConstrained: true,
    budget: 50_000,
    creators: [
      {
        creator: { id: 7, name: 'Nova', handle: 'nova', platform: 'YouTube', color: '#0f0' },
        best_cpi: 88,
        gfi: 91,
        reach: 1_200_000,
        rateEstimate: { ranges: { mix: [1200, 2400] } },
        why: 'CPI 88 · GFI 91',
      },
    ],
    ...overrides,
  };
}

function setup(
  campaign = makeCampaign(),
  records: any[] = [],
  result = matchResult(),
  inputs: { readonly?: boolean; rosterLocked?: boolean } = {},
) {
  const recordsSig = signal<any[]>(records);
  const campaignCreatorsStub = {
    records: recordsSig, loading: signal(false), error: signal(null),
    add: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const creatorsStub = { byIds: vi.fn().mockResolvedValue([]) };
  const match = vi.fn().mockResolvedValue(result);
  const matcherStub = { match };
  const openById = vi.fn();
  const profileStub = { openById };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [SectionCreatorsComponent],
    providers: [
      { provide: CampaignCreatorsService, useValue: campaignCreatorsStub },
      { provide: CreatorsService, useValue: creatorsStub },
      { provide: CreatorMatcherService, useValue: matcherStub },
      { provide: CreatorProfileService, useValue: profileStub },
    ],
  });

  const fixture = TestBed.createComponent(SectionCreatorsComponent);
  fixture.componentRef.setInput('campaign', campaign);
  if (inputs.readonly !== undefined) fixture.componentRef.setInput('readonly', inputs.readonly);
  if (inputs.rosterLocked !== undefined) fixture.componentRef.setInput('rosterLocked', inputs.rosterLocked);
  fixture.detectChanges();
  return { fixture, campaignCreatorsStub, creatorsStub, match, openById };
}

async function settle(fixture: { whenStable: () => Promise<unknown>; detectChanges: () => void }) {
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('SectionCreatorsComponent', () => {
  it('renders the section container', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.querySelector('[data-testid="section-creators"]')).toBeTruthy();
  });

  it('does not render the Matcher panel when planning but genre/budget are missing', () => {
    const { fixture } = setup(makeCampaign({ genre: null, budget: null }));
    expect(fixture.nativeElement.querySelector('[data-testid="creator-matcher-panel"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="matcher-need-settings"]')).toBeTruthy();
  });

  it('does not render the Matcher panel when the campaign is not planning', () => {
    const { fixture } = setup(makeCampaign({ status: 'active', genre: 'Gaming & Esports', budget: 50_000 }));
    expect(fixture.nativeElement.querySelector('[data-testid="creator-matcher-panel"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="matcher-need-settings"]')).toBeNull();
  });

  it('renders the Matcher panel with a why banner + cards when planning + genre + budget', async () => {
    const { fixture } = setup(makeCampaign({ genre: 'Gaming & Esports', budget: 50_000, objectives: ['Sales'] }));
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('[data-testid="creator-matcher-panel"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="matcher-why-banner"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="matcher-card-7"]')).toBeTruthy();
  });

  it('passes the current roster ids as excludeIds to the matcher', async () => {
    const records = [
      { id: 'cc-1', creatorId: 11, source: 'manual' },
      { id: 'cc-2', creatorId: 22, source: 'auto_match' },
    ];
    const { fixture, match } = setup(
      makeCampaign({ genre: 'Gaming & Esports', budget: 50_000 }),
      records,
    );
    await settle(fixture);

    expect(match).toHaveBeenCalledWith(
      expect.objectContaining({ excludeIds: [11, 22], genre: 'Gaming & Esports', budget: 50_000, limit: 12 }),
    );
  });

  it('adds a matched creator with source auto_match + cpiAtAdd from best_cpi', async () => {
    const { fixture, campaignCreatorsStub } = setup(
      makeCampaign({ genre: 'Gaming & Esports', budget: 50_000 }),
    );
    await settle(fixture);

    const addBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="matcher-add-7"]');
    addBtn.click();
    await settle(fixture);

    expect(campaignCreatorsStub.add).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'camp-1',
        creatorId: 7,
        source: 'auto_match',
        cpiAtAdd: 88,
        rateEstimate: 1800, // midpoint of [1200, 2400]
      }),
    );
  });

  describe('opening the creator profile modal', () => {
    const roster = [{ id: 'cc-1', creatorId: 11, source: 'manual' }];

    it('opens by id when the roster row is clicked', () => {
      const { fixture, openById } = setup(makeCampaign(), roster);

      fixture.nativeElement.querySelector('[data-testid="campaign-creator-cc-1"]').click();

      expect(openById).toHaveBeenCalledOnce();
      expect(openById).toHaveBeenCalledWith(11);
    });

    it('opens by id even before the creator hydrate resolves (placeholder row)', () => {
      // byIds resolves empty, so creatorById() never gains an entry and the row
      // renders "Creator #11" — the click must still work.
      const { fixture, openById } = setup(makeCampaign(), roster);

      const row: HTMLElement = fixture.nativeElement.querySelector('[data-testid="campaign-creator-cc-1"]');
      expect(row.textContent).toContain('Creator #11');
      row.click();

      expect(openById).toHaveBeenCalledWith(11);
    });

    it('does NOT open the modal when Remove is clicked', () => {
      const { fixture, openById, campaignCreatorsStub } = setup(makeCampaign(), roster);

      fixture.nativeElement.querySelector('[data-testid="campaign-creator-remove-cc-1"]').click();

      expect(campaignCreatorsStub.remove).toHaveBeenCalledWith('cc-1');
      expect(openById).not.toHaveBeenCalled();
    });

    it('stays clickable when the roster is locked — viewing a profile is read-only', () => {
      const { fixture, openById } = setup(
        makeCampaign({ status: 'active' }),
        roster,
        matchResult(),
        { rosterLocked: true },
      );

      fixture.nativeElement.querySelector('[data-testid="campaign-creator-cc-1"]').click();

      expect(openById).toHaveBeenCalledWith(11);
    });
  });

  describe('roster locking (rosterLocked input)', () => {
    const roster = [{ id: 'cc-1', creatorId: 11, source: 'manual' }];

    it('enables Browse all + Remove and shows the Matcher on a planning campaign', () => {
      const { fixture } = setup(
        makeCampaign({ status: 'planning', genre: 'Gaming & Esports', budget: 50_000 }),
        roster,
        matchResult(),
        { rosterLocked: false },
      );
      const browse: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="creators-browse"]');
      const remove: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="campaign-creator-remove-cc-1"]');

      expect(browse.disabled).toBe(false);
      expect(remove.disabled).toBe(false);
      expect(fixture.nativeElement.querySelector('[data-testid="creator-matcher-panel"]')).toBeTruthy();
    });

    it('disables Browse all + Remove and hides the Matcher when the roster is locked (active campaign)', () => {
      const { fixture } = setup(
        makeCampaign({ status: 'active', genre: 'Gaming & Esports', budget: 50_000 }),
        roster,
        matchResult(),
        { rosterLocked: true },
      );
      const browse: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="creators-browse"]');
      const remove: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="campaign-creator-remove-cc-1"]');

      expect(browse.disabled).toBe(true);
      expect(remove.disabled).toBe(true);
      expect(fixture.nativeElement.querySelector('[data-testid="creator-matcher-panel"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="matcher-need-settings"]')).toBeNull();
    });
  });
});
