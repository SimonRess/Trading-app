# Changelog

All notable changes to the game are recorded here. This file is the running
record of *what changed*, kept short; deeper reasoning for design decisions
lives in `docs/decisions/` (ADRs) and system specs in `docs/design/`.

**Keep this in sync:** every change that alters behaviour, data, or
infrastructure gets an entry here, plus an update to the ADR/design doc it
touches. See `docs/00_project_structure.md` §5 (Contribution Workflow).

The format is loosely based on [Keep a Changelog](https://keepachangelog.com).
Dates are `YYYY-MM-DD`.

**Versioning:** `MAJOR.MINOR.PATCH`, sized by *scope of change* rather than
strict semver: **MAJOR** for a new core mechanic family, **MINOR** for a
medium feature or mechanic revision, **PATCH** for small edits/fixes. Shown
in the app header and the in-app changelog viewer, reading `package.json`.

---

## [Unreleased]

### Added
- `docs/design/roadmap-next-versions.md` — sequenced feature plan for v1.2 through v2, including moving the Supply/Demand columns off the trading table onto the City info screen (v1.2).

## [1.1.0] - 2026-07-26

### Added
- **Settings menu with English/German language switch** — a new "⚙️ Settings" button in the header opens a panel to pick English or Deutsch. The choice persists in `localStorage` (defaulting to the browser's language on first visit) and applies immediately across the whole app. Covers every screen's static text: nav bar, all building panels, New Game screen, save menu, popovers, table headers, and shared vocabulary (seasons, goods, ship posture, ranks, traits, etc.), plus the map legend and City view's PixiJS building labels. See `docs/design/localization.md` for full scope, including what's deliberately not covered yet (the narrative turn-summary/event log text generated in `src/game/systems/*.ts`, which stays English-only pending a larger refactor to keep game logic UI-agnostic per CLAUDE.md's architecture rule).

### Fixed
- **City view showed overlapping English/German building labels after switching language** — `SceneManager.destroy()` only clears its own bookkeeping, not the PixiJS containers still attached to the world layer, so the old-language scene stayed visible under the newly rebuilt one. Fixed by explicitly clearing the world layer's children before rebuilding on a locale change.

## [1.0.2] - 2026-07-25

### Fixed
- **Bulk-buy/sell button price stayed frozen after repeated trades** — the total-cost text only re-rendered when the quantity input changed, not when a purchase moved the market price, because Svelte couldn't see the `state` read hidden inside the preview function. Same root cause as the earlier `activeShip` reactivity bug; fixed by referencing `state` directly at the call site.

## [1.0.1] - 2026-07-25

### Fixed
- **Changelog viewer displayed raw Markdown syntax** (`#`, `-`, `**`) instead of rendering it — now rendered to real HTML.
- **Changelog entries were far too long** — rewritten throughout to one short sentence each; the "How to add an entry" guide now says so explicitly.
- **App could show a stale version after a deploy** — added cache-control hints to `index.html` (best-effort; doesn't cover CDN-level caching, so an occasional hard refresh may still be needed right after a new deploy).

## [1.0.0] - 2026-07-25

### Added
- **Combat system** (ADR-010) — cannons, crew, and a new ship posture (Aggressive/Defensive/Flee) now determine the outcome of a pirate encounter: Victory (loot), Retreat, Defeat (damage + cargo loss, can sink the ship), or Flee (guaranteed escape at a fixed cargo cost). See `ship-stats.md` "Combat".

### Changed
- **Bulk buy/sell orders now move the price as they fill**, instead of one flat price for the whole order — Buy/Sell buttons show the real total cost and an avg-per-unit tooltip. See `market-formula.md` "Bulk-Purchase Price Pressure".

## [0.4.0] - 2026-07-25

### Added
- **Auction a ship** — instant sale to "the highest bidder" for 80% of purchase price scaled by durability, from the Shipyard section.

### Fixed
- **Hired tutor "disappearing randomly"** — the boosted trait roll usually fails silently; now reports it in the turn summary instead of just reverting the button.

## [0.3.0] - 2026-07-25

### Added
- **Town Hall now shows reputation for every city**, not just Lübeck.

### Changed
- **Ship prices and church donation rates raised ×10** to stay proportional with trading income.
- **Repairing a ship now takes 1 turn in dock** before it can depart again.

### Fixed
- **Map danger colouring was hidden on any route with a ship on it** — a storm-hit route no longer disappears behind the plain "active" colour.

## [0.2.0] - 2026-07-25

*A large batch — this rolls up everything built before per-release versioning started.*

### Added
- **In-app version display and changelog viewer**, in the header.
- **Remaining random events** (Market Boom rework, Guild Festival, Shipwreck Salvage, City Plague, Diplomatic Embargo, Reputation Scandal). See `event-table.md`.
- **Political-rank progress readout + Town Hall building**, with rank-up thresholds (Guild Member/Council Member/Mayor). See `political-rank.md`.
- **Family & generational succession + Merchant's House building** (ADR-022) — health-based mortality and heir succession, marriage, children, and traits. See `family-succession.md`.
- **Ships can be renamed**, free, from the Shipyard section.
- **Cannons, insurance, and warehouses** — three new economic mechanics with their own building sections (cannons didn't yet affect combat — see v1.0.0). See `ship-stats.md`, `insurance.md`, `warehouses.md`.
- **Banking & loans + Counting House building** — borrow up to 2,000 Mark at 5%/turn compounding interest. See `banking-loans.md`, ADR-019.
- **Crew management** — hire/release sailors, per-turn wages, under-crewed travel penalty. See `crew-management.md`.
- **Church building & donations**, seeded per-city completion. See `church-donations.md`.
- **Graphical city view** — a clickable scene of buildings, replacing the old scrolling text-panel layout. See `city-view.md`, ADR-018.
- **Season order/duration info popup.**
- **Player name, age, and marital status shown in the header.**
- **Animated ship movement on the map**, instead of snapping to position.
- **Buying UI for all three ship types** (Kogge, Hulk, Schnigge), each with its own card.
- **In-game Save/Load UI.**
- **Route-danger colouring on the map**, reflecting per-route storm/pirate risk (ADR-015), which now also varies by season and drifts over a session.
- **Procedural pixel-art map icons** for cities and ships.
- **Durability-threshold effects** — a Critical ship can't depart; a Damaged ship travels slower and takes more storm damage.
- **Map zoom & pan, and a mobile responsiveness pass.**
- **Map view** — a spatial map alongside the original text-based Port view.
- **MVP game systems** — the first playable core loop (fleet, market, events, turn resolution).
- **GitHub Pages deployment.**
- **Pending sail orders** — a destination is cancellable/changeable until End Turn, instead of departing immediately.
- **Ship buying & repair at shipyard cities, with a travel-time preview and a no-shipyard notice elsewhere.**
- **Event and good icons throughout the UI, and a foldable fleet panel** for small screens.

### Changed
- **Health decay rate reduced ~10x** — the original rate made child mortality almost certain before heir age. See ADR-022.
- **Dying with no eligible heir now shows a distinct "Dynasty Has Ended" screen** instead of the generic "Bankrupt" one.
- **Multiple eligible heirs now let the player choose**, instead of auto-picking the oldest.
- **Player health shown in the header and Merchant's House; Town Hall shows each city's population** (flavor only).
- **Church donations now arrive gradually (up to 1%/turn)** instead of instantly. See `church-donations.md`.
- **Winning no longer ends the session** — the player can keep playing after a win, shown once via a victory overlay.
- **Win condition simplified to Mayor of Lübeck only** (ADR-021).
- **Net-worth valuation uses each good's fixed base price**, not the fluctuating local market price, closing a hoard-to-win exploit. See ADR-014.
- **Storm damage and pirate-raid cargo loss corrected to consistent values** (10 durability, 15% cargo) across all docs.
- **ADR-010 (Combat)** moved from Proposed to Accepted (implemented 2026-07-25, see v1.0.0).

### Fixed
- **Black screen after End Turn** — a PixiJS scene double-teardown bug, most visible once death (not just bankruptcy) became a common way to end a session. See ADR-017.
- **Trading table showed only "Supply", not "Demand"** — now shows Stock/Supply/Demand as three columns.
- Ship-rename button stayed disabled after typing (Svelte reactivity gap).
- Warehouse income and per-turn church progress were missing from the turn summary.
- Cargo status didn't show how much hold space cannons were using.
- Crew-wage message used the wrong icon.
- Shipyard only showed controls for the currently selected ship, not every ship in port.
- City-view building icons had an unreliably small click hitbox.
- Ship-movement animation never played during real turns, and could finish invisibly while the map was hidden.
- Ship pixel-art hull was upside down; sail and hull visually merged into one shape.
- Map legend sometimes failed to appear on first load, and the map itself was slow to open the first time.
- Buy/sell and destination controls silently did nothing due to a Svelte reactivity gap.
- Travel time was silently doubled on every route.
- CI lint failures.

---

## How to add an entry

When you make a change, add it under `## [Unreleased]` in the right group:

- **Added** — new features, files, or capabilities
- **Changed** — behaviour/data changes to existing features
- **Fixed** — bug fixes
- **Removed** — deleted features

Keep each entry to **one short sentence** — what changed, plus a few words of
why if it's not obvious. If the change involves a real design trade-off,
write or update an ADR and link it; if it changes how a system works, update
the matching `docs/design/*.md`. The changelog is an index into that detail,
not a copy of it.
