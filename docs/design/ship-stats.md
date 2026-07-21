# Design: Ship Stats & Costs

**Status:** Draft  
**Last updated:** 2026-07-18

## Purpose

Define the stats, costs, and capacity of every ship type in the game. Originally scoped as "Kogge only in MVP, additional types in v1.1" — the Hulk and Schnigge were implemented ahead of schedule alongside the Kogge (see `mvp-scope.md`'s note on this).

---

## Ship Types

The Kogge is the Hanseatic workhorse: reliable, widely available, and affordable for a starting merchant. The Hulk and Schnigge trade capacity for speed in opposite directions.

| Stat | Kogge | Hulk | Schnigge |
|------|-------|------|----------|
| **Cargo capacity** | 50 last | 100 last | 20 last |
| **Speed** | Baseline (1×) | 1.5× slower | 2× faster |
| **Purchase price** | 400 Mark | 800 Mark | 250 Mark |
| **Repair cost** | 2 Mark/durability point | 2 Mark/durability point | 2 Mark/durability point |

Shared across all types:

| Stat | Value | Notes |
|------|-------|-------|
| **Durability** | 100 max | Damaged by storms and (v2) combat; repaired at shipyard |
| **Crew requirement** | Abstracted | MVP: no per-turn wage cost, no per-type crew difference |
| **Purchase location** | Any shipyard city (Lübeck, Danzig, Hamburg) | See `SHIPYARD_CITIES` |
| **Max ships (fleet-wide)** | 3 | Balance cap, shared across all types, not per-type |

The Schnigge makes short routes (Hamburg–Lübeck) faster but carries less cargo. The Hulk makes long eastern routes (Lübeck–Riga) viable as bulk runs but risks more turns in Winter storm windows (twice as many transit turns → twice as many chances for the per-turn storm/pirate event roll to catch it, per ADR-015).

### Speed model

Route travel time (`route.turns` in `routes.ts`) is calibrated to the **Kogge**, per the earlier fix to the "doubled travel time" bug (see `city-graph.md` Implementation Status). Other ship types scale that baseline by a speed ratio relative to the Kogge, not by an independent per-type constant:

```
speedRatio(type) = SHIP_TYPES[type].turnsPerLeg / SHIP_TYPES.kogge.turnsPerLeg
turns = max(1, round(route.turns × speedRatio(type))) + durabilityTravelTimePenalty(durability)
```

A Kogge's ratio is exactly 1.0 (no change from the route table). A Hulk (`turnsPerLeg: 3`) is 1.5×; a Schnigge (`turnsPerLeg: 1`) is 0.5×, floored at 1 turn so no route becomes instantaneous.

### Durability thresholds

| Durability | Ship status | Effect |
|-----------|-------------|--------|
| 76–100 | Seaworthy | No penalty |
| 51–75 | Worn | Storm damage chance +5% on all routes |
| 26–50 | Damaged | Storm damage chance +10%; travel time +1 turn per leg |
| 1–25 | Critical | Cannot depart; must be repaired before next voyage |
| 0 | Wrecked | Ship and all cargo lost; removed from fleet |

### Storm damage

Per the city-graph.md storm risk table, when a storm event fires during transit the ship takes **10 durability damage** (revised from 5 in mvp-scope.md — 5 was too minor to create meaningful decisions around repair).

---

## Net Worth Calculation

Ships contribute to the player's net worth for win/lose evaluation:

```
ship_value = purchase_price × (durability / 100)
```

A fully intact Kogge is worth 400 Mark. A critical Kogge (25 durability) is worth 100 Mark.

Ship value is one of the three components of total net worth (cash + ship value + cargo value). Cargo is valued at each good's fixed base price. See **ADR-014** and `mvp-scope.md` for the full net-worth definition.

---

## v2 Combat Additions

When ADR-010 is implemented, the following fields are added to `Ship`:

```typescript
crew: number;         // sailor count; affects combat power
cannons: number;      // each cannon uses 2 last of cargo capacity
posture: 'aggressive' | 'defensive' | 'flee';
```

The `cargo` capacity available for goods = `50 - (cannons × 2)`. This is why `cannons` must be tracked on the ship even before combat is implemented — it affects the cargo capacity calculation.

### Buying & Selling Cannons (Proposed, v2 — pulled forward ahead of full combat)

**Status:** Proposed — not implemented.

Full combat resolution (ADR-010's posture/power-roll flow) is a larger, separate implementation effort, but the **cannon-purchasing half** of ADR-010's pre-battle preparation phase can land independently and earlier — the same "implement the buildable/tradeable part ahead of the mechanic that consumes it" pattern already used for Hulk/Schnigge (bought forward from v1.1 into the MVP pass) and ship buying/repair generally. A ship can carry cannons, at the cost of cargo space, before combat itself exists to use them — they'd simply do nothing yet, same as `politicalRank`/`reputation` sat unused in the state shape for a long stretch before `political-rank.md` gave them a purpose.

- Available at shipyard cities only (`SHIPYARD_CITIES`), a "Weapons" control alongside Buy/Repair/Crew in the Shipyard section: buy/sell cannons one at a time for the selected ship, each purchase costing a flat price (proposed: 150 Mark) and immediately reducing that ship's usable cargo capacity by 2 last (`cargoSpace` — already the single function everything else reads for capacity checks, per `fleet-system.ts` — needs to subtract `cannons × 2`, the same formula ADR-010 already specifies).
- Selling refunds a fraction of the purchase price (proposed: 60%, same one-way-friction spirit as warehouse resale and crew severance) and immediately frees the cargo space back up.
- **Guardrail:** selling cannons (or buying more) must respect currently-held cargo — a ship loaded near its current capacity cannot buy a cannon that would push held cargo over the new, smaller limit. Buying should be rejected (same pattern as `executeBuy` already rejecting a purchase that exceeds `cargoSpace`) rather than silently overflowing.
- No posture, no combat power calculation, no enemy encounters in this pass — cannons are purely a cargo-for-a-number-that-does-nothing-yet trade until full combat (ADR-010's actual resolution flow) is implemented on top.

**Open Questions:**
- Cannon price (150 Mark) and resale fraction (60%) are placeholder numbers, unvalidated — same caveat as every other numeric proposal in this doc set.
- Is there a per-ship cannon cap tied to ship type (a Schnigge, with only 20 last capacity total, can't sensibly carry many cannons before having no room for cargo at all) — proposed caps: Kogge 6, Hulk 8, Schnigge 3, roughly matching each type's proportion of total capacity, but unvalidated.

---

## Data Model

```typescript
// Already in src/game/state/types.ts — Ship interface
// Additions needed before v2:
interface Ship {
  id: string;
  name: string;
  type: ShipType;
  durability: number;       // 0–100
  position: CityId | RoutePosition;
  cargo: Partial<Record<GoodId, number>>;
  // v2 additions:
  // crew: number;
  // cannons: number;
  // posture: CombatPosture;
}

interface ShipTypeDefinition {
  type: ShipType;
  name: string;
  cargoCapacity: number;
  turnsPerLeg: number;       // used only via speedRatio(), never route.turns × turnsPerLeg directly
  purchasePrice: number;
  repairCostPerPoint: number;
  description: string;
}

export const SHIP_TYPES: Record<ShipType, ShipTypeDefinition> = {
  kogge: {
    type: 'kogge', name: 'Kogge',
    cargoCapacity: 50, turnsPerLeg: 2, purchasePrice: 400, repairCostPerPoint: 2,
    description: 'The Hanseatic workhorse. Reliable and affordable.',
  },
  hulk: {
    type: 'hulk', name: 'Hulk',
    cargoCapacity: 100, turnsPerLeg: 3, purchasePrice: 800, repairCostPerPoint: 2,
    description: 'Large hauler. Twice the hold of a Kogge, but slower.',
  },
  schnigge: {
    type: 'schnigge', name: 'Schnigge',
    cargoCapacity: 20, turnsPerLeg: 1, purchasePrice: 250, repairCostPerPoint: 2,
    description: 'Fast courier. Half the travel time of a Kogge, small hold.',
  },
};

export function speedRatio(type: ShipType): number {
  return SHIP_TYPES[type].turnsPerLeg / SHIP_TYPES.kogge.turnsPerLeg;
}

export const SHIPYARD_CITIES: CityId[] = ['lubeck', 'danzig', 'hamburg'];
export const MAX_SHIPS = 3;
```

---

## Shipyard: Buying & Repairing (implemented)

Both actions are only available while a ship is **in port at a shipyard city** (`SHIPYARD_CITIES`), shown as a "Shipyard" section in the port view.

- **Buy ship** — the Shipyard section shows a card per ship type (capacity, price, speed relative to the Kogge — "standard speed" / "1.5x slower" / "2x faster", derived from `speedRatio()` — and a one-line description) with its own Buy button, each independently disabled if the fleet is at `MAX_SHIPS` (3, shared across all types) or the player can't afford that specific type. Spawns a new ship of the chosen type at full durability and empty cargo in the current port.
- **Repair ship** — repairs the *selected* ship to full (100) durability for `(100 - durability) × repairCostPerPoint` Mark (same rate for every type). There is no partial-repair control in the MVP UI — it is full-repair-or-nothing, which keeps the interaction to a single button and avoids needing a repair-quantity input alongside the existing buy/sell quantity inputs.

This resolves the two open questions below: repair (and purchase) are restricted to the three designated shipyard cities, not all five, and the MVP does include a manual shipyard UI rather than automatic charge-on-visit — automatic repair was rejected because it would silently spend the player's cash without an explicit decision point.

## Renaming Ships (Proposed, v1.1)

Ships get a name from a small fixed list at creation (`nextShipName` in `ships.ts`) and nothing lets the player change it afterward. Proposed: a simple text input in the fleet panel (or ship-selection area) for the currently-selected ship, free (no cash cost — this is flavor, not an economic decision) and unrestricted (any non-empty string, no uniqueness requirement across the fleet — two ships can share a name, matching how nothing else in the data model assumes uniqueness). A `RENAME_SHIP { shipId, name }` `GameAction` sets `Ship.name` directly; no other state changes. No open design questions — this is a small, low-risk feature, more an implementation task than something needing a dedicated design doc.

## Implementation Status (as of 2026-07-18)

- ✅ Buy ship (all three types), repair ship, shipyard-city restriction, `MAX_SHIPS` cap — implemented (`src/game/data/ships.ts`, `executeBuyShip`/`executeRepairShip` in `turn-system.ts`; `BUY_SHIP` `GameAction` now carries a `shipType` field)
- ✅ **Durability-threshold effects are implemented** (ADR-015): `canDepart` blocks Critical/Wrecked ships from receiving new sail orders (`setDestination` in `fleet-system.ts` returns the ship unchanged; the port UI shows an explicit "cannot depart" warning instead of the destination buttons); `durabilityTravelTimePenalty` adds +1 turn for a Damaged ship; `durabilityStormChancePenalty` (0/0.05/0.10 for Seaworthy/Worn/Damaged) feeds both the storm event's pool-selection weight and its per-ship damage formula — see `event-table.md` "Per-Route & Session Risk". The UI shows a durability status label (Seaworthy/Worn/Damaged/Critical) on every ship card.
- ✅ Per-route/season storm risk (`city-graph.md`) and the new `pirateRisk` table are both consumed by the event system — see ADR-015 and `event-table.md`. Storm damage per ship now ranges 6–22 based on route risk and durability, rather than a flat 10 to every ship in transit.
- ✅ **Hulk and Schnigge are implemented** (pulled forward from v1.1, alongside the Kogge) — `speedRatio()` scales route travel time relative to the Kogge baseline; the UI destination-time preview (`shipTravelTurns()` in `App.svelte`) was initially found to still show the Kogge's time for other ship types (a real bug caught via a live-browser check before shipping) and has been fixed to match.
- ❌ Wrecked-ship "full repair for 200 Mark" language does not apply in practice — a wrecked ship (0 durability) is removed from the fleet entirely (`fleet-system.ts` `applyStormDamage`), so there is nothing left to repair. Buying a replacement ship is the only recovery path.

## Related

- ADR-010 (Combat — cannon capacity interacts with cargo; crew field needed before v2)
- ADR-015 (Per-route & session event risk — durability thresholds and storm-risk consumption)
- docs/design/city-graph.md (storm/pirate risk per route; Kogge-calibrated `route.turns`)
- docs/design/mvp-scope.md (ship types now implemented ahead of schedule; max 3 ships fleet-wide)
- docs/design/turn-resolution-order.md (step 4: storm damage resolved on arrival)
- docs/design/event-table.md (storm damage formula, durability-driven event weighting)
- `src/game/data/ships.ts`, `src/game/systems/turn-system.ts` (`executeBuyShip`, `executeRepairShip`)
