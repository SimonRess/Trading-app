# Design: Ship Convoys

**Status:** Implemented (v1.4) — game logic, combat, trading distribution, and UI all live. Data model and ship-addressing: ADR-023 (Accepted). Manually verified live via dev server + Playwright (2026-08-02): create a 2-ship convoy in port, drill into members, exclude a ship, set a convoy-wide destination, toggle posture, and buy goods as a convoy (distributed proportionally across members, single stepped market trade) — see "Implementation Status" below for the two intentional scope narrowings.

### Implementation Status

- The List-view Port screen's persistent trade panel offers convoy-wide trading, destination, and posture, but not a duplicate of the per-ship Shipyard repair/crew/cannon block for convoy members — drill into a member ship (clears convoy selection) to reach those, which is unaffected by convoy membership per this doc's own design.
- Convoy destination buttons don't show a travel-time preview in the way per-ship ones do (`shipTravelTurns` needs a `Ship`, not a convoy) — the actual travel time (slowest member, applied uniformly) is still computed correctly by `executeSetConvoyDestination`; only the pre-order UI preview is omitted.
- Both remaining Open Questions below (posture persistence after leaving convoy, auction-while-convoyed) resolved to the "leaning" answer already written: posture stays frozen at whatever the convoy last had, and auctioning a convoyed ship is not offered (exclude first).

## Purpose

Once a player has more than 2-3 ships, the fleet panel becomes a wall of individual ship cards, each needing its own destination order and trade decisions every turn. Convoys let a player group several ships so they travel, fight, and trade as one unit, collapsing the fleet overview to one entry per convoy while still allowing drill-down to individual ships for repair, crew, and weapons.

## Inputs & Outputs

**Reads:** `GameState.fleet.ships`, market state (for convoy-wide trading), risk state (for convoy-wide combat).
**Produces/modifies:** a new `FleetState.convoys` list; ship positions/destinations (moved together); ship cargo (distributed after a convoy trade); ship durability/cargo (combat outcome applied per ship).

## Data Model

```typescript
interface Convoy {
  id: string;
  name: string;              // player-editable, e.g. "1st Convoy"; a sensible default is generated on creation
  shipIds: string[];         // member ships, order not meaningful
  posture: Ship['posture'];  // convoy-wide posture — see "Combat" below
}

// FleetState gains:
interface FleetState {
  ships: Ship[];              // unchanged — every ship still lives in one flat list
  convoys: Convoy[];          // additive
}
```

A ship's own `Ship` type is **unchanged** — no `convoyId` field on `Ship`. Membership is looked up by scanning `convoys` for a `shipIds` match, matching this codebase's existing pattern for grouping (`CityEffect[]`, `PendingSuccession.candidates`) rather than a normalized back-reference. A ship not listed in any convoy's `shipIds` sails, fights, and trades individually exactly as today — convoys are opt-in, not a replacement for the existing single-ship model.

**Ship-to-convoy is many-to-one, enforced at the action level**: `executeAddShipToConvoy` removes the ship from any other convoy's `shipIds` first, so a ship is never in two convoys at once.

## Core Logic

### Grouping / ungrouping

- `CREATE_CONVOY { shipIds }` — creates a `Convoy` from 2+ ships **currently in the same port** (can't convoy a ship that's at sea or in a different city — they have to physically be together to group up). Rejects with fewer than 2 ships (a "convoy" of one is just a ship).
- `ADD_SHIP_TO_CONVOY { convoyId, shipId }` — only from the same port the convoy's ships are currently in.
- `REMOVE_SHIP_FROM_CONVOY { convoyId, shipId }` ("exclude", per the request) — the ship leaves the convoy and becomes independent again, keeping its current position/durability/cargo/cannons/crew exactly as they were; only removable while the convoy is **in port** (excluding mid-voyage isn't offered — see Edge Cases). A convoy dropping to 1 remaining ship auto-dissolves (the `Convoy` record is removed, the last ship becomes independent).
- Dissolving a convoy (`DISSOLVE_CONVOY`) removes the `Convoy` record; every member ship becomes independent, keeping its own state.

### Travel — convoy ships behave as one ship (confirmed)

- **`SET_DESTINATION` becomes convoy-wide**: setting a destination for a convoy sets the same destination for every member ship simultaneously, one action instead of N.
- **Travel time = the slowest member's travel time.** Reuses the existing per-ship formula (`shipTravelTurns` — base route turns × `speedRatio(shipType)`, plus `durabilityTravelTimePenalty`) computed independently for each member ship to the destination, then takes the **max** across the convoy — a convoy moves at the pace of its slowest or most damaged ship, same as the real-world reasoning for why convoys exist. All member ships arrive together on that turn.
- **`canDepart` gates the whole convoy**: if any single member ship is `critical`/`wrecked` durability, the entire convoy cannot depart until that ship is repaired or excluded — a convoy is only as seaworthy as its weakest ship. (This creates a real strategic tension: repair the straggler, exclude it and leave it behind, or wait.)

### Combat — convoy ships fight as one unit (confirmed)

- **Pirate targeting**: `pickPirateTarget` (`event-system.ts`) is extended to consider a convoy's member ships as a single target once any of them is selected — i.e. pirates intercept the *convoy*, not one ship within it.
- **Convoy-wide posture**: `Convoy.posture` (Aggressive/Defensive/Flee) applies to the whole convoy for the encounter; individual `Ship.posture` is not read for combat while a ship is convoyed (see Open Questions for what happens to a ship's individual posture setting when it later leaves the convoy).
- **Aggregate combat power**: `playerCombatPower` sums across every member ship — `Σ(cannons × 10) + Σ(crew × 2) + posture_modifier` (the posture modifier applies once, from the convoy's posture, not per ship) — a convoy is genuinely stronger than the sum of its ships fighting separately would suggest under the current per-ship formula, which is the point of grouping up for a dangerous route.
- **One `resolveCombat` roll for the convoy** (player power vs. one rolled enemy power), same outcome types (victory/retreat/defeat/flee).
- **Effects distribute per ship**: the resolved `durabilityLoss` and `cargoLossFraction` are applied to **every member ship independently**, the same way a solo ship's combat outcome is applied today (`applyCombatOutcome`, `fleet-system.ts`) — each ship takes the same percentage/flat loss, and any ship whose durability reaches 0 sinks individually. A convoy defeat can sink an already-weak ship while stronger convoy-mates survive damaged; it does not automatically sink the whole convoy at once. Victory loot is rolled once and distributed via the same distribution algorithm as a convoy trade (below), not duplicated per ship.

### Trading — convoy-wide goods, per-ship weapons/crew/repair (confirmed)

- **Repair, crew hire/release, cannon buy/sell stay per-ship**, reached by drilling into the convoy's ship list — these are physical actions on one hull, no reason to convoy them.
- **Buying/selling goods is convoy-wide**: a single `BUY_GOOD`/`SELL_GOOD`-style order against a convoy specifies a total quantity; the trade resolves as **one `resolveTradeStepped` call against the market for the full quantity** (confirmed: single stepped trade, not N separate per-ship trades that would each price differently), then the resulting goods (buy) or removed goods (sell) are **distributed across member ships' cargo holds**.
- **Distribution algorithm — proportional by default, interchangeable** (confirmed): a convoy buy of a good splits proportionally to each ship's *remaining* cargo space at the moment of the trade (a ship with more free room gets a proportionally larger share); a sell pulls proportionally from each ship's *held quantity* of that good. Implemented as a swappable strategy, not hardcoded into the trade function:

  ```typescript
  type ConvoyDistributionStrategy = (
    ships: Ship[],
    goodId: GoodId,
    totalQty: number,
    direction: 'buy' | 'sell',
  ) => Record<string, number>; // shipId -> quantity assigned

  export const PROPORTIONAL_DISTRIBUTION: ConvoyDistributionStrategy = (ships, goodId, totalQty, direction) => { /* ... */ };
  ```

  `executeConvoyBuy`/`executeConvoySell` take a strategy as a parameter (defaulting to `PROPORTIONAL_DISTRIBUTION`), so a future alternate (fill-fullest-first, round-robin, manual player allocation) is a new function passed in, not a rewrite of the trade logic itself.
- A convoy buy is capped by the **sum of all member ships' remaining cargo space** (not any single ship's); if the requested quantity doesn't fit even split proportionally, the order is capped the same way a single ship's buy is already capped by its own `cargoSpace`.

## UI Design (2026-08-02)

Builds on ADR-023's `selectedConvoyId`/`activeConvoy` note. Two existing surfaces already list ships and both need convoy-awareness: the persistent `.fleet-panel` sidebar (List-view, `App.svelte` ~L1178) and the Harbor building's `.fleet-list` (City-view, ~L665) — both currently render one flat `.ship-card` per ship in `state.fleet.ships`.

### Fleet list: grouped rendering

Both surfaces switch from `{#each state.fleet.ships as s}` to a partition computed once (`$: fleetGroups = groupShipsByConvoy(state.fleet.ships, state.fleet.convoys)`, a small pure helper returning `{ convoy: Convoy; ships: Ship[] }[]` plus a leftover `independentShips: Ship[]`):

- **Independent ships** render exactly as today — one flat `.ship-card`, unchanged markup, unchanged click behavior (`selectedShipId = s.id`).
- **Each convoy** renders one new `.convoy-card`, collapsed by default, showing: convoy name, member count ("3 ships"), the group's current position/destination (identical for every member by construction), a combined durability indicator (worst member's status — "1 ship damaged" if any member isn't full/healthy, since that's the ship holding the whole convoy back per `canDepart`), and a fold chevron — visually the same collapse affordance the `.fleet-panel` itself already uses (`fold-btn`/`fleetCollapsed`), applied one level deeper.
- Clicking the `.convoy-card` body (not the chevron) sets `selectedConvoyId = convoy.id` and clears `selectedShipId` — this convoy becomes `activeConvoy`, driving the Harbor/Trading Post panels (below).
- Clicking the chevron expands the card in place, revealing each member's existing `.ship-card` nested/indented beneath it, each still independently clickable (`selectedShipId = s.id`, clears `selectedConvoyId`) — selecting a specific ship this way is how Shipyard actions (repair/crew/cannons/rename/auction) target it, unchanged from today. Each expanded member row also gets an **"Exclude"** button (`REMOVE_SHIP_FROM_CONVOY`), only enabled while the convoy is in port, per the design doc's "Grouping/ungrouping" rule.

### Selection state (`App.svelte`)

```
let selectedShipId: string;      // existing
let selectedConvoyId: string | undefined;  // new
$: activeShip = ...              // existing, unchanged
$: activeConvoy = state.fleet.convoys.find(c => c.id === selectedConvoyId);
```

Exactly one of `selectedShipId`/`selectedConvoyId` is meaningfully "active" at a time (selecting either clears the other, per the click handlers above) — mirrors the existing single-`activeShip` pattern rather than introducing a combined "current selection" type, keeping every existing `activeShip`-reading template expression valid unchanged.

### Harbor panel (Set Destination) — convoy-aware

`{#if activeConvoy}` branch, parallel to the existing `{#if activeShip && portCity}` one: shows the same `reachableCities()` list (route-graph-only, doesn't depend on ship type — safe to call with any one member ship, since convoy members are always co-located) but dispatches `SET_CONVOY_DESTINATION` instead of `SET_DESTINATION`; the displayed travel-time-per-destination uses the slowest-member calculation from "Core Logic" above, not a single ship's `shipTravelTurns`. The existing "critically damaged, cannot depart" note becomes "cannot depart — `{shipName}` is critically damaged" naming whichever member is holding the convoy back, reusing this doc's Harbor-panel rescue-Auction pattern (v1.2) for that specific ship if it's stuck at a non-shipyard city — the fix already shipped for solo ships applies unchanged since that ship's `executeAuctionShip` call doesn't care whether it's convoyed (see "Auctioning a convoyed ship" below).

### Trading Post panel — convoy-wide buy/sell

`TradeTable.svelte` (the shared component from v1.2) is extended, not duplicated: it already takes an optional `ship: Ship | undefined` prop to decide whether to render the In-hold/Buy/Sell columns at all. It gains a second, mutually-exclusive way to supply that data:

```typescript
export let ship: Ship | undefined = undefined;        // existing
export let convoyCargo: Partial<Record<GoodId, number>> | undefined = undefined;  // new
export let convoyCargoSpace: number | undefined = undefined;                      // new
```

When `convoyCargo`/`convoyCargoSpace` are supplied instead of `ship`, the In-hold column reads from `convoyCargo` (summed across every member ship, computed by the caller) and the Buy button's disabled check uses `convoyCargoSpace` (summed remaining capacity) instead of `cargoSpace(ship)`. The dispatched `buy`/`sell`/`sellAll` events are unchanged (`goodId` only) — `App.svelte` decides whether to send `BUY_GOOD`/`SELL_GOOD` (ship active) or `CONVOY_BUY_GOOD`/`CONVOY_SELL_GOOD` (convoy active) based on which of `activeShip`/`activeConvoy` is set, the same branching pattern as the Harbor panel above. This keeps the "one shared table component" fix from v1.2 intact — a convoy-mode trading table is a new *prop combination* on the existing component, not a second copy of it.

### Shipyard panel — unaffected in single-ship mode; convoy posture moves here

Repair/rename/crew/cannon controls are reached exactly as today, only once a specific member ship is selected via the expanded convoy card (or a fully independent ship) — no changes to those action bodies or their markup. The one addition: while `activeConvoy` is set (convoy card selected, not expanded to a member), the Shipyard panel shows a **single convoy-wide posture selector** (`SET_CONVOY_POSTURE`) instead of a per-ship one, since posture is convoy-wide per the Core Logic section — individual members' posture controls are hidden while grouped (their `Ship.posture` field still exists underneath, per the "posture persistence" Open Question below, just not shown/editable directly).

### Creating a convoy

A new **"Group into Convoy"** toggle button in the Harbor panel (only shown when 2+ ships are docked in the same port as `portCity`): toggling it adds a checkbox to each in-port `.ship-card`; checking 2+ and confirming sends `CREATE_CONVOY { shipIds }` with a text input for the convoy's name (defaulting to "Convoy N", the open naming question from below, resolved here as the simplest option since nothing in the request asked for anything fancier). Ships already in a different convoy, or docked elsewhere, or at sea, aren't offered a checkbox — matches "Grouping/ungrouping"'s same-port rule.

## Edge Cases

- **A ship joins/leaves mid-voyage**: not offered. Convoy membership can only change while every member is in the same port (see "Grouping/ungrouping" above) — no mid-transit split, matching the "ships in a convoy are physically together" premise.
- **All member ships sink in one battle**: the `Convoy` record is removed once `shipIds` is empty (same as dropping to 0, distinct from dropping to exactly 1 which auto-dissolves back to an independent ship).
- **A convoy with ships of very different speeds** (e.g. a Kogge + a Hulk): intentional — the whole point of the max-travel-time rule is that grouping a fast ship with a slow one costs the fast ship its speed advantage while convoyed. A player optimizing for speed should keep that ship independent.
- **Auctioning a convoyed ship**: unresolved — see Open Questions.
- **Renaming**: unaffected: a convoy has its own `name`, a member ship keeps its own `name` independently (shown when drilled into).

## Open Questions

- **What happens to a convoyed ship's individual `posture` field?** It's not read while convoyed (the convoy's own posture is used instead), but does it stay frozen at whatever it was when the ship joined, or reset to a default when the ship later leaves the convoy? Leaning toward "frozen, unchanged" (simplest, no surprise state change) but not decided.
- **Can a ship in a convoy be auctioned individually** (`executeAuctionShip`), or must it be excluded from the convoy first? Leaning toward "must exclude first" (keeps the "auction requires being addressed as a single ship" invariant clean, and the UI design above only shows the Auction control on an independent/expanded-and-selected member ship's own Shipyard panel, which already implies it — but the game-logic layer doesn't currently *enforce* exclusion-first, so this is still a decision to make, not just a UI default).
- **Save schema**: `FleetState.convoys` is a new field — additive (defaults to `[]` for older saves, same pattern as `chronicle`/`achievements`), no schema bump needed, but `save-file-schema.md` needs a new row when this ships.

## Related

- `docs/design/roadmap-next-versions.md` item 9 (v1.3) — this doc's origin; also holds a note that this is where "saved/repeating trade routes" was demoted to item 9c after this feature took its number
- `docs/design/ship-stats.md` "Combat" — the per-ship combat model this doc extends to convoy-wide aggregation
- `docs/design/market-formula.md` "Bulk-Purchase Price Pressure" (`resolveTradeStepped`) — the single-stepped-trade mechanism a convoy buy/sell reuses
- `ADR-010` (combat mechanic) — the per-ship power formula this doc sums across a convoy
- `ADR-023` — the convoy data model and ship-addressing decision (`FleetState.convoys`, no `convoyId` on `Ship`, new convoy-addressed action variants alongside the existing ship-addressed ones)
- `docs/design/city-view.md` and `TradeTable.svelte` (v1.2) — the shared trading-table component this doc's "UI Design" section extends with a `convoyCargo`/`convoyCargoSpace` prop pair rather than duplicating
