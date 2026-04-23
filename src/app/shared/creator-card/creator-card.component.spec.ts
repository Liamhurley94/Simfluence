import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';

import { CreatorCardComponent } from './creator-card.component';
import { Creator } from '../../core/data/creator.types';

const SAMPLE: Creator = {
  id: 42,
  name: 'Test Creator',
  handle: '@test',
  platform: 'YouTube',
  allPlatforms: ['YouTube', 'Twitch'],
  subs: '1.5M',
  avgViews: '180K',
  eng: '4.2%',
  genre: 'Gaming & Esports',
  cpi: 85,
  gfi: 72,
  color: '#00C46A',
  verifiedDeals: 2,
  sponsorHistory: ['Acme'],
  bio: 'test bio',
  rates: { mix: [10_000, 40_000] },
};

@Component({
  standalone: true,
  imports: [CreatorCardComponent],
  template: `<app-creator-card
    [creator]="creator()"
    [selected]="selected()"
    [canSeeRates]="canSee()"
    (toggle)="toggled.set($event)"
  />`,
})
class HostComponent {
  creator = signal<Creator>(SAMPLE);
  selected = signal(false);
  canSee = signal(false);
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
    expect(el.textContent).toContain('1.5M');
    expect(el.textContent).toContain('85');
    expect(el.textContent).toContain('72');
  });

  it('renders a badge per platform', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('YouTube');
    expect(text).toContain('Twitch');
  });

  it('blurs the rate label when canSeeRates=false, shows clean when true', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const rate = fixture.nativeElement.querySelector('[data-testid="creator-rate"]');
    expect(rate.classList.contains('blur-sm')).toBe(true);

    fixture.componentInstance.canSee.set(true);
    fixture.detectChanges();
    expect(rate.classList.contains('blur-sm')).toBe(false);
    expect(rate.textContent).toContain('$10K');
    expect(rate.textContent).toContain('$40K');
  });

  it('shows em-dash when no rates are available', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.creator.set({ ...SAMPLE, rates: undefined });
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

  it('reflects selected state in the toggle label', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.selected.set(true);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('[data-testid="creator-toggle"]');
    expect(button.textContent).toContain('Selected');
  });
});
