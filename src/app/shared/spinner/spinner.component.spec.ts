import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';

import { SpinnerComponent } from './spinner.component';

@Component({
  standalone: true,
  imports: [SpinnerComponent],
  template: `<app-spinner [size]="size()" [label]="label()" />`,
})
class HostComponent {
  size = signal<number>(20);
  label = signal<string | undefined>(undefined);
}

describe('SpinnerComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent] });
  });

  it('renders an svg element', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('sets width and height from size input', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.size.set(32);
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('height')).toBe('32');
  });

  it('defaults size to 20', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('width')).toBe('20');
  });

  it('does not render a label span when label is not provided', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const span = fixture.nativeElement.querySelector('span > span');
    expect(span).toBeFalsy();
  });

  it('renders a label span when label is provided', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.label.set('Loading…');
    fixture.detectChanges();
    const span = fixture.nativeElement.querySelector('span > span');
    expect(span).toBeTruthy();
    expect(span.textContent.trim()).toBe('Loading…');
  });
});
