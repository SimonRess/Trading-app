# Design: Ship Convoys

**Status:** Draft — decisions below reflect direct player answers to the design questions raised when this item was proposed (2026-08-02); not yet implemented. Needs an ADR before implementation starts (architectural change to how ships are addressed throughout `fleet-system.ts` and the UI), per `00_project_structure.md` §5 rule 2.

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

## Edge Cases

- **A ship joins/leaves mid-voyage**: not offered. Convoy membership can only change while every member is in the same port (see "Grouping/ungrouping" above) — no mid-transit split, matching the "ships in a convoy are physically together" premise.
- **All member ships sink in one battle**: the `Convoy` record is removed once `shipIds` is empty (same as dropping to 0, distinct from dropping to exactly 1 which auto-dissolves back to an independent ship).
- **A convoy with ships of very different speeds** (e.g. a Kogge + a Hulk): intentional — the whole point of the max-travel-time rule is that grouping a fast ship with a slow one costs the fast ship its speed advantage while convoyed. A player optimizing for speed should keep that ship independent.
- **Auctioning a convoyed ship**: unresolved — see Open Questions.
- **Renaming**: unaffected: a convoy has its own `name`, a member ship keeps its own `name` independently (shown when drilled into).

## Open Questions

- **What happens to a convoyed ship's individual `posture` field?** It's not read while convoyed (the convoy's own posture is used instead), but does it stay frozen at whatever it was when the ship joined, or reset to a default when the ship later leaves the convoy? Leaning toward "frozen, unchanged" (simplest, no surprise state change) but not decided.
- **Can a ship in a convoy be auctioned individually** (`executeAuctionShip`), or must it be excluded from the convoy first? Leaning toward "must exclude first" (keeps the "auction requires being addressed as a single ship" invariant clean) but not decided.
- **Convoy naming/default name generation** — a simple "Convoy N" counter, or something more flavorful matching `nextShipName`'s style? Cosmetic, low priority.
- **UI**: the fleet panel's collapse-to-one-row-per-convoy, the drill-down view, and how "active ship" vs. "active convoy" selection interacts with the existing `selectedShipId`/`activeShip` reactive pattern in `App.svelte` are all unspecified here — this doc covers the game-logic model, not the UI implementation, which should get its own pass (likely its own section added here, or a UI-focused addendum) once the data model above is confirmed via ADR.
- **Save schema**: `FleetState.convoys` is a new field — additive (defaults to `[]` for older saves, same pattern as `chronicle`/`achievements`), no schema bump needed, but `save-file-schema.md` needs a new row when this ships.

## Related

- `docs/design/roadmap-next-versions.md` item 9 (v1.3) — this doc's origin; also holds a note that this is where "saved/repeating trade routes" was demoted to item 9c after this feature took its number
- `docs/design/ship-stats.md` "Combat" — the per-ship combat model this doc extends to convoy-wide aggregation
- `docs/design/market-formula.md` "Bulk-Purchase Price Pressure" (`resolveTradeStepped`) — the single-stepped-trade mechanism a convoy buy/sell reuses
- `ADR-010` (combat mechanic) — the per-ship power formula this doc sums across a convoy
- An ADR for the convoy data model itself is still needed before implementation (see Status above)
