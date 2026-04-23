import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';

import { FilterPanelComponent, DiscoveryQuery } from './filter-panel.component';

@Component({
  standalone: true,
  imports: [FilterPanelComponent],
  template: `<app-filter-panel (change)="last.set($event)" />`,
})
class HostComponent {
  last = signal<DiscoveryQuery | null>(null);
}

describe('FilterPanelComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent] });
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
