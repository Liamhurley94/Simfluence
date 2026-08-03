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

function setup(creator: Creator | null) {
  TestBed.resetTestingModule();

  const profileStub = {
    current: signal<Creator | null>(creator),
    open: vi.fn(),
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
