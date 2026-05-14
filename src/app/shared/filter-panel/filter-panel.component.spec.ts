import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';

import { FilterPanelComponent, DiscoveryQuery } from './filter-panel.component';
import { CreatorsService } from '../../core/creators/creators.service';

// FilterPanelComponent reads dropdown options off CreatorsService signals
// (populated by an RPC at app boot). In tests we substitute a stub with
// pre-populated lists so the <select> options and platform chips render.
const creatorsStub = {
  genres: signal(['Gaming & Esports', 'Music']),
  platforms: signal(['YouTube', 'Twitch']),
  languages: signal(['English', 'Spanish']),
};

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
      providers: [{ provide: CreatorsService, useValue: creatorsStub }],
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
