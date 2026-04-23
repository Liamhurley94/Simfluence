# Simfluence

Influencer campaign forecasting SaaS. Users build a creator shortlist, input a brief (budget, duration, platform mix), and receive probabilistic campaign forecasts (CTR, CPM, CVR, ROAS with P10/P50/P90 bands). Six subscription tiers (free → diamond) gate features.

---

## Stack

| Concern   | Choice                                                    |
| --------- | --------------------------------------------------------- |
| Framework | **Angular 21** — standalone components, signals, zoneless |
| Routing   | `@angular/router` with lazy feature routes                |
| State     | Angular signals + services (no NgRx)                      |
| Forms     | Reactive forms                                            |
| HTTP      | `HttpClient` + functional interceptor                     |
| Styling   | Tailwind 4 (CSS-first `@theme` + custom variables)        |
| Testing   | **Vitest** (Angular 21 native) + jsdom                    |
| E2E       | Playwright (wired at cutover prep)                        |
| Supabase  | `@supabase/supabase-js` (browser client, framework-neutral) |

## Backend integration

- **Supabase** provides Auth + existing Edge Functions (`score-creator`, `run-simulation`, `youtube-creator-data`, `twitch-live-status`, `validate-password`).
- **No new backend work in this repo.** Database tables and RLS policies for campaigns / outreach / creator storage will live in a **separate backend repo** managed independently. Client-side repository interfaces (`CampaignsRepository`, `OutreachRepository`) are wired with in-memory stubs; swapping in a real implementation is a one-line DI change in `app.config.ts`.

---

## Project layout

```
src/app/
  core/                # App-wide singletons — providedIn: 'root'
    api/               # EdgeClient, RestClient (typed Supabase wrappers)
    auth/              # AuthService, interceptor, guard, tier guard
    context/           # CampaignContextService — shared genre / subMode
    creators/          # CreatorsService (in-memory filter/sort)
    data/              # Typed constants + JSON data bundled at build time
    personas/          # PersonasService (listFor, autoSelect)
    score/             # ScoreCreatorService (score-creator edge fn + caches)
    selection/         # SelectionService (shared creator selection Set)
    storage/           # StorageService (localStorage → sessionStorage → memory)
    supabase/          # SupabaseService (session/user signals)
    theme/             # ThemeService (dark/light, body.light class)
    types/             # Tier union + tierRank()
    upgrade/           # UpgradePromptService (tier-lock overlay state)
  shared/              # Reusable UI — no feature dependencies
    creator-card/
    filter-panel/
    pagination/
    ui/upgrade-prompt/
  features/            # Pages; each loaded lazily at /app/<feature>
    auth/              # SIGN UP / SIGN IN / recover
    shell/             # MainShell + TopNav + SideNav + ProfileDropdown
    dashboard/ discovery/ scoring/ personas/ simulator/ campaigns/ outreach/
  environments/        # environment.ts + environment.prod.ts (Supabase config)

scripts/
  extract-data.mjs     # One-shot extractor from reference/app.html → JSON

reference/             # Legacy HTML app (source of truth for data + behavior).
                       # Deleted at cutover.
```

## Data model

The **source of truth** for creator data, rate tables, and persona definitions is currently `reference/app.html`. The extraction script pulls it into typed JSON.

- **`creators.data.json`** — 6233 creators. Typed via `Creator` in `core/data/creator.types.ts`.
- **`cpm-tables.data.ts`** — `NICHE_SPONSOR_CPM`, `DEFAULT_CPM`, `PLATFORM_MULT`.
- **`personas.data.json`** — 12 genres, 48 personas. Typed via `Persona` in `core/data/persona.types.ts`.

When `reference/app.html` changes:

```bash
node scripts/extract-data.mjs
```

All three data files regenerate. The service layer imports them directly — no runtime fetching.

## Edge function surface

| Endpoint                            | Used by              | Wrapper                        |
| ----------------------------------- | -------------------- | ------------------------------ |
| `POST /functions/v1/score-creator`  | Scoring              | `ScoreCreatorService`          |
| `POST /functions/v1/run-simulation` | Simulator            | *(Phase 6)*                    |
| `POST /functions/v1/youtube-creator-data` | Discovery enrichment | *(Phase 3.5)*            |
| `GET  /functions/v1/twitch-live-status`   | Discovery enrichment | *(Phase 3.5)*            |
| `POST /functions/v1/validate-password`    | Auth                 | *(not currently used)*   |

The `authInterceptor` attaches a `Bearer <jwt>` + `apikey` header to every request hitting the Supabase origin; falls back to the anon key when no user session exists (matching the edge functions' own auth behavior).

---

## Branching & deploy

- **`develop` is an orphan branch** — no shared history with the legacy `main` (the old HTML monolith). Work happens here.
- **`reference/` holds `app.html` + the three static marketing pages**. Used during development for reference lookups and data extraction; deleted at cutover.
- **Promotion to `main`** is owner-driven. When the Angular app is ready, `develop` gets promoted; old history is pruned. Mechanics are out of scope for this codebase.
- **Deploy target**: Netlify static host. Angular builds to `dist/simfluence/browser/`.

---

## Environment

`src/environments/environment.ts` holds Supabase project URL + anon key. **The anon key is designed to be public** — Supabase's security model puts real protection in RLS policies, not in hiding the anon key. Do not rotate it "for safety"; do not move it to process env.

Same values apply in `environment.prod.ts` for now (single Supabase project for dev + prod).

---

## Dev

```bash
npm install
npm start                 # ng serve → http://localhost:4200
npm test                  # vitest, runs once
npx ng build              # production build → dist/simfluence/
node scripts/extract-data.mjs  # refresh creators + cpm + personas from reference/app.html
```

---

## Testing strategy

- **Unit tests** live next to code (`*.spec.ts`). Vitest + Angular TestBed. Use signals (not plain class properties) in host components for signal-input bindings under zoneless.
- **Services**: mock HTTP via `EdgeClient` / `SupabaseService` stubs; assert payload shape + response handling + cache behavior.
- **Components**: interaction tests through `data-testid` selectors; keep tests resilient to markup tweaks.
- **Coverage target**: ≥80% for `core/`, ≥70% for components. Enforced by convention, not tooling.
- **E2E** (Playwright) lands at cutover prep — smoke covering the full auth → discovery → score → simulate → save → outreach flow.

### Known zoneless gotchas

- Tests binding to `input()` signal inputs need the host's backing state to be a `signal<T>`, not a plain class property — otherwise `ExpressionChangedAfterItHasBeenCheckedError`.
- Templates reading from signals auto-track; templates reading plain properties don't trigger change detection.
- Supabase `onAuthStateChange` callbacks can fire outside Angular's awareness under zoneless — signals in `SupabaseService` handle this without `NgZone.run`.

---

## Phase log

Append one entry per phase. Keep it one or two lines — details belong in commit messages.

- **Phase 0** — Angular 21 scaffold, Tailwind 4, Vitest, Supabase client, core services (auth/storage/theme/interceptor/guards/api clients), feature route placeholders.
- **Phase 1** — Auth shell with SIGN UP / SIGN IN / recover tabs, `AuthService` backed by `@supabase/supabase-js`, profile lookup from `profiles` table, session rehydration on boot.
- **Phase 2** — Main shell (`TopNav` + `SideNav` + `ProfileDropdown`), theme toggle, `UpgradePromptService` + overlay; tier-locked sidebar tabs open the overlay inline, `?upgrade=<tier>` query param also triggers it (defense in depth with `tierGuard`).
- **Phase 3** — Discovery: 6233 creators extracted from `app.html` → `creators.data.json`, `CreatorsService` (filter/sort/paginate), `SelectionService`, `FilterPanelComponent`, `CreatorCardComponent`, `PaginationComponent`. Discovery page orchestrates; rate column blurred for sub-silver tier.
- **Phase 4** — Scoring: `ScoreCreatorService` wraps `score-creator` edge fn (caches gfi + cpiBreakdown by creator id), `CampaignContextService` holds shared campaign genre, scoring page shows summary stats + sortable table + genre benchmark panel, re-scores reactively on genre change.
- **Phase 5** — Personas: 48 personas across 12 genres extracted, `PersonasService.listFor` with sub-mode → genre default fallback, auto-select shortlist (5–250 top creators by CPI), persona cards with recommendation banner + "Simulate this campaign" CTA.
- **Phase 6** — Simulator: `SimulationService` (pure-function fallback, golden-tested against app.html), `RunSimulationService` (wraps `run-simulation` edge fn), `RateLimitService` (sessionStorage counter, 3 free / 10 silver / ∞ gold+). Simulator page shows budget/format/genre controls, 12 objective chips, P10/P50/P90 band cards, and a 6-column metrics grid. `GENRE_BENCHMARKS` extracted to `benchmarks.data.ts`. Local compute fires instantly, server result overwrites on success.
- **Phase 7** — Campaigns: abstract `CampaignsRepository` token + `InMemoryCampaignsRepository` default binding (wired in `app.config.ts`), `CampaignsService` with optimistic-update signals, campaigns grid page with create/edit/delete + form modal, `BriefPdfService` (Platinum+) builds print-ready HTML and opens a window for the browser's Save-as-PDF. Simulator gained a "Save to Campaigns" button that navigates with a seed object via router state.
