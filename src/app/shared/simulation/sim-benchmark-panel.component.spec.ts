import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { SimBenchmarkPanelComponent } from './sim-benchmark-panel.component';
import { SimResult } from '../../core/simulation/simulation.types';

const RESULT = { impressions: 100, ctr: 2.9, cpM: 6, cvr: 0.5, conversions: 1, roas: 1.4,
  roasP10: 0.6, roasP50: 1.4, roasP90: 2.9, roasRange: '0.6×–2.9×', engRate: 5.1, clicks: 2,
  budget: 85_000, aov: 30, durationWeeks: 4, reachableCount: 1,
  bench: { ctrBase: 2.4, cpmBase: 8, cvrBase: 0.35, roasBase: 1.2, engBase: 4.2 },
  p10: { impressions: 68, ctr: 2, roas: 0.6 }, p50: { impressions: 100, ctr: 2.9, roas: 1.4 },
  p90: { impressions: 142, ctr: 4.1, roas: 2.9 } } as SimResult;

@Component({
  standalone: true, imports: [SimBenchmarkPanelComponent],
  template: `<app-sim-benchmark-panel [result]="result()" />`,
})
class Host { result = signal<SimResult>(RESULT); }

describe('SimBenchmarkPanelComponent', () => {
  it('shows each forecast rate against its genre benchmark', () => {
    TestBed.resetTestingModule();
    const f = TestBed.createComponent(Host); f.detectChanges();
    const text = f.nativeElement.querySelector('[data-testid="sim-benchmark"]').textContent;
    expect(text).toContain('2.9%');    // forecast CTR
    expect(text).toContain('2.4%');    // benchmark CTR
    expect(text).toContain('5.1%');    // engagement rate – rendered nowhere else
    expect(text).toContain('4.2%');    // benchmark engagement
  });
});
