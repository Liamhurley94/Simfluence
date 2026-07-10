import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BarChartComponent, barScale } from './bar-chart.component';

describe('barScale', () => {
  it('scales values to pixel heights against the max', () => {
    expect(barScale([0, 5, 10], 10, 100)).toEqual([0, 50, 100]);
  });
  it('treats a zero/undefined max as empty (no NaN)', () => {
    expect(barScale([0, 0], 0, 100)).toEqual([0, 0]);
  });
});

describe('BarChartComponent', () => {
  it('renders one bar rect per value', () => {
    TestBed.configureTestingModule({ imports: [BarChartComponent] });
    const f = TestBed.createComponent(BarChartComponent);
    f.componentRef.setInput('values', [1, 2, 3]);
    f.componentRef.setInput('labels', ['a', 'b', 'c']);
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('[data-testid="bar"]').length).toBe(3);
  });

  it('draws a threshold line when threshold is set', () => {
    TestBed.configureTestingModule({ imports: [BarChartComponent] });
    const f = TestBed.createComponent(BarChartComponent);
    f.componentRef.setInput('values', [1, 2]);
    f.componentRef.setInput('threshold', 5);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="threshold"]')).toBeTruthy();
  });

  it('renders at a bounded CSS pixel height (not viewBox-auto-sized)', () => {
    TestBed.configureTestingModule({ imports: [BarChartComponent] });
    const f = TestBed.createComponent(BarChartComponent);
    f.componentRef.setInput('values', [1, 2]);
    f.componentRef.setInput('height', 96);
    f.detectChanges();
    expect(f.nativeElement.querySelector('svg').style.height).toBe('96px');
  });

  it('uses the solid color input for bar fill when no colorFor is given', () => {
    TestBed.configureTestingModule({ imports: [BarChartComponent] });
    const f = TestBed.createComponent(BarChartComponent);
    f.componentRef.setInput('values', [1, 2]);
    f.componentRef.setInput('color', '#8b5cf6');
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="bar"]').getAttribute('fill')).toBe('#8b5cf6');
  });
});
