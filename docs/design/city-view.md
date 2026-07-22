# Design: Graphical City View

**Status:** Proposed — not implemented  
**Target version:** post-v1.1 UI overhaul (not yet numbered — depends on how many of the v1.1/v2 mechanics below have landed by the time this starts, since the whole point is giving each of them a physical building to live in)

## Purpose

The Port view is currently one scrolling text panel: a goods table, a "Set Destination" section, a "Shipyard" section, and (per recent proposals) will soon also need Church, Bank/Insurance, and Warehouse sections stacked the same way. Every new economic feature so far has been added as *another section in the same list* — functional, but it doesn't read as a place, and it will keep growing linearly as more systems land (crew, cannons, warehouses, church, bank all pending). This doc proposes replacing that list with a clickable, illustrated city scene — each function lives in a specific building, and opening a building shows only that function's controls, rather than everything at once.

This is explicitly a *rendering/interaction* change, not a game-logic change — every function below already exists (or is proposed) as a `GameAction`/turn-system function; this doc is about **how the player reaches it**, matching the project's own boundary rule (`src/ui/` never reimplements `src/game/systems/` logic, only presents it, per `CLAUDE.md` Hard Rule 2).

## Goals

- Replace "everything visible in one scroll" with "walk up to a building, see only what it does."
- Reuse the pixel-art and PixiJS approach already established for the map (`map-view.md`) rather than introducing a second rendering technology for one screen — a city view is structurally the same problem as the map (a scene of clickable icons at fixed positions with labels), just zoomed in to one city instead of the whole network.
- Give every current and proposed economic feature a single, discoverable home, so a new feature's UI question becomes "which building does this belong in" rather than "where does this section go in the list."
- Ship incrementally — the existing text-panel port view should keep working feature-by-feature as buildings replace it, not require a single big-bang cutover (see "Rollout" below).

## Non-Goals (this pass)

- No per-city unique art (five different hand-drawn towns) — one city-view *layout template* reused for all five cities, with only the building set/positions varying if a city lacks a given function (e.g. non-shipyard cities have no Shipyard building). Bespoke per-city art is a plausible future polish pass once the base interaction model is validated, not a blocker for it.
- No walking/movement animation of a player avatar between buildings — clicking a building opens its panel directly, the same "click city icon → see that city's info" interaction the map already has, not a new avatar-controlled exploration mode.
- No interior views (walking inside a building to see a room) — a building click opens a panel/overlay with that building's controls, not a second scene to render.

## Building → Function Mapping

Proposed building set, each mapping to functions that already exist in the port view today, or are proposed in other design docs:

| Building | Functions bound to it | Source |
|---|---|---|
| **⚓ Harbor / Docks** | Fleet overview, ship selection, "Set Destination" (sailing orders) | Existing (`Fleet` panel + "Set Destination" section) |
| **🏛️ Trading Post (Kontor)** | Buy/sell goods at current market prices | Existing (goods table) |
| **🔨 Shipyard** | Buy ships, repair ships, rename ships, crew hire/release, cannon buy/sell | Existing (Shipyard section) + `ship-stats.md` "Renaming Ships" + `crew-management.md` + `ship-stats.md` "Buying & Selling Cannons" — all four are ship-centric actions, so they share one building rather than each getting its own |
| **⛪ Church** | Donate toward the city's church completion %, view completion progress | `church-donations.md` |
| **🏦 Counting House (Bank)** | Take/repay a loan, buy/cancel insurance | `banking-loans.md` + `insurance.md` — grouped because both are "cash-for-risk-position" financial products, distinct from the Shipyard's physical-ship actions |
| **🏠 Merchant's House** | Player info (name/age/marital status — currently header-only), and once built: family/succession status, child growth progress, hiring a teacher | `family-succession.md` — the one building tied to the player's own household rather than a city service |
| **🏛️ Town Hall (Rathaus)** | Political rank progress, reputation-per-city readout | `political-rank.md`'s proposed-but-undecided progress indicator (its own Open Questions flagged not knowing where this UI should live — this answers that) |
| **📦 Warehouse District** | Buy/sell warehouses, view passive income rate | `warehouses.md` |

Eight buildings total — deliberately not more; every current/proposed v1.1/v2 economic feature above already has a home, and a ninth building shouldn't be added speculatively before a ninth function exists that needs one.

Not every city has every building: only `SHIPYARD_CITIES` (Lübeck, Danzig, Hamburg) get a Shipyard, matching the existing restriction — the city-view layout for a non-shipyard city simply omits that icon, the same way `atShipyard` already gates the Shipyard section in the current text UI.

## Architecture

- New `CityScene` class in `src/render/`, structurally parallel to `MapScene` (`map-view.md` "Architecture") — a PixiJS `Application` rendering a small set of clickable building icons at fixed positions (reusing `drawPixelSprite`'s pattern-grid approach for building silhouettes, the same "vector pixel art, one `Graphics.rect()` per filled cell" technique already used for cities and ships), each with a text label and an `eventMode = 'static'`/`pointertap` handler, mirroring exactly how `MapScene.drawCities()` already makes city icons clickable.
- A new `CityView.svelte` component (parallel to `MapView.svelte`) wraps it, dispatching a `selectBuilding` event up to `App.svelte` on click — same event-dispatch pattern already used for `selectCity`/`selectShip` from `MapView.svelte`.
- Clicking a building opens a panel — proposed as a modal/overlay (reusing the `.turn-summary-overlay`-style fixed-position pattern already established by ADR-017, not a new pattern) containing *only* that building's controls, replacing what is currently a permanently-visible section of the port-view scroll.
- `App.svelte`'s existing port-view state (`selectedShipId`, `buyQty`/`sellQty`, `pendingDest`, etc.) stays exactly where it is — this is a presentation change, not a state-shape change. The building panels bind to the same reactive variables and call the same `gameClient.sendAction(...)` calls the current text sections already call.

## Interaction Model

- Port view gains a new sub-mode (alongside the existing Map/Port toggle in the header nav) — proposed: the current "⚓ Port" button becomes "🏙️ City" and shows the building scene by default; a small "📋 List View" toggle preserves the current text-panel layout as a fallback/accessibility option (screen-reader-unfriendly pixel-art click targets are a real concern for a from-scratch graphical UI — see Open Questions) rather than removing it outright.
- Selecting a ship or city elsewhere (e.g. from the Map) still routes to the same underlying state; the City view just becomes another lens onto it, the same relationship Map and (list) Port already have today.

## Rollout (Non-Goals notwithstanding — sequencing matters here)

Proposed incremental order, each step shippable and testable independently, matching how every other feature in this project has landed:

1. **`CityScene`/`CityView.svelte` skeleton** — render the building icons for a city, clickable, but each click just logs/opens an empty placeholder panel. Proves the rendering approach (reusing `drawPixelSprite`, PixiJS scene lifecycle) without touching any existing functionality.
2. **Wire the Harbor and Trading Post buildings** to the existing "Set Destination" and goods-table logic — the two functions every city already has today, so this covers 100% of cities immediately and is the highest-value first migration.
3. **Wire the Shipyard building** (only relevant in 3 of 5 cities) to the existing buy/repair logic, then extend it as crew/cannons/renaming land.
4. **New buildings (Church, Counting House, Merchant's House, Town Hall, Warehouse District)** get built *alongside* their underlying mechanic's own implementation, not retrofitted after — i.e. when `church-donations.md` is actually implemented, it ships with its Church building from day one rather than a text section that gets migrated later.
5. **Retire the text-panel fallback** (or keep it permanently as an accessibility option — see Open Questions) once all functions have a building home and the graphical view has been live long enough to trust.

## Open Questions

- Is the text-panel "List View" toggle a permanent accessibility feature, or a temporary migration aid to be removed once the city view is trusted? Leaning toward permanent — pixel-art click targets are inherently harder for screen readers and precise-pointer-difficulty players than a text list with real `<button>` elements, and the existing MVP UI is already fully keyboard/screen-reader-workable via semantic HTML; losing that entirely for a visual-only interaction model would be a real regression, not just a style change.
- Should building icons show at-a-glance state (e.g. the Church's completion % as a partial-fill visual, the way the map already shows route danger via color) or only reveal detail on click? Leaning toward "yes for at least Church completion and Warehouse count," matching the existing map's philosophy of surfacing state visually rather than requiring a click to discover it — but this needs its own small pass per building once each is implemented, not a single blanket rule decided here.
- One shared building layout template vs. slightly different building *sets* per city is already decided (Non-Goals — shared layout, different sets); should the five cities differ in building *position* too (Lübeck's Church always top-left, say), or should layout be fully identical and only presence/absence vary? Leaning toward identical positions for predictability (a returning player shouldn't have to relearn where the Shipyard is in each city), but worth deciding deliberately rather than by default once building count/set is finalized.
- This is a big enough rendering/interaction-architecture change that it likely deserves its own ADR once a specific implementation plan is committed to (extending ADR-003's rendering approach and ADR-005's art style to a second scene type) — not written now since nothing is decided yet, per the project's own "ADRs record decisions, not proposals" convention.

## Related

- `docs/design/map-view.md` (the `MapScene`/`drawPixelSprite` architecture this proposes reusing directly)
- ADR-003 (Rendering approach — PixiJS), ADR-005 (Art style — procedural pixel art)
- ADR-017 (Ship-animation lifecycle — the persistent-overlay pattern proposed here for building panels)
- `docs/design/church-donations.md`, `docs/design/banking-loans.md`, `docs/design/insurance.md`, `docs/design/crew-management.md`, `docs/design/warehouses.md`, `docs/design/ship-stats.md` (Renaming Ships, Buying & Selling Cannons), `docs/design/political-rank.md` (every function this doc gives a building to)
- `docs/design/family-succession.md` (Merchant's House — the one building not tied to a city-provided service)
