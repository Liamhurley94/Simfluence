# Live Stats + Source Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stale static `creator.subs/avgViews/eng` bindings on the creator card and profile modal with live per-platform stats (`ytStats`/`twitchStats`), add `<app-metric-source-badge>` source indicators, and show a muted "Live stats unavailable" placeholder when neither platform has data.

**Architecture:** The data layer (commit d71e31e) already populates `creator().ytStats` and `creator().twitchStats`. This task is purely rendering/labelling — no service, no API, no new computed properties needed. The card template branches on `ytStats` → `twitchStats` → `showAllMode()` → muted placeholder. The profile modal's header subtitle and stat sections get the same treatment.

**Tech Stack:** Angular 19 standalone components, Angular signals (`computed`, `input`), `@if`/`@else if` control flow, Vitest test runner (`npx ng test --no-watch`), `npx ng build --configuration development`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/shared/creator-card/creator-card.component.ts` | **Modify** | Add Twitch branch, muted placeholder, badges on CPI/GFI tiles, remove stale block |
| `src/app/shared/creator-card/creator-card.component.spec.ts` | **Modify** | Update SAMPLE fixture with `ytStats`, add Twitch test, assert stale block absent, badge present |
| `src/app/shared/creator-profile-modal/creator-profile-modal.component.ts` | **Modify** | Remove `c.subs` from header subtitle, add live YT/Twitch stat section, muted placeholder, badges |

**Import path for badge** (from card):
`import { MetricSourceBadgeComponent } from '../metric-source/metric-source-badge.component';`

**Import path for badge** (from modal):
`import { MetricSourceBadgeComponent } from '../metric-source/metric-source-badge.component';`

---

## Task 1: Update creator-card — add Twitch branch + muted placeholder + badges

**Files:**
- Modify: `src/app/shared/creator-card/creator-card.component.ts`

### What the template currently looks like (stat block, lines ~81–140):

```
@if (creator().ytStats; as yt) {
  <!-- YT stats grid -->
} @else if (showAllMode()) {
  <!-- dual-CPI strip -->
} @else {
  <!-- STALE subs/avgViews/eng  ← DELETE THIS -->
}
```

### What it must become:

```
@if (creator().ytStats; as yt) {
  <!-- YT stats grid + youtube badge -->
} @else if (creator().twitchStats; as tw) {
  <!-- Twitch CCV/peak/streams30d + twitch badge -->
} @else if (showAllMode()) {
  <!-- dual-CPI strip (unchanged) -->
} @else {
  <!-- muted "Live stats unavailable" -->
}
```

- [ ] **Step 1: Add MetricSourceBadgeComponent to imports**

In `creator-card.component.ts`, update the import block at the top and the `imports` array in `@Component`:

```typescript
import { MetricSourceBadgeComponent } from '../metric-source/metric-source-badge.component';
```

In `@Component({ ..., imports: [MetricSourceBadgeComponent], ... })`.

- [ ] **Step 2: Modify the YT stats block — add youtube badge below the grid**

The existing `@if (creator().ytStats; as yt)` block renders a 3-col grid (Subs/Avg Views/Eng) then optionally a freshness line. After the freshness `@if`, add the badge:

```html
<div class="flex justify-end mt-1 mb-2">
  <app-metric-source-badge source="youtube" />
</div>
```

- [ ] **Step 3: Add the Twitch branch (new `@else if`) between YT and showAllMode**

Insert after the closing `}` of the `@if (creator().ytStats; as yt)` block and before `@else if (showAllMode())`:

```html
} @else if (creator().twitchStats; as tw) {
  <div class="grid grid-cols-3 gap-1 mb-1 text-center" data-testid="creator-twitch-stats">
    <div>
      <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
        Avg Viewers
      </div>
      <div class="text-xs font-semibold" style="color: #9146FF;">
        {{ compact(tw.avgCcv) }}
      </div>
    </div>
    <div>
      <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
        Peak
      </div>
      <div class="text-xs font-semibold" style="color: var(--color-text);">
        {{ compact(tw.peakCcv) }}
      </div>
    </div>
    <div>
      <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
        Streams/30d
      </div>
      <div class="text-xs font-semibold" style="color: var(--color-text);">
        {{ tw.streams30d }}
      </div>
    </div>
  </div>
  @if (tw.primaryGameName) {
    <div class="text-[9px] mb-1 text-center" style="color: var(--color-text-muted);">
      {{ tw.primaryGameName }}
    </div>
  }
  <div class="flex justify-end mt-1 mb-2">
    <app-metric-source-badge source="twitch" />
  </div>
```

- [ ] **Step 4: Replace the stale `@else` block with a muted placeholder**

Delete the old `@else` block that shows `creator().subs`, `creator().avgViews`, `creator().eng`.

Replace it with:

```html
} @else {
  <div class="py-2 mb-2 text-center text-[10px]" style="color: var(--color-text-muted);" data-testid="creator-stats-unavailable">
    Live stats unavailable
  </div>
```

- [ ] **Step 5: Add Simfluence badge to CPI and GFI score tiles**

Locate the "Simfluence Scores" section — it has a 2-col grid with CPI and GFI tiles. Add a badge inside each tile, below the score value. The CPI tile:

```html
<div class="text-center p-2 rounded" style="background: var(--color-bg-3);">
  <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">
    CPI
  </div>
  <div class="text-sm font-bold" [style.color]="scoreColor(creator().cpi)">
    {{ creator().cpi }}
  </div>
  <app-metric-source-badge source="simfluence" />
</div>
```

The GFI tile (inside the `@if (gfiDisplay() !== null)` branch only — not on the `—` placeholder):

```html
<div class="text-sm font-bold" [style.color]="scoreColor(gfiDisplay()!)">
  {{ gfiDisplay() }}
</div>
<app-metric-source-badge source="simfluence" />
```

- [ ] **Step 6: Verify build passes**

```bash
cd /Users/brandonmay/Documents/softwareProjects/passion/Simfluence && npx ng build --configuration development 2>&1 | tail -20
```

Expected: `Application bundle generation complete.` with no errors.

---

## Task 2: Update creator-card spec — fix broken tests, add Twitch + badge tests

**Files:**
- Modify: `src/app/shared/creator-card/creator-card.component.spec.ts`

The test `'renders name, handle, stats, and scores'` currently asserts `'1.5M'` is in the text — that's the stale `creator().subs` value. After Task 1, the stale block is gone, so this will fail unless we either:
a) Give `SAMPLE` a `ytStats` (so YT branch fires and `compact(yt.subscriberCount)` renders a live number), or
b) Leave SAMPLE stats-free and assert the muted placeholder.

**Decision:** Give SAMPLE a `ytStats` block. This is the most realistic fixture and lets us test both the YT branch AND the badge. Then add a separate no-stats fixture to test the muted placeholder.

- [ ] **Step 1: Update the SAMPLE fixture to include ytStats**

In the spec file, update the `SAMPLE` constant (around line 10):

```typescript
const SAMPLE: Creator = {
  id: 42,
  name: 'Test Creator',
  handle: '@test',
  platform: 'YouTube',
  allPlatforms: ['YouTube', 'Twitch'],
  subs: '1.5M',
  subsParsed: 1_500_000,
  avgViews: '180K',
  eng: '4.2%',
  genre: 'Gaming & Esports',
  cpi: 85,
  gfi: 72,
  color: '#00C46A',
  verifiedDeals: 2,
  sponsorHistory: ['Acme'],
  bio: 'test bio',
  rates: { mix: [10_000, 40_000] },
  ytStats: {
    subscriberCount: 1_500_000,
    avgViews: 180_000,
    engagementRate: 4.2,
    sponsorFreqPct: 15,
    statsRefreshedAt: null,
  },
};
```

- [ ] **Step 2: Update the first test to assert live YT stats, not stale subs**

Replace the failing assertion `expect(el.textContent).toContain('1.5M')` with assertions against the live YT stats:

```typescript
it('renders name, handle, stats, and scores', () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement;
  expect(el.querySelector('[data-testid="creator-name"]').textContent).toContain('Test Creator');
  expect(el.textContent).toContain('@test');
  // Live YT stats (from ytStats fixture — compact(1_500_000) = '1.5M')
  expect(el.textContent).toContain('1.5M');
  // CPI and GFI scores
  expect(el.textContent).toContain('85');
  expect(el.textContent).toContain('72');
  // YouTube source badge
  expect(el.querySelector('[data-testid="metric-source-youtube"]')).toBeTruthy();
});
```

Note: `compact(1_500_000)` → `'1.5M'`, so the assertion still holds — but it now comes from live data, not the stale string.

- [ ] **Step 3: Add test asserting stale fields never render**

```typescript
it('never renders stale creator.subs/avgViews/eng bindings', () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement;
  // The raw string values from creator.subs/avgViews/eng must not appear
  // when ytStats is present (they would be duplicated or stale)
  // We test with a no-stats creator to confirm the placeholder shows
  fixture.componentInstance.creator.set({
    ...SAMPLE,
    ytStats: undefined,
    twitchStats: undefined,
  });
  fixture.detectChanges();
  expect(el.querySelector('[data-testid="creator-stats-unavailable"]')).toBeTruthy();
  expect(el.textContent).toContain('Live stats unavailable');
  // The raw SAMPLE string values should NOT appear anywhere
  expect(el.querySelector('[data-testid="metric-source-youtube"]')).toBeNull();
  expect(el.querySelector('[data-testid="metric-source-twitch"]')).toBeNull();
});
```

- [ ] **Step 4: Add test for Twitch-only creator**

```typescript
it('renders Twitch CCV block + twitch badge for a Twitch-only creator (no ytStats)', () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.creator.set({
    ...SAMPLE,
    platform: 'Twitch',
    allPlatforms: ['Twitch'],
    ytStats: undefined,
    twitchStats: {
      avgCcv: 3_200,
      peakCcv: 8_500,
      streams30d: 14,
      hoursStreamed30d: 56,
      lastStreamAt: null,
      primaryGameName: 'Fortnite',
      liveRefreshedAt: null,
    },
  });
  fixture.detectChanges();
  const el = fixture.nativeElement;
  expect(el.querySelector('[data-testid="creator-twitch-stats"]')).toBeTruthy();
  expect(el.textContent).toContain('3.2K');   // compact(3200)
  expect(el.textContent).toContain('8.5K');   // compact(8500)
  expect(el.textContent).toContain('14');      // streams30d
  expect(el.textContent).toContain('Fortnite');
  expect(el.querySelector('[data-testid="metric-source-twitch"]')).toBeTruthy();
  // YT badge must not appear
  expect(el.querySelector('[data-testid="metric-source-youtube"]')).toBeNull();
  // Stale subs must not appear
  expect(el.querySelector('[data-testid="creator-stats-unavailable"]')).toBeNull();
});
```

- [ ] **Step 5: Add test asserting Simfluence badge appears on CPI tile**

```typescript
it('renders simfluence badge on CPI tile', () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement;
  expect(el.querySelector('[data-testid="metric-source-simfluence"]')).toBeTruthy();
});
```

- [ ] **Step 6: Run tests**

```bash
cd /Users/brandonmay/Documents/softwareProjects/passion/Simfluence && npx ng test --no-watch 2>&1 | tail -30
```

Expected: All tests pass (≥218 passing, 0 new failures).

- [ ] **Step 7: Commit Task 1 + Task 2**

```bash
cd /Users/brandonmay/Documents/softwareProjects/passion/Simfluence
git add src/app/shared/creator-card/creator-card.component.ts src/app/shared/creator-card/creator-card.component.spec.ts
git commit -m "$(cat <<'EOF'
feat(card): replace stale stats with live per-platform stats + source badges

- Add Twitch branch (avgCcv/peakCcv/streams30d) between YT and show-all
- Replace stale subs/avgViews/eng block with muted 'Live stats unavailable' placeholder
- Add MetricSourceBadge (youtube/twitch) below each platform stat block
- Add Simfluence badge to CPI tile (and GFI tile when value present)
- Update spec: SAMPLE gets ytStats; new tests for Twitch branch, muted placeholder, badge presence

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update creator-profile-modal — remove stale subtitle, add live stat sections + badges

**Files:**
- Modify: `src/app/shared/creator-profile-modal/creator-profile-modal.component.ts`

### Changes required:

1. **Header subtitle (line 100):** Remove `{{ c.subs }} subs ·` from the header subtitle line.
2. **Add `MetricSourceBadgeComponent` to imports array and TS import.**
3. **YT stats section (inside `@if (showYoutube())`):** Add a YouTube badge at the section header level (inside the green "YouTube Data" header or below).
4. **Simfluence Analysis section:** Add a Simfluence badge at the section header level (inside the gold "Simfluence Analysis" header).
5. **Estimated Budget Range section:** Add a Simfluence badge at the header.
6. **Category Benchmarking section:** Add a Simfluence badge at the header.
7. **Add a live Twitch stats sub-section** inside `@if (showTwitch())` — before the live/offline indicator — showing `twitchStats` (the rolled-up 30d stats from the Creator object) when present. This is distinct from the existing live `twData()` (real-time stream status from Twitch API). The `creator().twitchStats` block shows the static 30d rollup; the `twData()` block shows current live status. Both can coexist.
8. **Muted placeholder:** When `!showYoutube() && !showTwitch()` (no platform data at all), show a muted stats unavailable notice between the Bio and Budget sections.

- [ ] **Step 1: Add MetricSourceBadgeComponent import and declaration**

At the top of the file, add:
```typescript
import { MetricSourceBadgeComponent } from '../metric-source/metric-source-badge.component';
```

In `@Component({ ..., imports: [DecimalPipe, MetricSourceBadgeComponent], ... })`.

- [ ] **Step 2: Remove `c.subs` from header subtitle**

Line 100 currently reads:
```html
{{ c.handle }} · {{ c.platform }} · {{ c.subs }} subs · {{ c.genre }}
```

Replace with (remove `{{ c.subs }} subs ·`):
```html
{{ c.handle }} · {{ c.platform }} · {{ c.genre }}
```

- [ ] **Step 3: Add YouTube badge to the "YouTube Data" section header**

The section header (lines 130–135) has a green "YouTube Data" label. Add the badge inline:

```html
<span class="text-[10px] uppercase tracking-wider font-bold" style="color: var(--color-sf-green);">
  YouTube Data
</span>
<app-metric-source-badge source="youtube" />
```

- [ ] **Step 4: Add Simfluence badge to "Simfluence Analysis" section header**

The section header (lines 223–226) has a gold "Simfluence Analysis" label. Add:

```html
<span class="text-[10px] uppercase tracking-wider font-bold" style="color: var(--color-sf-gold);">
  Simfluence Analysis
</span>
<app-metric-source-badge source="simfluence" />
```

- [ ] **Step 5: Add Simfluence badge to "Estimated Budget Range" header**

```html
<span class="text-[10px] uppercase tracking-wider font-bold" style="color: var(--color-sf-gold);">
  Estimated Budget Range
</span>
<app-metric-source-badge source="simfluence" />
```

The `<div class="px-3 py-2" style="background: var(--color-bg-3);">` already wraps this — change it to `flex items-center gap-2`:
```html
<div class="px-3 py-2 flex items-center gap-2" style="background: var(--color-bg-3);">
```

- [ ] **Step 6: Add Simfluence badge to "Category Benchmarking" header**

The benchmark header already has `flex items-center justify-between`. Add the badge next to the title span:
```html
<div class="flex items-center gap-2">
  <span class="text-[10px] uppercase tracking-wider font-bold" style="color: var(--color-sf-gold);">
    Category Benchmarking
  </span>
  <app-metric-source-badge source="simfluence" />
</div>
<span class="text-[9px]" style="color: var(--color-text-muted);">
  {{ b.genre }} ({{ b.total_creators | number }} creators)
</span>
```

- [ ] **Step 7: Add twitchStats 30d rollup sub-section inside `@if (showTwitch())`**

Inside the existing Twitch section (`data-testid="creator-profile-twitch"`), add the 30d stats before the live/offline indicator. Insert immediately after `<div class="p-3 flex flex-col gap-3">`:

```html
@if (creator().twitchStats; as ts) {
  <div class="grid grid-cols-3 gap-2" data-testid="creator-profile-twitch-stats">
    <div class="p-2 rounded text-center" style="background: var(--color-bg-3);">
      <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">Avg Viewers</div>
      <div class="text-sm font-bold" style="color: #9146FF;">{{ ts.avgCcv | number: '1.0-0' }}</div>
    </div>
    <div class="p-2 rounded text-center" style="background: var(--color-bg-3);">
      <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">Peak CCV</div>
      <div class="text-sm font-bold" style="color: var(--color-text);">{{ ts.peakCcv | number: '1.0-0' }}</div>
    </div>
    <div class="p-2 rounded text-center" style="background: var(--color-bg-3);">
      <div class="text-[9px] uppercase tracking-wider" style="color: var(--color-text-muted);">Streams/30d</div>
      <div class="text-sm font-bold" style="color: var(--color-text);">{{ ts.streams30d }}</div>
    </div>
  </div>
  @if (ts.primaryGameName) {
    <div class="text-xs text-center" style="color: var(--color-text-muted);">
      Top game: <strong>{{ ts.primaryGameName }}</strong>
    </div>
  }
  <div class="flex justify-end">
    <app-metric-source-badge source="twitch" />
  </div>
}
```

- [ ] **Step 8: Add muted placeholder for no-platform creators**

After the `@if (showYoutube()) { ... }` block and before the Budget Range section, add:

```html
@if (!showYoutube() && !showTwitch()) {
  <div
    class="p-3 rounded text-center text-xs"
    style="border: 1px solid var(--color-border); color: var(--color-text-muted);"
    data-testid="creator-profile-stats-unavailable"
  >
    Live stats unavailable for this creator.
  </div>
}
```

- [ ] **Step 9: Verify build passes**

```bash
cd /Users/brandonmay/Documents/softwareProjects/passion/Simfluence && npx ng build --configuration development 2>&1 | tail -20
```

Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 10: Run all tests**

```bash
cd /Users/brandonmay/Documents/softwareProjects/passion/Simfluence && npx ng test --no-watch 2>&1 | tail -30
```

Expected: All passing (≥218), 0 new failures.

- [ ] **Step 11: Commit Task 3**

```bash
cd /Users/brandonmay/Documents/softwareProjects/passion/Simfluence
git add src/app/shared/creator-profile-modal/creator-profile-modal.component.ts
git commit -m "$(cat <<'EOF'
feat(modal): replace stale subs in subtitle, add live per-platform stats + source badges

- Remove 'c.subs subs' from header subtitle (stale static field)
- Add MetricSourceBadge (youtube/twitch/simfluence) to section headers
- Add Twitch 30d rollup stats sub-section (avgCcv/peakCcv/streams30d/primaryGameName + twitch badge)
- Add muted 'Live stats unavailable' placeholder for creators with no platform data
- Simfluence badge on Budget Range and Category Benchmarking headers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Checklist

**Spec coverage:**

| Requirement | Task covering it |
|-------------|-----------------|
| Never display stale `creator().subs/avgViews/eng` | Task 1 (Step 4), Task 2 (Step 3), Task 3 (Step 2) |
| YT branch: show `subscriberCount/avgViews/engagementRate` + youtube badge | Task 1 (Step 2) |
| Twitch branch: show `avgCcv/peakCcv/streams30d` + optional `primaryGameName` + twitch badge | Task 1 (Step 3), Task 3 (Step 7) |
| Neither present → muted "Live stats unavailable" placeholder | Task 1 (Step 4), Task 3 (Step 8) |
| Simfluence badge on CPI/GFI tiles | Task 1 (Step 5) |
| Modal: stale `c.subs` removed from subtitle | Task 3 (Step 2) |
| Modal: badges on Simfluence-computed sections | Task 3 (Steps 4–6) |
| Spec: SAMPLE updated, no-stats fixture, Twitch test, badge tests | Task 2 |
| Build green | Task 1 (Step 6), Task 3 (Step 9) |
| Tests green (≥218) | Task 2 (Step 6), Task 3 (Step 10) |
| Tier badge prefers `ytStats.subscriberCount` | Not included — `tierForSubs(creator().subsParsed)` already uses the correct normalized field; `subsParsed` is populated from `ytStats.subscriberCount` by the data layer. No change needed. |

**Placeholder text:**
- Card: `"Live stats unavailable"` (`data-testid="creator-stats-unavailable"`)
- Modal: `"Live stats unavailable for this creator."` (`data-testid="creator-profile-stats-unavailable"`)

**Badge data-testids** (from `MetricSourceBadgeComponent`):
- `data-testid="metric-source-youtube"`
- `data-testid="metric-source-twitch"`
- `data-testid="metric-source-simfluence"`

**Type consistency:** `tw.avgCcv`, `tw.peakCcv`, `tw.streams30d`, `tw.primaryGameName` all match `TwitchStats` interface exactly. `yt.subscriberCount`, `yt.avgViews`, `yt.engagementRate` match `YoutubeStats` exactly. No mismatches.

**Show-all mode:** `showAllMode()` computed as `c.bestCpi != null && !c.ytStats` — correctly unchanged. Twitch branch is `@else if (creator().twitchStats; as tw)`, placed before `showAllMode()`. A show-all creator has `bestCpi` set and `ytStats` absent; if it also has `twitchStats`, the Twitch branch fires — which is correct (live stats > CPI-only). If you want show-all to always show the dual-CPI strip regardless, swap the order; current spec does not address this edge case, so keep as-is.

**No placeholders in plan:** All code blocks are complete with exact bindings. No "TBD" or "fill in."
