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
});
