# Design: Roadmap — Next Versions

**Status:** Approved by product owner 2026-07-27 (nothing here implemented yet)
**Last updated:** 2026-07-27

**This is the single source of truth for planned-but-unbuilt work.** It was assembled from `docs/prd.md`'s former Feature Backlog section and `docs/00_project_structure.md`'s former "Open backlog" subsection, plus `docs/design/feature-brainstorm.md`'s findings and one new item requested directly (moving supply/demand off the trading screen). Both source sections were removed once their content landed here, since maintaining the same items in multiple places let them drift out of sync with each other. `feature-brainstorm.md` remains a separate supporting doc (deeper rationale for the v1.2/v1.3 UX items) rather than being folded in, since it's a narrower playtest-findings writeup, not itself a backlog.

When scope changes — a new idea, a reprioritization, an item shipping — edit **only this file**. `docs/00_project_structure.md` §4b then gets a new ✅ line once something actually ships; `docs/prd.md` only changes if the shipped feature alters vision/scope/non-goals.

---

## v1.2 — Trading screen slimdown + UX polish

Low-risk, high-value UI work. No new game mechanics, so no `src/game/` changes and minimal test risk.

1. **Move Supply/Demand columns off the trading table, onto the City info screen.** Today the Trading Post table is `Good | Price | Stock | Supply | Demand | Buy | Sell` (`App.svelte` City-view ~L694, List-view ~L1165, plus the two `<thead>` one-liners at ~L741/~L1367) — five data columns before a player can even act. Supply/Demand are *why* a price is what it is, useful for understanding a city's economy, but not needed turn-to-turn once a player already knows a route. Proposal:
   - Trading table shrinks to `Good | Price | Stock | Buy | Sell` — the columns a player acts on every turn.
   - City info screen (the building panel already showing city-level stats — reputation, warehouse, etc.) gains a small per-good Supply/Demand table, one row per good, read-only.
   - No `GameState` or `game/` changes — this is purely `App.svelte` markup reshuffling plus new `i18n.ts` keys if the city-info table needs its own header labels (colSupply/colDemand already exist and can be reused).
   - Update `docs/design/city-view.md` and `docs/design/market-formula.md` if either documents the current table layout.
   - Challenge: the City-view and List-view are two separately-maintained markup blocks (a recurring source of duplicate-edit bugs this session, e.g. the i18n pass and the earlier bulk-price fix both had to touch both). Consider extracting a shared `TradeTable.svelte` / `CityInfoPanel.svelte` component as part of this change to stop that duplication at the source — worth scoping explicitly since it's a good opportunity, not just a nice-to-have.
2. **Header turn counter** — show "Turn N" instead of "Turn N/999999" (feature-brainstorm #1).
3. **Distinct ship vs. city map icons** (feature-brainstorm #2).
4. **Drop redundant qty-1 total on Buy/Sell buttons** (feature-brainstorm #3).
5. **"Sell all" quick action** next to Sell when in port (feature-brainstorm, small UI polish).

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

## v1.5 — Localization completion + balance pass

14. **Translate the narrative turn-summary/event log lines into German** — the deliberate gap left by this session's i18n work (`docs/design/localization.md` "Open follow-up"). Requires refactoring `src/game/systems/*.ts` message-producing functions to return `{ key, params }` instead of formatted English strings, touching ~10 files and ~50 tests that currently assert on message substrings. Scoping this as its own version rather than folding it into v1.2 because it's a genuine architecture change, not UI polish.
15. **Balance/threshold tuning pass** across every system shipped so far — first-pass numbers, never validated by simulation (`prd.md` #18). Good moment to do this: right before v2's bigger systems (expeditions, hotseat) land on top of an untuned base.

## v2 — Expeditions, art, hotseat

Larger, previously-scoped-for-v2 items, unchanged from `prd.md`:

16. **Expeditions & city discovery** (`prd.md` #4)
17. **Real pixel-art sprite sheets** (`prd.md` #12, ADR-005) — needs an asset pipeline doc first
18. **Illustrated key scenes / NPC portrait dialogs** (`prd.md` #13-14)
19. **Audio/music** (`prd.md` #15)
20. **`players[]` array migration**, done *before* hotseat starts (`prd.md` #17)
21. **Hotseat multiplayer** (`prd.md` #16, ADR-007)

---

## Open challenges to watch across this whole plan

- **City-view/List-view markup duplication** — two independently-edited copies of most panels has caused missed-edit bugs twice this session (i18n pass, bulk-price fix). Worth fixing structurally (shared components) during v1.2's trading-table rework rather than continuing to pay the tax on every future UI change.
- **Save-schema versioning** — v1.3's Chronicle field is the first `GameState` shape change since localization shipped; confirm `docs/design/save-file-schema.md` (referenced in CLAUDE.md, not yet created) exists before it lands, or create it then.
- **Game-logic/UI message boundary** — v1.5's narrative-string refactor is the same architectural seam CLAUDE.md's Hard Rule 1 protects; do it once, properly (message keys + params), rather than as an incremental patch, since it touches every system file.
- **Effort sizing** — v1.4 (stores & agents) and v2 (expeditions, hotseat) are the two biggest single items in this whole plan; each should get its own ADR/design doc and be split into sub-tasks before implementation starts, per `00_project_structure.md`'s planning workflow.

## Related

- `docs/prd.md` — vision, scope, non-goals (no longer holds a backlog; points here instead)
- `docs/design/feature-brainstorm.md` — UX/fun findings this plan's v1.2/v1.3 draw from
- `docs/design/localization.md` — the i18n scope boundary v1.5 closes
- `docs/00_project_structure.md` §4b — the ordered, dated log of what's already *shipped*; picks up where this doc's items get built
