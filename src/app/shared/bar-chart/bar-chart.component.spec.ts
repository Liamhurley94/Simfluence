import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BarChartComponent, barScale, formatCompact } from './bar-chart.component';

describe('barScale', () => {
  it('scales values to pixel heights against the max', () => {
    expect(barScale([0, 5, 10], 10, 100)).toEqual([0, 50, 100]);
  });
  it('treats a zero/undefined max as empty (no NaN)', () => {
    expect(barScale([0, 0], 0, 100)).toEqual([0, 0]);
  });
});

describe('formatCompact', () => {
  it('formats thousands/millions compactly', () => {
    expect(formatCompact(950000)).toBe('950K');
    expect(formatCompact(9500)).toBe('9.5K');
    expect(formatCompact(1000000)).toBe('1M');
    expect(formatCompact(500)).toBe('500');
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

  it('scales bars to scaleMax (the Y-axis max) instead of the data max', () => {
    TestBed.configureTestingModule({ imports: [BarChartComponent] });
    const f = TestBed.createComponent(BarChartComponent);
    f.componentRef.setInput('values', [50, 100]);
    f.componentRef.setInput('scaleMax', 100);
    f.componentRef.setInput('height', 100);
    f.detectChanges();
    const bars = f.nativeElement.querySelectorAll('[data-testid="bar"]');
    expect(bars[0].getAttribute('height')).toBe('50');
    expect(bars[1].getAttribute('height')).toBe('100');
  });

  it('shows a compact Y-axis max label when showAxis is set', () => {
    TestBed.configureTestingModule({ imports: [BarChartComponent] });
    const f = TestBed.createComponent(BarChartComponent);
    f.componentRef.setInput('values', [10]);
    f.componentRef.setInput('scaleMax', 950000);
    f.componentRef.setInput('showAxis', true);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="axis-max"]').textContent).toContain('950K');
  });

  it('shows the hovered bar value in the readout', () => {
    TestBed.configureTestingModule({ imports: [BarChartComponent] });
    const f = TestBed.createComponent(BarChartComponent);
    f.componentRef.setInput('values', [4200]);
    f.componentRef.setInput('labels', ['2026-07-10']);
    f.detectChanges();
    f.componentInstance.hovered.set(0);
    f.detectChanges();
    const readout = f.nativeElement.querySelector('[data-testid="bar-hover"]');
    expect(readout.textContent).toContain('2026-07-10');
    expect(readout.textContent).toContain('4,200');
  });
});
