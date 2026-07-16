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

### Changed
- **Net-worth valuation** — held cargo is now valued at each good's fixed base price instead of the fluctuating local market price. Removes the per-turn "paper" drift while idle and closes a hoard-to-win exploit. See **ADR-014**. `mvp-scope.md` and `ship-stats.md` updated to match.
- **Storm damage** corrected to **10 durability** across all docs. `mvp-scope.md` previously said 5, contradicting `ship-stats.md` and `event-table.md` (which say 10, with a note that 5 was too minor). 10 is authoritative.
- **Pirate raid** effect aligned to **15 % of cargo, proportional across goods** in `mvp-scope.md` (previously "10 %"), matching `event-table.md`.
- **ADR-010 (Combat)** moved from Proposed to **Accepted**.

### Fixed
- **Svelte reactivity in the port UI** — buy/sell, the trade panel during travel, and setting a new destination after arrival did nothing on screen. Root cause: the reactive statement `$: activeShip = shipById(selectedShipId)` only tracked `selectedShipId`; Svelte cannot see `state` reads inside a called function, so with a single ship (whose id never changes) the derived ship/port never recomputed. Fixed by referencing `state.fleet.ships` directly in the reactive statement.
- **CI lint** — resolved 32 ESLint errors (import boundaries, `no-default-export`, `require-await`, non-null assertions in tests, template-literal number coercion, dynamic delete) so the deploy pipeline is green.

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
