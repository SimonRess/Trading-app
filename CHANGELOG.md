# Changelog

All notable changes to the game are recorded here. This file is the running
record of *what changed and why*; deeper reasoning for design decisions lives in
`docs/decisions/` (ADRs) and system specs in `docs/design/`.

**Keep this in sync:** every change that alters behaviour, data, or
infrastructure gets an entry here, plus an update to the ADR/design doc it
touches. See `docs/00_project_structure.md` §5 (Contribution Workflow).

The format is loosely based on [Keep a Changelog](https://keepachangelog.com).
Dates are `YYYY-MM-DD`.

---

## [Unreleased]

### Added
- **MVP game systems** — first playable implementation of the core loop:
  - `src/game/data/ships.ts` (Kogge stats, `shipNetWorth`)
  - `src/game/systems/fleet-system.ts` (movement, arrivals, storm damage, pirate raid, cargo helpers)
  - `src/game/systems/event-system.ts` (weighted event selection per `design/event-table.md`)
  - `src/game/systems/turn-system.ts` (full turn resolution, buy/sell, `computeNetWorth`)
  - Playable UI in `src/ui/App.svelte` (new-game → port → turn summary → game over)
- **GitHub Pages deployment** — `.github/workflows/deploy.yml`, `npm run deploy`, and `base` path in `vite.config.ts`. Implements ADR-008. Documented in `docs/design/deployment.md`.
- **Pending sail orders** — choosing a destination in port now sets a *pending* order (changeable/cancellable) that departs only when the turn is ended, instead of departing immediately. UI shows the order on the ship card and in the destination panel.
- **Ship buying & repair (shipyard)** — a "Shipyard" section now appears in the port view whenever the selected ship is docked at Lübeck, Danzig, or Hamburg:
  - **Buy Ship** — 400 Mark for a new Kogge, capped at `MAX_SHIPS` (3) regardless of cash.
  - **Repair** — restores the selected ship to full durability for `(100 - durability) × 2` Mark; disabled at full durability or insufficient cash.
  - New `GameAction`s `BUY_SHIP` and `REPAIR_SHIP`; new pure functions `executeBuyShip`/`executeRepairShip` in `turn-system.ts`; `SHIPYARD_CITIES`, `MAX_SHIPS`, `repairCost`, `nextShipName` added to `src/game/data/ships.ts`.
  - Resolves two open questions in `ship-stats.md`: repair/purchase is restricted to the three shipyard cities (not all five), and the MVP uses a manual shipyard UI rather than auto-charging on port visit.
  - Also documents an existing gap: durability-threshold effects (storm-chance modifiers, travel-time penalty, "cannot depart if critical") are still **not enforced** — see `ship-stats.md` Implementation Status.
- **Destination travel-time preview** — each destination button in the port view now shows the trip length (e.g. "Danzig (2t)"), and the pending-order note states it too ("depart for Danzig (2 turns)..."). Previously the travel time was only visible after committing to a voyage (on the ship card, post-departure). **Follow-up fix:** the first pass missed the ship card itself in the Fleet panel — it showed the pending order ("⚓ → Danzig") without a turn count until the turn was actually ended. The ship card now shows "⚓ → Danzig (2t)" immediately on selecting a destination, matching the destination button and the order note.

### Changed
- **Net-worth valuation** — held cargo is now valued at each good's fixed base price instead of the fluctuating local market price. Removes the per-turn "paper" drift while idle and closes a hoard-to-win exploit. See **ADR-014**. `mvp-scope.md` and `ship-stats.md` updated to match.
- **Storm damage** corrected to **10 durability** across all docs. `mvp-scope.md` previously said 5, contradicting `ship-stats.md` and `event-table.md` (which say 10, with a note that 5 was too minor). 10 is authoritative.
- **Pirate raid** effect aligned to **15 % of cargo, proportional across goods** in `mvp-scope.md` (previously "10 %"), matching `event-table.md`.
- **ADR-010 (Combat)** moved from Proposed to **Accepted**.

### Fixed
- **Svelte reactivity in the port UI** — buy/sell, the trade panel during travel, and setting a new destination after arrival did nothing on screen. Root cause: the reactive statement `$: activeShip = shipById(selectedShipId)` only tracked `selectedShipId`; Svelte cannot see `state` reads inside a called function, so with a single ship (whose id never changes) the derived ship/port never recomputed. Fixed by referencing `state.fleet.ships` directly in the reactive statement.
- **CI lint** — resolved 32 ESLint errors (import boundaries, `no-default-export`, `require-await`, non-null assertions in tests, template-literal number coercion, dynamic delete) so the deploy pipeline is green.
- **Travel time silently doubled** — `fleet-system.ts`'s `setDestination` computed `turnsRemaining` as `route.turns × SHIP_TYPES[type].turnsPerLeg`, but `route.turns` (per `city-graph.md`) already *is* the full travel time "assuming a Kogge at standard speed" — the multiplication double-counted the Kogge's speed on every voyage (e.g. Malmö→Riga took 6 turns in-game instead of the documented 3). This was reported as "no storms in 40 turns while sailing Malmö↔Riga": the underlying storm probability was verified correct by simulation (~3.9 storms expected per 40-turn game, 0/200 zero-storm trials), but the doubled travel time roughly halved the number of voyages actually completed, sharply cutting the number of storm rolls a player would see. Fixed by using `route.turns` directly; see `city-graph.md` Implementation Status.

---

## How to add an entry

When you make a change, add it under `## [Unreleased]` in the right group:

- **Added** — new features, files, or capabilities
- **Changed** — behaviour/data changes to existing features
- **Fixed** — bug fixes
- **Removed** — deleted features

If the change involves a design decision (a real trade-off with alternatives),
write or update an ADR and link it. If it changes how a system works, update the
matching `docs/design/*.md`. The changelog entry should be short; the ADR/design
doc holds the detail.
