import { Injectable } from '@angular/core';
import { Campaign, isW2Forecast } from './campaign.types';

export interface BriefOptions {
  creatorCount?: number;
  /** Print "–" for conversions and cost per conversion (Twitch in the blend, non-admin viewer — LIAM-QA (a)). */
  holdTwitch?: boolean;
}

/**
 * Builds a print-ready HTML document and opens it in a new window with the
 * browser's native print dialog. Mirrors the approach in app.html:
 *   window.open() → injected HTML → window.print()
 *
 * No PDF library — browser handles "Save as PDF" via the print dialog.
 */
@Injectable({ providedIn: 'root' })
export class BriefPdfService {
  /** Renders `buildHtml(campaign, …)` and invokes print. Returns `false` if popup blocked. */
  export(campaign: Campaign, opts: BriefOptions = {}): boolean {
    const html = this.buildHtml(campaign, opts);
    const win = typeof window !== 'undefined' ? window.open('', '_blank', 'width=900,height=1100') : null;
    if (!win) return false;
    win.document.write(html);
    win.document.close();
    // Give the browser a tick to parse before triggering print.
    win.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        /* user-agent may block programmatic print; leave the tab open for manual print */
      }
    }, 250);
    return true;
  }

  /** Exposed separately so tests can assert document shape without opening a window. */
  buildHtml(campaign: Campaign, { creatorCount = 0, holdTwitch = false }: BriefOptions = {}): string {
    const f = campaign.forecast;
    const date = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });

    // A saved forecast is a record of the model that produced it (spec §8), so
    // the brief renders whichever shape was saved rather than migrating it.
    let forecastBlock: string;
    if (!f) {
      forecastBlock = '<p class="empty">No forecast attached.</p>';
    } else if (isW2Forecast(f)) {
      const t = f.totals;
      // `holdTwitch` is the caller's LIAM-QA (a) decision (core/simulation/twitch-hold.ts):
      // this service has no auth of its own, deliberately.
      const cpc = t.costPerConversion == null ? '–' : `$${t.costPerConversion.toLocaleString('en-GB')}`;
      const conv = (n: number) => holdTwitch ? '' : `${n.toLocaleString('en-GB')} conversions (upper bound)`;
      const expectedSub = holdTwitch ? '' : `${conv(t.conversions.value)} · ${cpc} per conversion`;
      forecastBlock = `
      <section class="forecast">
        <h2>Campaign forecast</h2>
        <div class="bands">
          <div class="band worst">
            <div class="label">Conservative</div>
            <div class="value">${t.band.impressions.conservative.toLocaleString('en-GB')} impressions</div>
            <div class="sub">${conv(t.band.conversions.conservative)}</div>
          </div>
          <div class="band base">
            <div class="label">Expected</div>
            <div class="value">${t.impressions.toLocaleString('en-GB')} impressions</div>
            <div class="sub">${expectedSub}</div>
          </div>
          <div class="band best">
            <div class="label">Optimistic</div>
            <div class="value">${t.band.impressions.optimistic.toLocaleString('en-GB')} impressions</div>
            <div class="sub">${conv(t.band.conversions.optimistic)}</div>
          </div>
        </div>
      </section>
    `;
    } else {
      // Legacy (pre-W2) shape. Its ROAS went 2026-09-08 — the saved JSON still
      // carries it, but ROAS left the product consistently (LIAM-QA (f)).
      forecastBlock = `
      <section class="forecast">
        <h2>Campaign forecast</h2>
        <div class="bands">
          <div class="band worst">
            <div class="label">P10 · Worst case</div>
            <div class="value">${f.p10.impressions.toLocaleString('en-GB')} impressions</div>
            <div class="sub">CTR ${f.p10.ctr}%</div>
          </div>
          <div class="band base">
            <div class="label">P50 · Base case</div>
            <div class="value">${f.p50.impressions.toLocaleString('en-GB')} impressions</div>
            <div class="sub">CTR ${f.p50.ctr}%</div>
          </div>
          <div class="band best">
            <div class="label">P90 · Best case</div>
            <div class="value">${f.p90.impressions.toLocaleString('en-GB')} impressions</div>
            <div class="sub">CTR ${f.p90.ctr}%</div>
          </div>
        </div>
      </section>
    `;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(campaign.name)} — Campaign brief</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; color: #0b1220; margin: 32px; }
    h1 { font-size: 24px; margin: 0 0 4px 0; }
    .meta-date { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
    .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 24px; margin-bottom: 24px; }
    .meta .k { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; }
    .meta .v { font-size: 14px; font-weight: 600; }
    .notes { border-top: 1px solid #e5e7eb; padding-top: 16px; margin-bottom: 24px; white-space: pre-wrap; font-size: 13px; }
    .bands { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
    .band { padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .band.worst { border-color: #e60023; }
    .band.base { border-color: #ffd400; }
    .band.best { border-color: #00c46a; }
    .band .label { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; margin-bottom: 4px; }
    .band .value { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
    .band .sub { font-size: 11px; color: #6b7280; }
    footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280; }
    @media print { body { margin: 16mm; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(campaign.name)}</h1>
  <div class="meta-date">Brief generated ${date}</div>
  <div class="meta">
    <div><div class="k">Client</div><div class="v">${escapeHtml(campaign.client || '—')}</div></div>
    <div><div class="k">Genre</div><div class="v">${escapeHtml(campaign.genre || '—')}</div></div>
    <div><div class="k">Budget</div><div class="v">${campaign.budget == null ? '—' : '$' + campaign.budget.toLocaleString('en-GB')}</div></div>
    <div><div class="k">Started</div><div class="v">${campaign.startedAt ? new Date(campaign.startedAt).toLocaleDateString() : '—'}</div></div>
    <div><div class="k">Creators</div><div class="v">${creatorCount}</div></div>
  </div>
  ${campaign.notes ? `<div class="notes">${escapeHtml(campaign.notes)}</div>` : ''}
  ${forecastBlock}
  <footer>Generated by Simfluence — simfluence.ai · Confidential, for internal use only.</footer>
</body>
</html>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
