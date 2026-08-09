import { Component, computed, input } from '@angular/core';
import { SimResult } from '../../core/simulation/simulation.types';

interface BenchmarkCell {
  label: string;
  actual: string;
  benchmark: string;
}

/**
 * Forecast rates against their genre benchmark. Every value here is already in
 * the `run-simulation` response – this is the only surface that renders
 * `bench` and `engRate` at all.
 */
@Component({
  selector: 'app-sim-benchmark-panel',
  standalone: true,
  template: `
    <div class="sf-card overflow-hidden mt-6" data-testid="sim-benchmark">
      <div
        class="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold"
        style="background: var(--color-bg-3); color: var(--color-text); border-bottom: 1px solid var(--color-border);"
      >
        Industry benchmark comparison
      </div>
      <div class="grid grid-cols-4">
        @for (cell of cells(); track cell.label) {
          <div class="p-4 text-center" style="border-right: 1px solid var(--color-border);">
            <div class="text-[10px] uppercase tracking-wider" style="color: var(--color-text-muted);">
              {{ cell.label }}
            </div>
            <div class="text-lg font-bold" style="color: var(--color-sf-gold);">{{ cell.actual }}</div>
            <div class="text-[10px]" style="color: var(--color-text-muted);">
              vs {{ cell.benchmark }} genre average
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class SimBenchmarkPanelComponent {
  readonly result = input.required<SimResult>();

  protected readonly cells = computed<BenchmarkCell[]>(() => {
    const r = this.result();
    return [
      { label: 'CTR', actual: `${r.ctr}%`, benchmark: `${r.bench.ctrBase}%` },
      { label: 'ROAS', actual: `${r.roas}×`, benchmark: `${r.bench.roasBase}×` },
      { label: 'CVR', actual: `${r.cvr}%`, benchmark: `${r.bench.cvrBase}%` },
      { label: 'Engagement', actual: `${r.engRate}%`, benchmark: `${r.bench.engBase}%` },
    ];
  });
}
