import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreatorProfileModalComponent } from './creator-profile-modal.component';
import { CreatorProfileService } from '../../core/creator-profile/creator-profile.service';
import { YoutubeCreatorService } from '../../core/youtube/youtube-creator.service';
import { TwitchLiveService } from '../../core/twitch/twitch-live.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Creator } from '../../core/data/creator.types';

// Platform deliberately not YouTube/Twitch — keeps the yt/tw resource loaders
// (hasYoutube/hasTwitch both false) from touching the stubbed services, so
// these tests stay focused on the Estimated Budget Range box.
function mkCreator(overrides: Partial<Creator> = {}): Creator {
  return {
    id: 1,
    name: 'Test Creator',
    handle: '@test',
    platform: 'TikTok',
    allPlatforms: ['TikTok'],
    subs: '500K',
    subsParsed: 500_000,
    avgViews: '50K',
    eng: '4%',
    genre: 'Gaming & Esports',
    cpi: 80,
    gfi: 70,
    color: '#fff',
    verifiedDeals: 1,
    sponsorHistory: [],
    bio: '',
    rateRanges: { int: [500, 900], ded: [700, 1200], mix: [600, 1050] },
    ...overrides,
  };
}

function setup(creator: Creator | null, loading = false) {
  TestBed.resetTestingModule();

  const profileStub = {
    current: signal<Creator | null>(creator),
    loading: signal(loading),
    open: vi.fn(),
    openById: vi.fn(),
    close: vi.fn(),
  };
  const youtubeStub = { fetch: vi.fn().mockResolvedValue(null) };
  const twitchStub = { fetchEnrichment: vi.fn().mockResolvedValue(null) };
  const supabaseStub = { client: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) } };

  TestBed.configureTestingModule({
    imports: [CreatorProfileModalComponent],
    providers: [
      { provide: CreatorProfileService, useValue: profileStub },
      { provide: YoutubeCreatorService, useValue: youtubeStub },
      { provide: TwitchLiveService, useValue: twitchStub },
      { provide: SupabaseService, useValue: supabaseStub },
    ],
  });

  return { profileStub };
}

describe('CreatorProfileModalComponent — loading skeleton', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the skeleton shell, not the real modal, while openById is in flight', () => {
    setup(null, true);
    const fixture = TestBed.createComponent(CreatorProfileModalComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="creator-profile-skeleton"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="creator-profile-modal"]')).toBeNull();
  });

  it('renders nothing at all when idle — not loading and no creator', () => {
    setup(null, false);
    const fixture = TestBed.createComponent(CreatorProfileModalComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="creator-profile-skeleton"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="creator-profile-modal"]')).toBeNull();
  });

  it('renders the real modal once a creator is present and loading has cleared', async () => {
    setup(mkCreator(), false);
    const fixture = TestBed.createComponent(CreatorProfileModalComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="creator-profile-modal"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="creator-profile-skeleton"]')).toBeNull();
  });

  it('closes from the skeleton backdrop — a slow fetch is escapable', () => {
    const { profileStub } = setup(null, true);
    const fixture = TestBed.createComponent(CreatorProfileModalComponent);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="creator-profile-loading-backdrop"]').click();
    expect(profileStub.close).toHaveBeenCalledOnce();
  });
});

describe('CreatorProfileModalComponent — Estimated Budget Range', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the three format ranges straight from creator.rateRanges', async () => {
    setup(mkCreator());
    const fixture = TestBed.createComponent(CreatorProfileModalComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const budget = fixture.nativeElement.querySelector('[data-testid="creator-profile-budget"]');
    expect(budget).toBeTruthy();

    // The three lo-value tiles render in DOM order: Integrated, Dedicated, Mixed.
    const los = Array.from(budget.querySelectorAll('.text-sm.font-bold')) as HTMLElement[];
    expect(los.map((el) => el.textContent!.trim())).toEqual(['$500', '$700', '$600']);
  });

  it('renders — for every range when creator.rateRanges is undefined (not yet backfilled)', async () => {
    setup(mkCreator({ rateRanges: undefined }));
    const fixture = TestBed.createComponent(CreatorProfileModalComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const budget = fixture.nativeElement.querySelector('[data-testid="creator-profile-budget"]');
    expect(budget).toBeTruthy();

    const los = Array.from(budget.querySelectorAll('.text-sm.font-bold')) as HTMLElement[];
    expect(los.length).toBe(3);
    for (const el of los) {
      expect(el.textContent!.trim()).toBe('—');
    }
    expect(budget.textContent).not.toMatch(/\$\d/);
  });
});
