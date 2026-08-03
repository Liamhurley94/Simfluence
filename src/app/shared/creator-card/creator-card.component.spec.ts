import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Component, signal } from '@angular/core';

import { CreatorCardComponent } from './creator-card.component';
import { CreatorProfileService } from '../../core/creator-profile/creator-profile.service';
import { Creator } from '../../core/data/creator.types';
import { Format } from '../../core/simulation/simulation.types';

const SAMPLE: Creator = {
  id: 42,
  name: 'Test Creator',
  handle: '@test',
  platform: 'YouTube',
  allPlatforms: ['YouTube', 'Twitch'],
  subs: '1.5M',
  subsParsed: 1_500_000,
  avgViews: '180K',
  eng: '4.2%',
  genre: 'Gaming & Esports',
  cpi: 85,
  gfi: 72,
  color: '#00C46A',
  verifiedDeals: 2,
  sponsorHistory: ['Acme'],
  bio: 'test bio',
  rateRanges: { int: [500, 900], ded: [700, 1200], mix: [600, 1050] },
  ytStats: {
    subscriberCount: 1_500_000,
    avgViews: 180_000,
    engagementRate: 4.2,
    sponsorFreqPct: 15,
    statsRefreshedAt: null,
  },
};

@Component({
  standalone: true,
  imports: [CreatorCardComponent],
  template: `<app-creator-card
    [creator]="creator()"
    [selected]="selected()"
    [canSeeRates]="canSee()"
    [format]="format()"
    [gfiDisplay]="gfiDisplay()"
    (toggle)="toggled.set($event)"
  />`,
})
class HostComponent {
  creator = signal<Creator>(SAMPLE);
  selected = signal(false);
  canSee = signal(false);
  format = signal<Format>('Integrated');
  // GFI is genre-relative and passed in separately (the card no longer reads
  // creator().gfi). Discovery threads the per-genre score via [gfiDisplay].
  gfiDisplay = signal<number | null>(SAMPLE.gfi);
  toggled = signal<number | null>(null);
}

describe('CreatorCardComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent] });
  });

  it('renders name, handle, stats, and scores', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.querySelector('[data-testid="creator-name"]').textContent).toContain('Test Creator');
    expect(el.textContent).toContain('@test');
    // Live YT stats — compact(1_500_000) = '1.5M' from ytStats.subscriberCount
    expect(el.textContent).toContain('1.5M');
    expect(el.textContent).toContain('85');
    expect(el.textContent).toContain('72');
    // YouTube source badge
    expect(el.querySelector('[data-testid="metric-source-youtube"]')).toBeTruthy();
  });

  it('shows muted placeholder and no platform badges when creator has no ytStats or twitchStats', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.creator.set({
      ...SAMPLE,
      ytStats: undefined,
      twitchStats: undefined,
    });
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.querySelector('[data-testid="creator-stats-unavailable"]')).toBeTruthy();
    expect(el.textContent).toContain('Live stats unavailable');
    expect(el.querySelector('[data-testid="metric-source-youtube"]')).toBeNull();
    expect(el.querySelector('[data-testid="metric-source-twitch"]')).toBeNull();
  });

  it('renders Twitch CCV block + twitch badge for a Twitch-only creator (no ytStats)', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.creator.set({
      ...SAMPLE,
      platform: 'Twitch',
      allPlatforms: ['Twitch'],
      ytStats: undefined,
      twitchStats: {
        avgCcv: 3_200,
        peakCcv: 8_500,
        streams30d: 14,
        hoursStreamed30d: 56,
        lastStreamAt: null,
        primaryGameName: 'Fortnite',
        liveRefreshedAt: null,
      },
    });
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.querySelector('[data-testid="creator-twitch-stats"]')).toBeTruthy();
    expect(el.textContent).toContain('3K');    // compact(3200) → Math.round(3.2)=3 → '3K'
    expect(el.textContent).toContain('9K');    // compact(8500) → Math.round(8.5)=9 → '9K'
    expect(el.textContent).toContain('14');    // streams30d
    expect(el.textContent).toContain('Fortnite');
    expect(el.querySelector('[data-testid="metric-source-twitch"]')).toBeTruthy();
    // YT badge must not appear
    expect(el.querySelector('[data-testid="metric-source-youtube"]')).toBeNull();
    // Muted placeholder must not appear
    expect(el.querySelector('[data-testid="creator-stats-unavailable"]')).toBeNull();
  });

  it('separates platform data from a Source: Simfluence zone with the proprietary disclaimer', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement;
    // YouTube III.E.4h: the CPI/GFI/rate tiles live under a "Source: Simfluence"
    // zone header (a simfluence source badge) with an always-visible proprietary
    // disclaimer. Raw platform stats sit under their own "Source: YouTube API".
    expect(el.querySelector('[data-testid="creator-scores"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="metric-source-simfluence"]')).toBeTruthy();
    const note = el.querySelector('[data-testid="proprietary-note"]');
    expect(note).toBeTruthy();
    expect(note.textContent).toContain('independently calculated by Simfluence');
    expect(el.textContent).toContain('YouTube API');
  });

  it('clicking the card body opens the profile modal', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const openSpy = vi.spyOn(TestBed.inject(CreatorProfileService), 'open').mockImplementation(() => {});
    fixture.nativeElement.querySelector('[data-testid="creator-card"]').click();
    expect(openSpy).toHaveBeenCalledWith(expect.objectContaining({ id: SAMPLE.id }));
  });

  it('clicking Select toggles selection and does NOT open the modal', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const openSpy = vi.spyOn(TestBed.inject(CreatorProfileService), 'open').mockImplementation(() => {});
    fixture.nativeElement.querySelector('[data-testid="creator-toggle"]').click();
    expect(fixture.componentInstance.toggled()).toBe(SAMPLE.id);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('renders a badge per platform', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('YouTube');
    expect(text).toContain('Twitch');
  });

  it('blurs the rate label when canSeeRates=false, unblurs when true', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const rate = fixture.nativeElement.querySelector('[data-testid="creator-rate"]');
    expect(rate.classList.contains('blur-sm')).toBe(true);

    fixture.componentInstance.canSee.set(true);
    fixture.detectChanges();
    expect(rate.classList.contains('blur-sm')).toBe(false);
    // Computed range — assert non-em-dash, dollar-prefixed currency format.
    expect(rate.textContent.trim()).not.toBe('—');
    expect(rate.textContent).toMatch(/\$\d+/);
  });

  it('rateLabel changes range when the format input changes', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.canSee.set(true);

    fixture.componentInstance.format.set('Integrated');
    fixture.detectChanges();
    const rate = fixture.nativeElement.querySelector('[data-testid="creator-rate"]');
    const intLabel = rate.textContent.trim();

    fixture.componentInstance.format.set('Dedicated');
    fixture.detectChanges();
    const dedLabel = rate.textContent.trim();

    fixture.componentInstance.format.set('Mixed');
    fixture.detectChanges();
    const mixLabel = rate.textContent.trim();

    // All three should be distinct and dollar-formatted (Dedicated > Mixed > Integrated by midpoint).
    expect(intLabel).not.toBe(dedLabel);
    expect(mixLabel).not.toBe(dedLabel);
    expect(intLabel).toMatch(/^\$\d+/);
  });

  it('renders the mocked rateRanges value for the current format', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.canSee.set(true);
    fixture.componentInstance.format.set('Integrated');
    fixture.detectChanges();
    const rate = fixture.nativeElement.querySelector('[data-testid="creator-rate"]');
    // SAMPLE.rateRanges.int = [500, 900] — rendered straight from the column,
    // no client-side computation.
    expect(rate.textContent.trim()).toBe('$500–$900');
  });

  it('shows — when creator.rateRanges is undefined (not yet backfilled)', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.creator.set({ ...SAMPLE, rateRanges: undefined });
    fixture.componentInstance.canSee.set(true);
    fixture.detectChanges();
    const rate = fixture.nativeElement.querySelector('[data-testid="creator-rate"]');
    expect(rate.textContent.trim()).toBe('—');
  });

  it('emits toggle with creator id when button is clicked', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="creator-toggle"]',
    );
    button.click();
    expect(fixture.componentInstance.toggled()).toBe(42);
  });

  it('renders the tier badge derived from subsParsed', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('[data-testid="creator-tier-badge"]');
    expect(badge).toBeTruthy();
    // SAMPLE.subsParsed = 1_500_000 → Established (500K–2M).
    expect(badge.textContent.trim()).toBe('Established');

    fixture.componentInstance.creator.set({ ...SAMPLE, subsParsed: 3_000_000 });
    fixture.detectChanges();
    expect(badge.textContent.trim()).toBe('Megastar');
  });

  it('reflects selected state in the toggle label', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.selected.set(true);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('[data-testid="creator-toggle"]');
    expect(button.textContent).toContain('Selected');
  });
});

describe('CreatorCardComponent — show-all (CPI-only) mode', () => {
  const SHOW_ALL: Creator = {
    id: 99,
    name: 'Dual Platform',
    handle: '@dual',
    platform: 'YouTube',
    allPlatforms: ['YouTube', 'Twitch'],
    subs: '1.5M',
    subsParsed: 1_500_000,
    avgViews: '180K',
    eng: '4.2%',
    genre: 'Gaming & Esports',
    cpi: 88,
    gfi: 72,
    color: '#00C46A',
    verifiedDeals: 2,
    sponsorHistory: ['Acme'],
    bio: 'test bio',
    twCpi: 71,
    ytCpi: 88,
    bestCpi: 88,
  };

  @Component({
    standalone: true,
    imports: [CreatorCardComponent],
    template: `<app-creator-card [creator]="creator()" [format]="format()" />`,
  })
  class ShowAllHost {
    creator = signal<Creator>(SHOW_ALL);
    format = signal<Format>('Integrated');
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ShowAllHost] });
  });

  it('does NOT render the raw subs/avg-views/eng block', () => {
    const fixture = TestBed.createComponent(ShowAllHost);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    // The raw-stat block shows the literal subs/avgViews/eng strings. In show-all
    // those must be absent (CPI-only). '1.5M' is the SAMPLE subs string.
    expect(text).not.toContain('1.5M');
    expect(text).not.toContain('180K');
    expect(text).not.toContain('4.2%');
  });

  it('renders the best CPI and both per-platform CPIs for a multi-platform creator', () => {
    const fixture = TestBed.createComponent(ShowAllHost);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('88'); // best / yt
    expect(text).toContain('71'); // tw
    // Per-platform CPI labels present.
    expect(text).toContain('YouTube');
    expect(text).toContain('Twitch');
  });

  it('labels per-platform CPI by data source, not as a "YouTube CPI" metric', () => {
    const fixture = TestBed.createComponent(ShowAllHost);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    // YouTube III.E.4h: CPI is a Simfluence score computed *from* platform data,
    // not a platform-provided metric. The label must read "CPI · YouTube-based",
    // never the bare "YouTube CPI" (which reads as a YouTube-provided metric).
    expect(text).toContain('CPI · YouTube-based');
    expect(text).toContain('CPI · Twitch-based');
    expect(text).not.toContain('YouTube CPI');
    expect(text).not.toContain('Twitch CPI');
  });
});
