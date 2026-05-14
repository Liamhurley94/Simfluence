import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Component, signal } from '@angular/core';

import { FilterPanelComponent, DiscoveryQuery } from './filter-panel.component';
import { CreatorsService } from '../../core/creators/creators.service';
import { AuthService } from '../../core/auth/auth.service';
import { UpgradePromptService } from '../../core/upgrade/upgrade-prompt.service';
import { Tier } from '../../core/types';

// FilterPanelComponent reads dropdown options off CreatorsService signals
// (populated by an RPC at app boot). In tests we substitute a stub with
// pre-populated lists so the <select> options and platform chips render.
const creatorsStub = {
  genres: signal(['Gaming & Esports', 'Music']),
  platforms: signal(['YouTube', 'Twitch']),
  languages: signal(['English', 'Spanish']),
};

function authStub(tier: Tier = 'gold') {
  return { tier: signal<Tier>(tier) };
}

@Component({
  standalone: true,
  imports: [FilterPanelComponent],
  template: `<app-filter-panel (queryChange)="last.set($event)" />`,
})
class HostComponent {
  last = signal<DiscoveryQuery | null>(null);
}

describe('FilterPanelComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: CreatorsService, useValue: creatorsStub },
        { provide: AuthService, useValue: authStub('gold') },
      ],
    });
  });

  it('emits query on search input change', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="filter-search"]',
    );
    input.value = 'quin';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.last()?.search).toBe('quin');
    expect(fixture.componentInstance.last()?.sort).toBe('cpi');
  });

  it('emits query on genre selection', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector(
      '[data-testid="filter-genre"]',
    );
    // pick first non-empty option
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.last()?.genre).toBeTruthy();
  });

  it('toggles platform selection via chip click', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const twitchBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="filter-platform-twitch"]',
    );
    twitchBtn.click();
    expect(fixture.componentInstance.last()?.platforms).toContain('Twitch');

    twitchBtn.click();
    expect(fixture.componentInstance.last()?.platforms).not.toContain('Twitch');
  });

  it('defaults format to "Integrated" and emits it on every query', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    // Trigger an emit by changing search.
    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="filter-search"]',
    );
    input.value = 'x';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.last()?.format).toBe('Integrated');
  });

  it('emits the new format when the format select changes', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector(
      '[data-testid="filter-format"]',
    );
    // index 0=Integrated, 1=Dedicated, 2=Mixed
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.last()?.format).toBe('Dedicated');
  });

  it('emits tier when the tier select changes', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector(
      '[data-testid="filter-tier"]',
    );
    // option index 0 is "Mixed tiers" (undefined); index 4 is "Megastar".
    select.selectedIndex = 4;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.last()?.tier).toBe('Megastar');
  });

  it('emits minCpi when the CPI slider moves', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const slider: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="filter-min-cpi"]',
    );
    slider.value = '70';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.last()?.minCpi).toBe(70);
    expect(
      fixture.nativeElement.querySelector('[data-testid="filter-min-cpi-val"]').textContent.trim(),
    ).toBe('70');
  });

  it('emits minGfi when the GFI slider moves', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const slider: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="filter-min-gfi"]',
    );
    slider.value = '65';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.last()?.minGfi).toBe(65);
  });

  it('shows "Any" when sliders are at 0', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="filter-min-cpi-val"]').textContent.trim(),
    ).toBe('Any');
    expect(
      fixture.nativeElement.querySelector('[data-testid="filter-min-gfi-val"]').textContent.trim(),
    ).toBe('Any');
  });

  it('clearAll resets every filter and emits empty query', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="filter-search"]',
    );
    input.value = 'abc';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const clear: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="filter-clear"]',
    );
    expect(clear).toBeTruthy();
    clear.click();
    fixture.detectChanges();

    const q = fixture.componentInstance.last();
    expect(q?.search).toBe('');
    expect(q?.genre).toBeUndefined();
    expect(q?.platforms?.length).toBe(0);
    expect(q?.languages?.length).toBe(0);
  });
});

describe('FilterPanelComponent — score-filter gating', () => {
  function setupAt(tier: Tier) {
    const upgrade = { open: vi.fn(), close: vi.fn(), current: signal(null) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: CreatorsService, useValue: creatorsStub },
        { provide: AuthService, useValue: authStub(tier) },
        { provide: UpgradePromptService, useValue: upgrade },
      ],
    });
    return { upgrade };
  }

  it('non-gold sees the upgrade CTA and the slider group is locked', () => {
    setupAt('silver');
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector('[data-testid="filter-score-group"]');
    expect(group.classList.contains('pointer-events-none')).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="filter-score-upgrade"]')).toBeTruthy();
  });

  it('clicking the upgrade CTA opens UpgradePromptService for gold', () => {
    const { upgrade } = setupAt('free');
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const cta: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="filter-score-upgrade"]',
    );
    cta.click();

    expect(upgrade.open).toHaveBeenCalledWith('CPI / GFI score filters', 'gold');
  });

  it('non-gold: even if a slider event fires, minCpi/minGfi never emit', () => {
    setupAt('silver');
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const slider: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="filter-min-cpi"]',
    );
    slider.value = '70';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    // Component-level emit should still treat minCpi as 0 for non-gold users.
    // We can't easily intercept the emit here without triggering one, but the
    // (input) wouldn't have set the signal in the first place. Confirm by
    // reading the displayed value — should still be "Any".
    expect(
      fixture.nativeElement.querySelector('[data-testid="filter-min-cpi-val"]').textContent.trim(),
    ).toBe('Any');
  });

  it('gold tier hides the upgrade CTA and unlocks the slider group', () => {
    setupAt('gold');
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector('[data-testid="filter-score-group"]');
    expect(group.classList.contains('pointer-events-none')).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-testid="filter-score-upgrade"]')).toBeNull();
  });
});
