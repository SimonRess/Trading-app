# Design: Roadmap — Next Versions

**Status:** Approved by product owner 2026-07-27 (nothing here implemented yet)
**Last updated:** 2026-07-28

**This is the single source of truth for planned-but-unbuilt work.** It was assembled from `docs/prd.md`'s former Feature Backlog section and `docs/00_project_structure.md`'s former "Open backlog" subsection, plus `docs/design/feature-brainstorm.md`'s findings and one new item requested directly (moving supply/demand off the trading screen). Both source sections were removed once their content landed here, since maintaining the same items in multiple places let them drift out of sync with each other. `feature-brainstorm.md` remains a separate supporting doc (deeper rationale for the v1.2/v1.3 UX items) rather than being folded in, since it's a narrower playtest-findings writeup, not itself a backlog.

When scope changes — a new idea, a reprioritization, an item shipping — edit **only this file**. `docs/00_project_structure.md` §4b then gets a new ✅ line once something actually ships; `docs/prd.md` only changes if the shipped feature alters vision/scope/non-goals.

---

## v1.2 — Trading screen slimdown + UX polish

Low-risk, high-value UI work. No new game mechanics, so no `src/game/` changes and minimal test risk.

1. ✅ **Move Supply/Demand columns off the trading table, onto the City info screen.** Shipped: the Trading Post table is now `Good | Price | Stock | Buy | Sell` (was `Good | Price | Stock | Supply | Demand | Buy | Sell`) in both City-view and List-view; the Town Hall panel gained a per-good, read-only `Good | Supply | Demand` table for the selected city. Extracted a shared `src/ui/TradeTable.svelte` component (used by all 4 previous copy-pasted table instances — City-view in-port/no-ship and List-view in-port/at-sea) so the two views render the same markup instead of hand-synced duplicates, closing the duplicate-edit bug pattern that bit the i18n pass and the bulk-price fix. Verified live (Playwright): headers correctly show `Good, Price, Stock, In hold, Trade` with no Supply/Demand; bulk-buy price preview still updates correctly after a purchase (the exact area the earlier reactivity bug lived in); Town Hall's new table renders 5 correct supply/demand rows. No `GameState`/`game/` changes.
   - **Not done**: the broader `src/ui/App.svelte` split into `screens/`/`panels/`/`shared/` (the file is still ~1,930 lines) — only the trading-table piece was extracted. `App.svelte` is smaller and the worst duplication is gone, but the full split remains open for a future pass if the file's size keeps causing friction. See `docs/audits/2026-07-28-architecture-and-claude-code-review.md` finding #1.
2. **Header turn counter** — show "Turn N" instead of "Turn N/999999" (feature-brainstorm #1).
3. **Distinct ship vs. city map icons** (feature-brainstorm #2).
4. **Drop redundant qty-1 total on Buy/Sell buttons** (feature-brainstorm #3).
5. **"Sell all" quick action** next to Sell when in port (feature-brainstorm, small UI polish).
5a. **Decide a test policy for `src/ui/`/`src/render/`** (audit #3) — this version is the natural moment: item 1 creates the first real batch of new, independently-testable UI components (`TradeTable.svelte` etc.), so decide then whether they get component tests or stay manually-verified, rather than leaving the policy unstated.
5b. **Enforce `/check-conventions` before merging** (audit #9) — run it against v1.2's diff specifically, since the `App.svelte` split is the biggest architecture-boundary-sensitive change on the roadmap; a good first real test of making the command a required step rather than an easily-forgotten one.

## v1.3 — Dynasty Chronicle + market memory

Player-facing history/feedback features. Mostly UI-layer, reading existing state rather than adding new mechanics.

6. **Dynasty Chronicle** — persistent `GameState.chronicle: string[]` logging succession/notable events, surfaced as a read-only panel (feature-brainstorm #1). This *is* a `GameState` shape change (new field, needs a save-schema version bump) but no new rules.
7. **Price history / trend sparkline per good** — client-side only, remembers last ~10 turns of `GoodMarket` snapshots in the UI layer (feature-brainstorm #3).
8. **Achievements / milestones log** — detected from existing state transitions, shown alongside the Chronicle (feature-brainstorm #4).
9. **Saved/repeating trade routes** — auto-fill next turn's buy/sail/sell orders until cancelled (feature-brainstorm #2). Larger than 6-8: touches action dispatch, needs its own design doc before starting.
9b. **Second (and further) marriage partner types** — only the Fisherman's Daughter exists today; `family-succession.md` anticipated more variety.

## v1.4 — Gameplay depth: stores & agents

The single biggest "targeted v1.1, never built" gap from the original vision (`prd.md` #3). Bigger effort, deserves its own ADR before implementation given it's a new core system (permanent per-city inventory + hired-agent skill/loyalty simulation).

10. **Stores & agents in cities** (`prd.md` #3).
11. **Per-city warehouse income/price variance**, since it's closely related storage/economy surface area (`prd.md` #10).
12. **Combat loot realism** — simulated enemy fleet instead of a fixed loot pool (`prd.md` #1), natural follow-on now that combat (v1.0) has shipped and stabilized.
13. **Ability to initiate combat** — hunt pirates for loot/reputation (`prd.md` #2).
13a. **Use a dedicated `Explore`/`Plan` subagent pass before scoping the ADR** (audit #10) — this is the first roadmap item big enough to justify it: a new core system (permanent per-city inventory + hired-agent skill/loyalty simulation) benefits from a focused reconnaissance pass that doesn't consume the main session's context before the real design work starts.

## v1.5 — Localization completion + balance pass

14. **Translate the narrative turn-summary/event log lines into German** — the deliberate gap left by this session's i18n work (`docs/design/localization.md` "Open follow-up"). Requires refactoring `src/game/systems/*.ts` message-producing functions to return `{ key, params }` instead of formatted English strings, touching ~10 files and ~50 tests that currently assert on message substrings. Scoping this as its own version rather than folding it into v1.2 because it's a genuine architecture change, not UI polish.
15. **Balance/threshold tuning pass** across every system shipped so far — first-pass numbers, never validated by simulation (`prd.md` #18). Good moment to do this: right before v2's bigger systems (expeditions, hotseat) land on top of an untuned base.

## v2 — Expeditions, art, hotseat

Larger, previously-scoped-for-v2 items, unchanged from `prd.md`:

16. **Expeditions & city discovery** (`prd.md` #4)
17. **Real pixel-art sprite sheets** (`prd.md` #12, ADR-005) — needs an asset pipeline doc first
18. **Illustrated key scenes / NPC portrait dialogs** (`prd.md` #13-14)
19. **Audio/music** (`prd.md` #15) — `howler` is already a `package.json` dependency, pre-installed for this item; resolve audit #4 here by either finally using it or removing it if a different approach is chosen once this is actually scoped.
20. **`players[]` array migration**, done *before* hotseat starts (`prd.md` #17)
21. **Hotseat multiplayer** (`prd.md` #16, ADR-007) — same subagent-reconnaissance argument as v1.4's item 13a (audit #10) applies here too; the second-biggest single item on this roadmap.

---

## Engineering/process items (not version-bound)

From `docs/audits/2026-07-28-architecture-and-claude-code-review.md`. These aren't player-facing features so they don't get a version number — they're small, independent of game content, and safe to do whenever, rather than waiting on a release. Listed here (not left only in the audit file) so they're tracked in the same single place as everything else, per this doc's own point about backlog drift.

- **Fix `CLAUDE.md`'s architecture diagram** (audit #2) — it documents Svelte stores in `src/game/state/` that don't exist; the real state lives in `LocalGameClient`. Doc-only fix.
- **Add a `build` step to `ci.yml`** (audit #6) — currently only `deploy.yml` runs `npm run build`, so a build-only failure can pass CI and only surface at deploy time on `main`.
- **Delete the 8 already-merged stale `claude/*` branches** (audit #5), local and remote.
- **Pick one canonical project name** (audit #7) and use it consistently across `package.json`, `index.html`, and doc headers.
- **Add `eslint` to the `PostToolUse` typecheck hook** in `.claude/settings.json` (audit #12), so lint violations (including the architecture-boundary `no-restricted-imports` rule) are caught at edit-time, not just at the end of a task.
- **Add a `/ship` command** (audit #11) capturing the repeated check-suite → docs → commit → push → deploy sequence, the same pattern as the existing `/new-adr`/`/new-design` commands.

## Open challenges to watch across this whole plan

- **City-view/List-view markup duplication** — two independently-edited copies of most panels has caused missed-edit bugs twice this session (i18n pass, bulk-price fix). Now scoped into v1.2 item 1 (shared `TradeTable.svelte` + `App.svelte` split), not just flagged.
- **Save-schema versioning** — v1.3's Chronicle field is the first `GameState` shape change since localization shipped; confirm `docs/design/save-file-schema.md` (referenced in CLAUDE.md, not yet created) exists before it lands, or create it then.
- **Game-logic/UI message boundary** — v1.5's narrative-string refactor is the same architectural seam CLAUDE.md's Hard Rule 1 protects; do it once, properly (message keys + params), rather than as an incremental patch, since it touches every system file.
- **Effort sizing** — v1.4 (stores & agents) and v2 (expeditions, hotseat) are the two biggest single items in this whole plan; each should get its own ADR/design doc and be split into sub-tasks before implementation starts, per `00_project_structure.md`'s planning workflow.

## Related

- `docs/prd.md` — vision, scope, non-goals (no longer holds a backlog; points here instead)
- `docs/design/feature-brainstorm.md` — UX/fun findings this plan's v1.2/v1.3 draw from
- `docs/design/localization.md` — the i18n scope boundary v1.5 closes
- `docs/00_project_structure.md` §4b — the ordered, dated log of what's already *shipped*; picks up where this doc's items get built
