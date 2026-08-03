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

### Fixed
- **Convoy pirate-raid victory loot was applied once per member ship instead of once for the whole convoy** — `event-system.ts`'s `pirate_raid` handler called `applyCombatOutcome` with the same `CombatResult` (including its `loot`) for every member, so a 2-ship convoy could receive double the intended loot. Only the first surviving member now receives the loot; every member still takes its own share of the shared durability/cargo loss.
- **A convoy defeat that sank a member could misidentify which ship sank** if two ships shared a name — the fleet was filtered by matching sunk ships' *names* instead of their ids. Fixed to track sunk ship ids directly. Added 2 integration tests (`event-system.test.ts`) covering both fixes.

## [1.4.0] - 2026-08-02

### Added
- **Ship convoys** — group several ships into a convoy so the fleet overview shows one entry per convoy instead of one per ship. Drill into a convoy to see its individual ships, exclude one (only while in port), and manage its repair/crew/cannons per-ship as before. See `docs/design/ship-convoys.md`, `docs/decisions/adr-023-ship-convoy-model.md`.
  - Convoy ships travel together: `Set Destination` is convoy-wide, and travel time is the slowest member's, applied uniformly — a convoy can't depart at all if any member is critically damaged.
  - Convoy ships fight as one unit against pirates: combat power sums across every member with a single convoy-wide posture modifier, one outcome roll decides the encounter, but the resulting damage/cargo loss is applied independently to each member — a defeat can sink a weak ship while stronger ones survive. A convoy dropping below 2 members auto-dissolves.
  - Buying/selling goods is convoy-wide: one stepped market trade for the total quantity, then distributed across member ships (proportional to remaining cargo space on a buy, to held quantity on a sell — the distribution strategy is swappable in code).
  - New `src/ui/FleetList.svelte` (grouped/collapsible convoy cards, shared by the List-view sidebar and the City-view Harbor panel), a "Group into Convoy" checkbox flow, and `TradeTable.svelte`'s new optional `convoyCargo`/`convoyCargoSpace` props for convoy-wide trading.
  - `executeAuctionShip` now refuses to auction a ship still assigned to a convoy — exclude it first.
  - 44 new unit tests across `convoy-system.test.ts`, `combat-system.test.ts`, and `turn-system.test.ts`. Verified live via Playwright: created a 2-ship convoy, drilled into members, set a convoy-wide destination, and bought goods as a convoy with distribution confirmed by in-hold totals.

### Changed
- Documented a branch-per-version convention in `docs/00_project_structure.md` §5 — three PRs in a row got merged mid-session while further commits were still being pushed to the same branch, stranding them outside the merged PR each time. New rule: one branch per version, and confirm a branch's PR is still open before pushing to it.

## [1.3.0] - 2026-07-30

### Added
- **Dynasty Chronicle** — a persistent, read-only log of your family's succession history, shown in the Merchant's House. Seeded with a founding entry when a new game starts; gains a new entry every time succession actually resolves (single-heir, multi-heir choice, or dying without an eligible heir). See `docs/design/family-succession.md`.
- **Price-trend sparklines** — the Town Hall's Supply/Demand table gained a fourth column showing a small trend line of each good's last 10 turns of prices, per city.
- **Achievements** — badges for 5 milestones (first 1,000/10,000 Mark net worth, first ship lost, first Mayor of Lübeck, reaching a second generation), shown in the Merchant's House above the Dynasty Chronicle.
- **A second marriage partner** — "the Alderman's Daughter" (2,000 Mark, gifts +10 reputation in Hamburg), available once net worth reaches 6,000 Mark. The Merchant's House now lists every offer you currently qualify for, instead of a single fixed option.

### Removed
- **`priceTrend()`** (`market-system.ts`) — implemented and tested but never actually wired into any screen; superseded by the sparkline above, which does the same job better. Removed as dead code rather than left unused.

### Fixed
- **Church "~N more turns" estimate was 10× too high, and the pledged-progress bar rendered 10× too wide** — `App.svelte` hardcoded a `/ 50` divisor left over from before the 2026-07-25 ×10 donation-rate raise, instead of importing `church-system.ts`'s actual `DONATION_COST_PER_PERCENT` (500). A 1,000 Mark pledge showed "~20 more turns" instead of ~2. Fixed by exporting the rate constants and having the UI compute off them directly, so a future rate change can't silently desync the display again. See `docs/design/church-donations.md`.
- **A critically-damaged ship docked at a non-shipyard city (Riga or Malmö) could get permanently stuck** — it couldn't depart, couldn't be repaired away from a shipyard (both by design), and couldn't be auctioned either, even though auctioning was always meant to work from any port — the only Auction button lived inside the Shipyard building panel, which doesn't exist at those two cities. Fixed by surfacing a rescue Auction action directly in the Harbor panel's "can't depart" message when docked somewhere without a shipyard. See `docs/design/ship-stats.md`.

## [1.2.0] - 2026-07-30

### Changed
- **Trading table is slimmer** — dropped the Supply and Demand columns, keeping `Good | Price | Stock | Buy | Sell`. Supply/Demand moved to the Town Hall building panel as a per-good, read-only table for the currently-selected city.
- **Extracted a shared `TradeTable.svelte` component**, replacing 4 separately-maintained copies of the trading table across City-view and List-view — closes the duplicate-edit bug pattern that hit both the localization pass and the bulk-price fix.
- **Header shows "Turn N"**, not "Turn N/999999" — also rewrote the season-info popup, which still said the game "runs 249999.75 years," to correctly explain there's no turn limit.
- **Ship map markers are now blue**, distinct from cities' gold, and sit further from a docked ship's home-city icon (34px, was 22px) — the two used to visually merge into one blob.
- **Buy/Sell buttons drop the redundant total at qty 1** — show plain "Buy"/"Sell", only adding `(total M)` once bulk pricing (qty > 1) makes it diverge from the adjacent Price column.
- Documented a test policy for `src/ui/`/`src/render/` in `CLAUDE.md` (no component-test infra exists yet; reactivity-sensitive changes must be manually verified live) and clarified the file-naming rule to explicitly allow PascalCase for `.svelte` components, matching the codebase's existing convention.

### Added
- **"Sell all" quick action** next to Sell, when a ship is in port holding that good.

## [1.1.1] - 2026-07-30

### Added
- `docs/design/roadmap-next-versions.md` — sequenced feature plan for v1.2 through v2, including moving the Supply/Demand columns off the trading table onto the City info screen (v1.2). Approved 2026-07-27.
- `/ship` command (`.claude/commands/ship.md`) — encodes the check-suite → docs → commit → push → deploy sequence used for every release this project has shipped so far, matching the existing `/new-adr`/`/new-design`/`/check-conventions` commands.

### Fixed
- `CLAUDE.md`'s architecture diagram described `src/game/state/` as holding Svelte stores; it only ever held `types.ts`. Corrected to describe the real shape (a single `GameState` object inside `LocalGameClient`).
- CI (`ci.yml`) never ran `npm run build`, so a build-only failure could pass every PR check and only surface at deploy time on `main`. Added a build step.
- Unified the project's name to "Hanse – Die Expedition" (matching `index.html`) across `CLAUDE.md` and `docs/prd.md`, which each used a different variant.
- Added `eslint` to the existing `PostToolUse` typecheck hook (`.claude/settings.json`) so lint violations are caught at edit-time, not just at the end of a task.
- Deleted 8 local feature branches already merged into `main` (remote copies still need deleting — this session's git access couldn't push branch deletions to `origin`).
- Added a `SessionStart` hook (`.claude/settings.json`) that sets the git author identity to `noreply@anthropic.com` and warns if the local checkout is behind `origin` for the current branch — prevents both a commit-authorship mixup and a stale-local-checkout incident hit this session (the local working directory silently reverted to an older snapshot mid-session while `origin` stayed correct; caught late, cost time to reconcile).

### Changed
- Consolidated backlog tracking into a single file. `docs/prd.md`'s Feature Backlog and `docs/00_project_structure.md` §4b's "Open backlog" both duplicated `roadmap-next-versions.md` and had already drifted out of sync; both sections were removed in favor of that one file. `prd.md` now stays scoped to vision/audience/scope/non-goals; §4b stays scoped to the dated log of what's shipped.
- `docs/00_project_structure.md` §5's Contribution Workflow gained an explicit first step: a new, not-yet-committed idea goes into `roadmap-next-versions.md` before any ADR or design doc gets written — closes the exact ambiguity that caused the backlog drift above.
- v1.2's roadmap item now explicitly requires splitting `src/ui/App.svelte` (1,953 lines) into `screens/`/`panels/`/`shared/` components as part of the Supply/Demand rework, not as separate later cleanup — per the architecture audit's finding that the City-view/List-view markup duplication is a recurring source of missed-edit bugs.
- Folded the 2026-07-28 architecture/Claude-Code audit's findings into `roadmap-next-versions.md`: test-policy and `/check-conventions` enforcement into v1.2, a subagent-reconnaissance note into v1.4 and v2's biggest items, the `howler` dependency resolution into v2's audio item, and a new "Engineering/process items (not version-bound)" section for the fixes with no version dependency (CI build step, stale branches, project naming, lint hook, `/ship` command, `CLAUDE.md` diagram fix).

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
