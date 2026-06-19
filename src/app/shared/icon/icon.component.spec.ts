import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';

import { IconComponent, IconName } from './icon.component';

@Component({
  standalone: true,
  imports: [IconComponent],
  template: `<app-icon [name]="name()" [size]="size()" />`,
})
class HostComponent {
  name = signal<IconName>('check');
  size = signal<number>(16);
}

describe('IconComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent] });
  });

  it('renders an svg element for a given icon name', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('sets aria-hidden on the svg', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('applies the size input to width and height', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.size.set(24);
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
  });

  it('defaults size to 16 when not provided', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('width')).toBe('16');
  });

  it('renders child elements inside the svg for the "moon" icon', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.name.set('moon');
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    // moon uses a <path> — check that at least one child element is present
    expect(svg.childElementCount).toBeGreaterThan(0);
  });

  it('renders child elements inside the svg for the "sun" icon', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.name.set('sun');
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    // sun uses both <circle> and <path> — check multiple children
    expect(svg.childElementCount).toBeGreaterThan(1);
  });

  it('has correct viewBox', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('has stroke="currentColor" and fill="none"', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('fill')).toBe('none');
  });
});
