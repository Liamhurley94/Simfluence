# Campaign inline simulator + forecast lock-on-active

- **Date:** 2026-07-01
- **Repo / branch:** `Simfluence` (Angular frontend) · `feature/campaign-inline-simulator` (off `develop`)
- **Status:** Approved design — ready for implementation plan
- **Driver:** "Run simulation" on a campaign opens the shared simulator empty — the campaign's creators never come with it.

---

## 1. Bug / root cause

The campaign Forecast section's **"Run simulation"** is a `routerLink="/app/simulator"` with `queryParams: { campaign: id }` (`sections/section-forecast.component.ts:20`). It *does* reach the shared simulator at `/app/simulator?campaign=<id>`.

But the simulator (`features/simulator/simulator.component.ts`):
- reads `?campaign` (`:354`) **only** to decide save behaviour in `saveToCampaigns()` (`:435`);
- sources its creator list **entirely from the global `SelectionService`** (`:369`, the Discovery shortlist);
- **never loads the campaign's creators** (those live in `CampaignCreatorsService`).

So arriving from a campaign, the selection is whatever Discovery last held — usually empty → "No creators selected" with a "Go to Discovery" CTA. The *save-back* half of "attach to campaign" was wired; the *load-in* half never was.

---

## 2. Goal

Make a campaign's forecast **its own inline simulation**, scoped to the campaign's creators — no bounce to a shared screen — and freeze it once the campaign goes live so it's a clean prediction baseline.

---

## 3. Decisions (locked)

| Decision | Choice |
|---|---|
| Placement | **Inline** in the campaign Forecast section — no navigation |
| Reuse | Extract a **full `SimulationPanelComponent`**, shared by the standalone page and the campaign |
| Save | **Explicit "Save forecast" button** — runs are what-ifs; nothing persists until Save |
| Forecast lock | Forecast is editable **only in `planning`**; read-only from `active` onward |
| Standalone sim | **Kept** for the Discovery → simulate → save-as-new-campaign flow |

**Lock rationale:** the forecast is the pre-campaign prediction. Freezing it when the campaign becomes `active` keeps it comparable against actuals logged later. The lock is **forecast-specific** — outreach + creator-status stay editable while `active` (they're used live during a campaign).

---

## 4. Design

### 4.1 `SimulationPanelComponent` (new, shared) — `shared/simulation/simulation-panel.component.ts`
The reusable guts of the simulator. Given a resolved creator set + starting params, it lets the user run what-if simulations and shows the result.
- **Owns (internal signals, seeded from inputs):** `budget`, `format`, `genre`, `objectives`, `result`.
- **Renders:** the controls (budget / format / genre / objectives), the run button + rate-limit banner, and the P10/P50/P90 bands + "Base case metrics" grid — lifted verbatim from the current simulator template, **testids preserved**.
- **Inputs:** `creators: Creator[]`, initial `budget`, initial `genre`, `genres: string[]`, `readonly: boolean` (hide controls/run, keep the last result visible).
- **Output:** `(result) => SimResult` emitted on each successful run (the parent decides what to persist).
- **Injects:** `RunSimulationService` (the server-side engine — already a service), `RateLimitService`, `AuthService` (tier).
- **Intentional behaviour change to flag:** genre is managed internally (seeded from the input), so the standalone simulator no longer writes genre back into the shared `CampaignContextService`. A what-if simulation mutating Discovery's genre was a side effect, not a feature; dropping it is correct. Call it out in the plan so the standalone spec is updated rather than surprised.

### 4.2 Standalone `/app/simulator` → thin host
Resolves creators from `SelectionService`, seeds genre from the shared context, renders `<app-simulation-panel>`. Keeps its "no creators → Go to Discovery" empty state and its **"Save to campaigns"** (create-new) behaviour on the emitted result.

### 4.3 Campaign inline simulator (Forecast section)
A new **`CampaignSimulatorComponent`** replaces `SectionForecastComponent` in the campaign detail (the old presentational forecast section is removed; the new one renders both the interactive panel and the saved-forecast summary):
- Resolves **the campaign's creators** (`CampaignCreatorsService` records → `CreatorsService.byIds`).
- Seeds **budget from `campaign.budget`**, **genre from `campaign.genre`**.
- Renders `<app-simulation-panel [readonly]="forecastLocked()">`, and keeps the saved `campaign.forecast` summary visible as the current number.
- **"Save forecast"** button (enabled when a fresh result exists; hidden when locked) → `CampaignsService.update(id, { forecast })`. Because the creators already belong to the campaign, save is just the forecast update — no `campaign_creators` writes.

### 4.4 Data flow
`campaign detail → campaign creators (already loaded) → resolve to Creator[] → panel → RunSimulationService (server) → SimResult → (Save forecast) → campaign.forecast`. The section already reads `campaign.forecast`, so the saved value persists + renders.

---

## 5. Forecast lock

- The Forecast section's read-only condition becomes **`status !== 'planning'`** (i.e. `active` / `completed` / `archived` all lock it). Previously the global `readonly` was `completed || archived`; the forecast is now stricter.
- **Unchanged:** `canStart()` (no forecast requirement added), the other sections' readonly rule, the status set. **Not in scope:** actuals logging (future — this lock is the groundwork for it).

---

## 6. Dead code (flag, remove with approval)

Once nothing links to `/app/simulator?campaign=`, the standalone simulator's `attachedCampaignId` (`:354`) and the "attach to existing campaign" branch of `saveToCampaigns()` (`:435-448`) are unreachable. Flag for removal; **keep** the "create a new campaign" branch (`:450-464`) — still reachable from the Discovery flow.

---

## 7. Testing

- **`SimulationPanelComponent` spec:** empty vs populated, controls render, run → emits `SimResult` (mocked `RunSimulationService`), rate-limit blocked/remaining, bands render from a result.
- **Campaign simulator spec:** creators sourced from the campaign, budget/genre seeded from the campaign, Save calls `CampaignsService.update` with the forecast, panel is read-only when `status !== 'planning'`.
- **Standalone simulator spec:** keep green (testids preserved through extraction); update the genre-write-back assertion per §4.1.

---

## 8. Scope / non-goals

- **In:** the campaign → inline-simulator path, the shared panel extraction, the forecast lock-on-active.
- **Out:** actuals logging, any other lifecycle/lock changes, `canStart` changes, removing the standalone simulator.

---

## 9. Acceptance criteria

1. A **planning** campaign with creators shows an inline simulator in the Forecast section, seeded with the campaign's creators + its budget/genre; **Run** produces P10/P50/P90 bands; **Save forecast** persists to `campaign.forecast`.
2. Running a campaign simulation triggers **no navigation** away from the campaign page.
3. The standalone `/app/simulator` still works from a Discovery selection and can **save a new campaign**.
4. An **`active`** (or completed/archived) campaign shows the forecast **read-only** — no run/save.
5. `ng build` + unit tests pass; no new console errors.
