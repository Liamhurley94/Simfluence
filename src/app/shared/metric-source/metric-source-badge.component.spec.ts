import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';

import { MetricSource, MetricSourceBadgeComponent } from './metric-source-badge.component';

@Component({
  standalone: true,
  imports: [MetricSourceBadgeComponent],
  template: `<app-metric-source-badge [source]="source()" [label]="label()" />`,
})
class HostComponent {
  source = signal<MetricSource>('youtube');
  label = signal<string | undefined>(undefined);
}

function badge(fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>, source: MetricSource): HTMLElement {
  return fixture.nativeElement.querySelector(`[data-testid="metric-source-${source}"]`);
}

describe('MetricSourceBadgeComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent] });
  });

  it('renders the default YouTube label and red token', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = badge(fixture, 'youtube');
    expect(el.textContent?.trim()).toBe('YouTube');
    expect(el.style.color).toBe('var(--color-sf-red)');
  });

  it('renders the Twitch label and twitch token', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.source.set('twitch');
    fixture.detectChanges();
    const el = badge(fixture, 'twitch');
    expect(el.textContent?.trim()).toBe('Twitch');
    expect(el.style.color).toBe('var(--color-twitch)');
  });

  it('renders the Simfluence label and blue token', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.source.set('simfluence');
    fixture.detectChanges();
    const el = badge(fixture, 'simfluence');
    expect(el.textContent?.trim()).toBe('Simfluence');
    expect(el.style.color).toBe('var(--color-sf-blue)');
  });

  it('uses an explicit label override when provided', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.source.set('simfluence');
    fixture.componentInstance.label.set('Estimated');
    fixture.detectChanges();
    const el = badge(fixture, 'simfluence');
    expect(el.textContent?.trim()).toBe('Estimated');
  });
});
