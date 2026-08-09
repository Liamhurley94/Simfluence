import { Component, computed, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SourceZoneHeaderComponent } from '../compliance/source-zone-header.component';
import { ProprietaryNoteComponent } from '../compliance/proprietary-note.component';
import { Creator } from '../../core/data/creator.types';
import { SimCreatorBand, SimCreatorBreakdown } from '../../core/simulation/simulation.types';

interface BreakdownRow {
  key: number;
  name: string;
  handle: string;
  platform: string;
  cpi: number | null;
  b: SimCreatorBreakdown;
}

/**
 * Per-creator forecast table. Every number here is computed by the
 * `run-simulation` edge function and simply rendered – no forecast math runs in
 * the browser. Rows collapse to one line and expand to the creator's P10 / P50 /
 * P90 confidence bands plus their budget range per sponsorship format.
 *
 * Displays Creator Performance Index (CPI) and Genre Fit Index (GFI), both
 * Simfluence-derived, so it carries the YouTube III.E.4h source header and
 * proprietary-metric note (see docs/compliance/README.md).
 */
@Component({
  selector: 'app-sim-creator-breakdown',
  standalone: true,
  imports: [DecimalPipe, SourceZoneHeaderComponent, ProprietaryNoteComponent],
  template: `
    <div class="sf-card overflow-hidden mt-6" data-testid="sim-breakdown">
      <div
        class="px-4 py-3 flex items-center justify-between"
        style="background: var(--color-bg-3); border-bottom: 1px solid var(--color-border);"
      >
        <div class="text-[10px] uppercase tracking-wider font-semibold" style="color: var(--color-text);">
          Per-creator forecast
        </div>
        <app-source-zone-header source="simfluence" />
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-xs" style="border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid var(--color-border);">
              <th class="text-left px-4 py-2 text-[9px] uppercase tracking-wider font-semibold" style="color: var(--color-text-muted);">Creator</th>
              <th class="text-right px-2 py-2 text-[9px] uppercase tracking-wider font-semibold" style="color: var(--color-text-muted);">CPI</th>
              <th class="text-right px-2 py-2 text-[9px] uppercase tracking-wider font-semibold" style="color: var(--color-text-muted);">GFI</th>
              <th class="text-right px-2 py-2 text-[9px] uppercase tracking-wider font-semibold" style="color: var(--color-text-muted);">Share</th>
              <th class="text-right px-2 py-2 text-[9px] uppercase tracking-wider font-semibold" style="color: var(--color-text-muted);">Impressions</th>
              <th class="text-right px-2 py-2 text-[9px] uppercase tracking-wider font-semibold" style="color: var(--color-text-muted);">CTR</th>
              <th class="text-right px-2 py-2 text-[9px] uppercase tracking-wider font-semibold" style="color: var(--color-text-muted);">Clicks</th>
              <th class="text-right px-2 py-2 text-[9px] uppercase tracking-wider font-semibold" style="color: var(--color-text-muted);">Conv.</th>
              <th class="text-right px-4 py-2 text-[9px] uppercase tracking-wider font-semibold" style="color: var(--color-text-muted);">ROAS</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.key) {
              <tr
                (click)="toggle(row.key)"
                class="cursor-pointer"
                style="border-bottom: 1px solid var(--color-border);"
                data-testid="sim-breakdown-row"
              >
                <td class="px-4 py-2" style="color: var(--color-text);">
                  <span style="color: var(--color-text-muted);">{{ expanded() === row.key ? '▾' : '▸' }}</span>
                  {{ row.name }}
                  <span class="text-[10px]" style="color: var(--color-text-muted);">{{ row.handle }}</span>
                </td>
                <td class="text-right px-2 py-2" style="color: var(--color-text);">{{ row.cpi ?? '–' }}</td>
                <td class="text-right px-2 py-2" style="color: var(--color-text);">{{ row.b.gfi }}%</td>
                <td class="text-right px-2 py-2" style="color: var(--color-sf-gold);">\${{ row.b.budgetShare | number: '1.0-0' }}</td>
                <td class="text-right px-2 py-2" style="color: var(--color-text);">{{ row.b.impressions | number: '1.0-0' }}</td>
                <td class="text-right px-2 py-2" style="color: var(--color-text);">{{ row.b.ctr }}%</td>
                <td class="text-right px-2 py-2" style="color: var(--color-text);">{{ row.b.clicks | number: '1.0-0' }}</td>
                <td class="text-right px-2 py-2" style="color: var(--color-text);">{{ row.b.conversions | number: '1.0-0' }}</td>
                <td class="text-right px-4 py-2" style="color: var(--color-sf-gold);">{{ row.b.roas }}×</td>
              </tr>
              @if (expanded() === row.key) {
                <tr data-testid="sim-breakdown-detail" style="border-bottom: 1px solid var(--color-border);">
                  <td colspan="9" class="px-4 py-3" style="background: var(--color-bg-3);">
                    <table class="w-full text-[11px]">
                      @for (band of bandsOf(row.b); track band.label) {
                        <tr>
                          <td class="py-0.5 pr-4 font-semibold" [style.color]="band.color">{{ band.label }}</td>
                          <td class="py-0.5 pr-4 text-right" style="color: var(--color-text);">{{ band.v.impr | number: '1.0-0' }} impr</td>
                          <td class="py-0.5 pr-4 text-right" style="color: var(--color-text);">{{ band.v.ctr }}% CTR</td>
                          <td class="py-0.5 pr-4 text-right" style="color: var(--color-text);">{{ band.v.clicks | number: '1.0-0' }} clicks</td>
                          <td class="py-0.5 pr-4 text-right" style="color: var(--color-text);">{{ band.v.conv | number: '1.0-0' }} conv</td>
                          <td class="py-0.5 text-right" style="color: var(--color-text);">{{ band.v.roas }}× ROAS</td>
                        </tr>
                      }
                    </table>
                    <div class="mt-2 text-[10px]" style="color: var(--color-text-muted);">
                      Budget range –
                      Integrated \${{ row.b.rates.int[0] | number: '1.0-0' }}–\${{ row.b.rates.int[1] | number: '1.0-0' }} ·
                      Mixed \${{ row.b.rates.mix[0] | number: '1.0-0' }}–\${{ row.b.rates.mix[1] | number: '1.0-0' }} ·
                      Dedicated \${{ row.b.rates.ded[0] | number: '1.0-0' }}–\${{ row.b.rates.ded[1] | number: '1.0-0' }}
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <div class="px-4 py-2" style="border-top: 1px solid var(--color-border);">
        <app-proprietary-note />
      </div>
    </div>
  `,
})
export class SimCreatorBreakdownComponent {
  readonly breakdowns = input.required<SimCreatorBreakdown[]>();
  readonly creators = input.required<Creator[]>();

  /** Creator id of the currently expanded row, or null. One at a time. */
  protected readonly expanded = signal<number | null>(null);

  protected readonly rows = computed<BreakdownRow[]>(() => {
    const byId = new Map(this.creators().map((c) => [c.id, c]));
    return this.breakdowns().map((b) => {
      // The edge function echoes back the id the payload sent, which is a
      // string – Creator.id is numeric, so normalize before the lookup.
      const key = Number(b.id);
      const c = byId.get(key);
      return {
        key,
        name: c?.name ?? `#${key}`,
        handle: c?.handle ?? '',
        platform: c?.platform ?? '',
        cpi: c?.cpi ?? null,
        b,
      };
    });
  });

  protected bandsOf(b: SimCreatorBreakdown): Array<{ label: string; v: SimCreatorBand; color: string }> {
    return [
      { label: 'P10', v: b.p10, color: 'var(--color-sf-red)' },
      { label: 'P50', v: b.p50, color: 'var(--color-sf-gold)' },
      { label: 'P90', v: b.p90, color: 'var(--color-sf-green)' },
    ];
  }

  protected toggle(key: number): void {
    this.expanded.update((cur) => (cur === key ? null : key));
  }
}
