import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { DiscoveryAddDialogComponent, seedFrom } from './discovery-add-dialog.component';
import { AdminCreatorService } from '../../core/admin/admin-creator.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { DiscoveredChannel } from '../../core/admin/admin-discovery.types';

function mkCandidate(overrides: Partial<DiscoveredChannel> = {}): DiscoveredChannel {
  return {
    channel_id: 'UC123',
    name: 'TechLead',
    handle: 'techlead',
    bio: 'Ex-Google tech lead. Videos on software careers.',
    country: 'US',
    language: 'en',
    video_count: 210,
    thumbnail_url: 'https://example.com/a.jpg',
    subscriber_count: 1_200_000,
    avg_views: 240_000,
    engagement_rate: 20,
    sponsor_freq_pct: 4,
    uploads_playlist_id: 'UU123',
    recent_videos: [
      { title: 'I quit my $500K job', views: 890_000, likes: 40_000, comments: 3_000, url: 'https://youtu.be/a', paid_promo: false },
    ],
    found_by_query: 'tech review',
    run_id: 'run-1',
    genre: 'Tech & Gadgets',
    sub_mode: 'Reviews',
    fetched_at: '2026-07-10T00:00:00Z',
    status: 'new',
    matched_creator_id: null,
    match_type: null,
    ...overrides,
  };
}

function setup(overrides: { addCreators?: ReturnType<typeof vi.fn>; attachPlatform?: ReturnType<typeof vi.fn> } = {}) {
  const addCreators = overrides.addCreators
    ?? vi.fn().mockResolvedValue({ created: [{ id: 1, name: 'TechLead', platforms: ['YouTube'] }] });
  const attachPlatform = overrides.attachPlatform
    ?? vi.fn().mockResolvedValue({ attached: { creatorId: 555, platform: 'youtube' } });

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DiscoveryAddDialogComponent],
    providers: [
      { provide: AdminCreatorService, useValue: { addCreators, attachPlatform } },
      {
        provide: CreatorsService,
        useValue: {
          submodesByGenre: () => ({
            'Tech & Gadgets': [{ subMode: 'Reviews', hasKeywords: true }, { subMode: 'Unboxing', hasKeywords: false }],
            Gaming: [],
          }),
          languages: () => [{ code: 'en', name: 'English' }, { code: 'de', name: 'German' }],
        },
      },
    ],
  });
  return { addCreators, attachPlatform };
}

function create(mode: 'add' | 'link', candidate: DiscoveredChannel) {
  const fixture = TestBed.createComponent(DiscoveryAddDialogComponent);
  fixture.componentRef.setInput('candidate', candidate);
  fixture.componentRef.setInput('mode', mode);
  fixture.detectChanges();
  return fixture;
}

describe('seedFrom', () => {
  it('maps every DiscoveredChannel stats field to StatsSeed', () => {
    const c = mkCandidate();
    expect(seedFrom(c)).toEqual({
      channelId: 'UC123',
      uploadsPlaylistId: 'UU123',
      subscriberCount: 1_200_000,
      totalViews: 0,
      videoCount: 210,
      avgViews: 240_000,
      engagementRate: 20,
      sponsorFreqPct: 4,
      recentVideos: c.recent_videos,
    });
  });
});

describe('DiscoveryAddDialogComponent', () => {
  describe('add mode', () => {
    it('prefills name/genre/subMode/language/bio from the candidate', () => {
      const fixture = create('add', mkCandidate());
      const v = fixture.componentInstance.form.getRawValue();
      expect(v).toMatchObject({
        name: 'TechLead', genre: 'Tech & Gadgets', subMode: 'Reviews', language: 'en',
        bio: 'Ex-Google tech lead. Videos on software careers.',
      });
    });

    it('renders the detected sub-mode as a disabled display-only control (never submitted)', async () => {
      const { addCreators } = setup();
      const fixture = create('add', mkCandidate());
      const c = fixture.componentInstance;
      expect(c.form.controls.subMode.disabled).toBe(true);
      const el: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="dialog-submode"]');
      expect(el.disabled).toBe(true);
      await c.onSubmit();
      // Payload carries no sub-mode in any spelling — the API has no such field.
      const [input] = addCreators.mock.calls[0];
      expect(JSON.stringify(input)).not.toMatch(/sub_?mode/i);
    });

    it('blocks submit without a name and genre, and does not call the service', async () => {
      const { addCreators } = setup();
      const fixture = create('add', mkCandidate());
      const c = fixture.componentInstance;
      c.form.patchValue({ name: '', genre: '' });
      await c.onSubmit();
      expect(addCreators).not.toHaveBeenCalled();
      expect(c.error()).toBe('Enter a name and pick a genre.');
    });

    it('posts an AddCreatorInput with statsSeed keyed to the candidate channel_id', async () => {
      const { addCreators } = setup();
      const candidate = mkCandidate();
      const fixture = create('add', candidate);
      await fixture.componentInstance.onSubmit();

      expect(addCreators).toHaveBeenCalledTimes(1);
      const [input] = addCreators.mock.calls[0];
      expect(input).toEqual([{
        name: 'TechLead',
        genre: 'Tech & Gadgets',
        platforms: { youtube: 'techlead' },
        bio: 'Ex-Google tech lead. Videos on software careers.',
        language: 'en',
        statsSeed: seedFrom(candidate),
      }]);
      expect(input[0].statsSeed.channelId).toBe('UC123');
    });

    it('falls back to channel_id for the youtube handle when the candidate has none', async () => {
      const { addCreators } = setup();
      const candidate = mkCandidate({ handle: '' });
      const fixture = create('add', candidate);
      await fixture.componentInstance.onSubmit();
      const [input] = addCreators.mock.calls[0];
      expect(input[0].platforms.youtube).toBe('UC123');
    });

    it('includes an optional twitch handle when provided', async () => {
      const { addCreators } = setup();
      const fixture = create('add', mkCandidate());
      const c = fixture.componentInstance;
      c.form.patchValue({ twitch: 'techleadtv' });
      await c.onSubmit();
      const [input] = addCreators.mock.calls[0];
      expect(input[0].platforms.twitch).toBe('techleadtv');
    });

    it('emits done on success', async () => {
      setup();
      const fixture = create('add', mkCandidate());
      const c = fixture.componentInstance;
      let emitted = false;
      c.done.subscribe(() => (emitted = true));
      await c.onSubmit();
      expect(emitted).toBe(true);
    });

    it('surfaces the edge fn error message and does not emit done', async () => {
      const { addCreators } = setup({
        addCreators: vi.fn().mockRejectedValue({ error: { error: 'A creator with YouTube handle "techlead" already exists' } }),
      });
      const fixture = create('add', mkCandidate());
      const c = fixture.componentInstance;
      let emitted = false;
      c.done.subscribe(() => (emitted = true));
      await c.onSubmit();
      expect(addCreators).toHaveBeenCalled();
      expect(c.error()).toBe('A creator with YouTube handle "techlead" already exists');
      expect(emitted).toBe(false);
    });
  });

  describe('link mode', () => {
    it('prefills creatorId from matched_creator_id', () => {
      const fixture = create('link', mkCandidate({ matched_creator_id: 555 }));
      expect(fixture.componentInstance.form.getRawValue().creatorId).toBe(555);
    });

    it('blocks submit without a creatorId, and does not call the service', async () => {
      const { attachPlatform } = setup();
      const fixture = create('link', mkCandidate({ matched_creator_id: null }));
      const c = fixture.componentInstance;
      await c.onSubmit();
      expect(attachPlatform).not.toHaveBeenCalled();
      expect(c.error()).toBe('Enter a creator ID to link to.');
    });

    it('calls attachPlatform with the prefilled creatorId, youtube platform, and statsSeed', async () => {
      const { attachPlatform } = setup();
      const candidate = mkCandidate({ matched_creator_id: 555 });
      const fixture = create('link', candidate);
      await fixture.componentInstance.onSubmit();

      expect(attachPlatform).toHaveBeenCalledWith({
        creatorId: 555,
        platform: 'youtube',
        handle: 'techlead',
        statsSeed: seedFrom(candidate),
      });
    });

    it('respects a manually-entered creatorId when there is no automatic match', async () => {
      const { attachPlatform } = setup();
      const fixture = create('link', mkCandidate({ matched_creator_id: null }));
      const c = fixture.componentInstance;
      c.form.patchValue({ creatorId: 999 });
      await c.onSubmit();
      expect(attachPlatform).toHaveBeenCalledWith(expect.objectContaining({ creatorId: 999 }));
    });

    it('emits done on success', async () => {
      setup();
      const fixture = create('link', mkCandidate({ matched_creator_id: 555 }));
      const c = fixture.componentInstance;
      let emitted = false;
      c.done.subscribe(() => (emitted = true));
      await c.onSubmit();
      expect(emitted).toBe(true);
    });

    it('surfaces the edge fn error message', async () => {
      const { attachPlatform } = setup({
        attachPlatform: vi.fn().mockRejectedValue({ error: { error: 'Creator already has youtube attached' } }),
      });
      const fixture = create('link', mkCandidate({ matched_creator_id: 555 }));
      const c = fixture.componentInstance;
      await c.onSubmit();
      expect(attachPlatform).toHaveBeenCalled();
      expect(c.error()).toBe('Creator already has youtube attached');
    });
  });
});
