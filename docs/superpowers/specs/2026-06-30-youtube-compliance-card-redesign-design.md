# YouTube III.E.4h Compliance — Card & Modal Redesign + App-Shell Disclaimer

- **Date:** 2026-06-30
- **Repo / branch:** `Simfluence` (Angular frontend) · `feature/youtube-compliance-ui` (off `develop`)
- **Status:** Approved design — ready for implementation plan
- **Driver:** YouTube API Services compliance review, project `11401102800`, policy **III.E.4h**

---

## 1. Background — why this exists

YouTube API Services compliance review sequence:

1. **ToS Violations Report V.1 (2026-05-15)** raised three items:
   - **III.D.1c** *(confirm)* — do you use multiple project numbers?
   - **III.E.4a-g** *(confirm)* — how often do you refresh / update / delete API data?
   - **III.E.4h** *(violation)* — API Client should not use YouTube's API to offer independently-calculated or derived metrics that replace or provide new data not available via YouTube.
2. **Our response** (`Simfluence_YouTube_Compliance_FINAL.docx`) confirmed the single project number, described the cron-only staging data architecture (satisfies III.E.4a-g), and argued CPI/GFI are proprietary *benchmark-comparison* scores — not "derived" — while committing to 7 UI transparency actions.
3. **YouTube's latest reply** (`Youtube-latest-email-response.txt`) **dropped items 1 & 2** and **accepted the proprietary-metric position**, narrowing the entire remaining remedy to one ask, due within **7 business days**, followed by re-submitted screenshots:

   > "This metric is independently calculated by the API Client and is not derived from YouTube."

This spec implements that remedy in the Angular app (the system that becomes prod) and, in doing so, delivers the UI transparency actions the `.docx` already committed.

> **Compliance-critical premise:** YouTube judges from **screenshots**. A disclaimer that appears only on hover (a tooltip) is invisible in a screenshot and therefore useless as evidence. **Every disclaimer in this design is always-visible. No hover affordances.**

---

## 2. Goals / non-goals

**Goals**
- Place the required disclaimer **always-visibly** across the app, anchored by a persistent footer on every authenticated page.
- Visually separate platform API data (YouTube / Twitch) from Simfluence proprietary scores on the **discovery card** and the **full profile modal**.
- Keep the mechanism **platform-generic** (YouTube, Twitch, future), not YouTube-hardcoded.
- Fulfil the `.docx`-committed UI actions (persistent footer, proprietary labels, source separation, budget/benchmark/sponsor disclosure).

**Non-goals**
- No backend / API / data-architecture changes (handled in the staging backend; out of scope here).
- No tooltip/popover library and no hover-only affordances.
- No marketing/landing changes — the public landing keeps its existing scroll-footer; the compliance bar is **app-shell only**.
- Full two-zone restructure of secondary surfaces (scoring page, campaign shortlist, browse-creators modal) — covered by the app-wide footer immediately; deeper treatment is an optional follow-up.

---

## 3. Resolved decisions (locked)

| Decision | Choice |
|---|---|
| Per-metric wording | "independently calculated by Simfluence and is not derived from YouTube" — Simfluence-named (not the generic "API Client") |
| Coverage | **All** proprietary outputs: CPI, GFI, rate/budget estimate, category benchmarking, sponsor-frequency |
| Mechanism | **Always-visible** text. No tooltips / hover. |
| Footer scope | App shell only — all `/app/*` routes; never on landing / login / pricing |
| Footer mechanism | `fixed bottom-0` bar + bottom-padding on content. **No change to app-wide scroll behavior** (lowest risk). |
| Platform handling | Generic: zone headers platform-keyed ("Source: YouTube API" / "Source: Twitch API"); Simfluence-zone caption platform-agnostic; footer names YouTube explicitly |

---

## 4. Canonical wording (defined once, reused)

**A — Footer** (always-visible, every app page):

> Simfluence scores — CPI, GFI, rate estimates and category benchmarks — are independently calculated by Simfluence and are **not derived from YouTube or other source platforms**. They are Simfluence proprietary metrics, not provided by, endorsed by, or affiliated with YouTube / Google.

**B — Simfluence-zone caption** (always-visible, on the card's Simfluence zone and each Simfluence box in the modal):

> Proprietary — independently calculated by Simfluence, not a platform-provided metric.

Both carry the "independently calculated by Simfluence" assertion. The **footer** carries the explicit "not derived from YouTube" clause that satisfies YouTube's literal ask, and it is present on every authenticated page — so any screenshot of any data page contains it.

---

## 5. Design — three pieces + shared components

### 5.1 Sticky compliance footer (the anchor)
- New component — proposed `shared/compliance-footer/compliance-footer.component.ts`.
- Mounted **once** in `features/shell/main-shell.component.ts`, after the content grid (and alongside the existing global overlays).
- `position: fixed; bottom: 0; left: 0; right: 0;` slim bar; muted small text using existing theme tokens (`--color-bg-2`, `--color-border`, `--color-text-muted`); wraps to ≤2 lines at narrow widths.
- Content region (`<main>` / shell wrapper) gets `padding-bottom` ≈ footer height so nothing hides behind it.
- Renders on every `/app/*` route automatically (all are `MainShellComponent` children); never on public routes (they don't render the shell).
- Text = **Wording A**.

### 5.2 Discovery card → two platform-generic zones
File: `shared/creator-card/creator-card.component.ts`.

- **Zone 1 — platform API data (one block per platform present).** Each platform the creator is on gets a block headed "Source: {Platform} API" with its `metric-source-badge` (`youtube` / `twitch`). YouTube block: subs / avg views / eng%. Twitch block: avg CCV / peak / streams. This formalizes the card's *existing* separate YouTube/Twitch stat blocks — a YouTube-only creator shows one block, a dual-platform creator shows two.
- **Zone 2 — Simfluence proprietary.** Header "Source: Simfluence" + `metric-source-badge source="simfluence"`. First child is the always-visible caption (**Wording B**); below it, the CPI / GFI / rate tiles. **All** CPI variants live here — including per-platform CPI (see §9, the "YouTube CPI" label trap).
- Each zone is a visually distinct container (border / panel surface, reusing `.sf-panel` / `.sf-card` idiom). The card grows vertically as needed (approved).
- The caption stays platform-agnostic so it is correct regardless of which platform(s) fed the scores.

### 5.3 Full profile modal → augment existing boxes
File: `shared/creator-profile-modal/creator-profile-modal.component.ts`.

- Already has source-badged boxes: **YouTube Data** (`youtube`), **Simfluence Analysis**, **Estimated Budget Range**, **Category Benchmarking** (`simfluence`).
- Changes (no structural rebuild):
  - Prefix every box header with **"Source:"** to match the card's language.
  - Add the always-visible caption (**Wording B**) into each **Simfluence-source** box header area.
  - Sponsor-frequency lives inside *Simfluence Analysis* → covered automatically.

### 5.4 Shared components (single source of wording + markup)
- `shared/compliance/proprietary-note.component.ts` — renders **Wording B**; used by card + modal.
- A small **source-zone header** primitive — "Source: {label}" + `metric-source-badge` — used by the card's two zones and the modal's boxes. Promote the modal's existing inline section-header idiom into this shared component rather than inventing a new style.
- `shared/compliance-footer/compliance-footer.component.ts` — the footer (**Wording A**).
- Canonical strings (A and B) live in **one** place so wording edits are single-touch.

---

## 6. Scope — surfaces

**In scope (this pass)**
- `shared/creator-card/creator-card.component.ts` — discovery cards
- `shared/creator-profile-modal/creator-profile-modal.component.ts` — full profile modal
- `features/shell/main-shell.component.ts` — mount footer (+ content padding)
- new shared compliance components

**Covered immediately by the app-wide footer (no change needed for compliance)**
- `features/scoring/scoring.component.ts`, `features/campaigns/sections/section-creators.component.ts`, `features/campaigns/sections/browse-creators-modal.component.ts` — they show CPI/GFI but live under `/app/*`, so the footer disclaimer is present on-screen.

**Out of scope (optional follow-up)**
- Applying the full two-zone treatment to the three secondary surfaces above, via the shared components.

---

## 7. Compliance rationale / screenshot-proofing
- Footer always-visible on every authenticated page → any screenshot of any data page contains the required "independently calculated by Simfluence … not derived from YouTube" clause.
- Per-zone captions reinforce on card + modal, always-visible.
- **No disclaimer relies on hover.**
- Every flagged metric (CPI, GFI) and every additional proprietary output (rate/budget, benchmarking, sponsor-freq) sits under a "Source: Simfluence" label with the proprietary caption.

---

## 8. Acceptance criteria
1. Footer renders fixed at viewport bottom on **all** `/app/*` routes (dashboard, discovery, scoring, simulator, campaigns, account, admin) and **does not** render on `/`, `/login`, `/pricing`.
2. No app content is obscured by the footer at any viewport width (mobile → desktop).
3. Discovery card shows two clearly separated, source-labelled zones; the Simfluence zone shows the proprietary caption always-visible, with CPI/GFI/rate beneath it.
4. A Twitch-only creator's card reads **"Source: Twitch API"** for zone 1 (generic mechanism verified).
5. Profile modal: every Simfluence-source box header is "Source:"-prefixed and shows the proprietary caption; the YouTube box reads "Source: YouTube API".
6. The canonical wording strings (A, B) appear exactly once in source — no copy-paste drift.
7. The repo's build + unit tests pass (check `package.json` scripts); no new console errors.
8. Screenshots for YouTube: the discovery page and the profile modal each **visibly** show the footer disclaimer and the "Source: Simfluence" proprietary caption.

---

## 9. Risks / verify during implementation
- **The "YouTube CPI" label trap (compliance).** The card can render per-platform CPI as "YouTube CPI" / "Twitch CPI" (`ytCpi` / `twCpi`). These are Simfluence scores *computed from* that platform's data — **not** platform-provided metrics — and must render **inside the Simfluence zone, beneath the proprietary caption**. Strongly consider rewording to **"CPI · YouTube-based" / "CPI · Twitch-based"** (platform as the data *source*, not the metric provider). A metric literally named "YouTube CPI" sitting on a card is precisely what could reopen III.E.4h on the re-review. **Decision needed during implementation** (relabel vs keep + rely on zone framing).
- Footer height vs content padding — test mobile + desktop; the discovery grid + pagination must not be hidden.
- Confirm `metric-source-badge` already supports `youtube | twitch | simfluence` (it does, per exploration) — no new source values needed.
- Confirm the card's current Twitch rendering path so zone 1 generalizes cleanly for Twitch-only creators.
- The landing page's existing scroll-footer is untouched — verify no double-footer on any route.
- Footer legibility in **both** dark and `body.light` themes (the app ships both).

---

## 10. Source documents (compliance paper trail)
In the `simfluence-backend` repo root:
- `Simfluence.Ai_ ToS Violations Report V.1.pdf` — YouTube, 2026-05-15
- `Simfluence_YouTube_Compliance_FINAL(3) (1).docx` — our response
- `Youtube-latest-email-response.txt` — YouTube's narrowing reply (the III.E.4h disclaimer ask)
