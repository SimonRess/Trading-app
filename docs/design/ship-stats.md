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
```

---

## Open Questions

- Is 10 durability damage per storm the right amount? At that rate a ship on the Riga route in Winter can lose 75 durability in 3 turns — near-critical after one winter run. May need playtesting.
- Should repair be available at all 5 cities, or only at designated shipyard cities (Lübeck, Danzig, Hamburg)?
- Should the MVP include a shipyard UI at all, or just auto-repair at the start of each port visit (charging automatically)?

## Related

- ADR-010 (Combat — cannon capacity interacts with cargo; crew field needed before v2)
- docs/design/city-graph.md (storm risk per route; damage applied per transit turn)
- docs/design/mvp-scope.md (Kogge-only for MVP; max 3 ships)
- docs/design/turn-resolution-order.md (step 4: storm damage resolved on arrival)
- `src/game/data/ships.ts` (implementation target — does not exist yet)
