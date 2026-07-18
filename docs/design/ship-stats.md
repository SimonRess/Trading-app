# Design: Ship Stats & Costs

**Status:** Draft  
**Last updated:** 2026-07-14

## Purpose

Define the stats, costs, and capacity of every ship type in the game. In the MVP only the Kogge is available. Additional types unlock in v1.1+.

---

## MVP — Kogge Only

The Kogge is the workhorse of the Hanseatic League: reliable, widely available, and affordable for a starting merchant.

| Stat | Value | Notes |
|------|-------|-------|
| **Cargo capacity** | 50 last | Total hold space for all goods combined |
| **Speed** | 1 leg per 2 turns | Applied when calculating route travel time (see city-graph.md) |
| **Durability** | 100 max | Damaged by storms and (v2) combat; repaired at shipyard |
| **Crew requirement** | 8 sailors min | MVP: crew is abstracted; no per-turn wage cost in MVP |
| **Purchase price** | 400 Mark | Bought at any city with a shipyard (Lübeck, Danzig, Hamburg) |
| **Repair cost** | 2 Mark per durability point | Paid at a shipyard; full repair of a wrecked ship costs 200 Mark |
| **Max ships (MVP)** | 3 | Balance cap; lifted in v1.1 |

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

## Post-MVP Ship Types (v1.1)

Not implemented in MVP. Defined here so future work has a reference point.

| Type | Capacity | Speed | Purchase price | Notes |
|------|----------|-------|---------------|-------|
| Kogge | 50 last | 1 leg / 2 turns | 400 Mark | MVP workhorse |
| Hulk | 100 last | 1 leg / 3 turns | 800 Mark | Large hauler; slow |
| Schnigge | 20 last | 1 leg / 1 turn | 250 Mark | Fast courier; small hold |

The Schnigge makes short routes (Hamburg–Lübeck) faster but carries less cargo. The Hulk makes long eastern routes (Lübeck–Riga) viable as bulk runs but risks more turns in Winter storm windows.

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
  cargoCapacity: number;
  turnsPerLeg: number;
  purchasePrice: number;
  repairCostPerPoint: number;
}

export const SHIP_TYPES: Record<ShipType, ShipTypeDefinition> = {
  kogge: {
    type: 'kogge',
    cargoCapacity: 50,
    turnsPerLeg: 2,
    purchasePrice: 400,
    repairCostPerPoint: 2,
  },
};

export const SHIPYARD_CITIES: CityId[] = ['lubeck', 'danzig', 'hamburg'];
export const MAX_SHIPS = 3;
```

---

## Shipyard: Buying & Repairing (implemented)

Both actions are only available while a ship is **in port at a shipyard city** (`SHIPYARD_CITIES`), shown as a "Shipyard" section in the port view.

- **Buy ship** — costs `purchasePrice` (400 Mark for a Kogge), spawns a new ship at full durability and empty cargo in the current port. Blocked once the fleet reaches `MAX_SHIPS` (3), regardless of cash.
- **Repair ship** — repairs the *selected* ship to full (100) durability for `(100 - durability) × repairCostPerPoint` Mark. There is no partial-repair control in the MVP UI — it is full-repair-or-nothing, which keeps the interaction to a single button and avoids needing a repair-quantity input alongside the existing buy/sell quantity inputs.

This resolves the two open questions below: repair (and purchase) are restricted to the three designated shipyard cities, not all five, and the MVP does include a manual shipyard UI rather than automatic charge-on-visit — automatic repair was rejected because it would silently spend the player's cash without an explicit decision point.

## Implementation Status (as of 2026-07-18)

- ✅ Buy ship, repair ship, shipyard-city restriction, `MAX_SHIPS` cap — implemented (`src/game/data/ships.ts`, `executeBuyShip`/`executeRepairShip` in `turn-system.ts`)
- ✅ **Durability-threshold effects are implemented** (ADR-015): `canDepart` blocks Critical/Wrecked ships from receiving new sail orders (`setDestination` in `fleet-system.ts` returns the ship unchanged; the port UI shows an explicit "cannot depart" warning instead of the destination buttons); `durabilityTravelTimePenalty` adds +1 turn for a Damaged ship; `durabilityStormChancePenalty` (0/0.05/0.10 for Seaworthy/Worn/Damaged) feeds both the storm event's pool-selection weight and its per-ship damage formula — see `event-table.md` "Per-Route & Session Risk". The UI shows a durability status label (Seaworthy/Worn/Damaged/Critical) on every ship card.
- ✅ Per-route/season storm risk (`city-graph.md`) and the new `pirateRisk` table are both consumed by the event system — see ADR-015 and `event-table.md`. Storm damage per ship now ranges 6–22 based on route risk and durability, rather than a flat 10 to every ship in transit.
- ❌ Wrecked-ship "full repair for 200 Mark" language does not apply in practice — a wrecked ship (0 durability) is removed from the fleet entirely (`fleet-system.ts` `applyStormDamage`), so there is nothing left to repair. Buying a replacement ship is the only recovery path.

## Related

- ADR-010 (Combat — cannon capacity interacts with cargo; crew field needed before v2)
- ADR-015 (Per-route & session event risk — durability thresholds and storm-risk consumption)
- docs/design/city-graph.md (storm/pirate risk per route)
- docs/design/mvp-scope.md (Kogge-only for MVP; max 3 ships; repair/buy now implemented)
- docs/design/turn-resolution-order.md (step 4: storm damage resolved on arrival)
- docs/design/event-table.md (storm damage formula, durability-driven event weighting)
- `src/game/data/ships.ts`, `src/game/systems/turn-system.ts` (`executeBuyShip`, `executeRepairShip`)
