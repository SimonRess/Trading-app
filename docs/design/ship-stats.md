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
| **Purchase price** | 4,000 Mark | 8,000 Mark | 2,500 Mark |
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

A fully intact Kogge is worth 4,000 Mark. A critical Kogge (25 durability) is worth 1,000 Mark. (Prices raised ×10 from the original 400/800/250 Mark — 2026-07-25, per player feedback that ship prices were too low relative to trading income.)

Ship value is one of the three components of total net worth (cash + ship value + cargo value). Cargo is valued at each good's fixed base price. See **ADR-014** and `mvp-scope.md` for the full net-worth definition.

---

## Combat (Implemented, 2026-07-25 — see ADR-010 and combat-system.ts)

`Ship` carries `crew`, `cannons`, and `posture: 'aggressive' | 'defensive' | 'flee'`. The `cargo` capacity available for goods = `50 - (cannons × 2)` (Kogge; scaled per type).

### Buying & Selling Cannons

**Status:** Implemented (first pass — thresholds not yet tuned).

- Available at shipyard cities only (`SHIPYARD_CITIES`), a "Weapons" control alongside Buy/Repair/Crew in the Shipyard section: buy/sell cannons one at a time for the selected ship, each purchase costing a flat price (150 Mark) and immediately reducing that ship's usable cargo capacity by 2 last.
- Selling refunds 60% of the purchase price and immediately frees the cargo space back up.
- **Guardrail:** buying a cannon that would push currently-held cargo over the new, smaller limit is rejected, same pattern as `executeBuy` rejecting a purchase that exceeds `cargoSpace`.
- ✅ `Ship.cannons` (additive save-file field). `CANNON_MAX`: Kogge 6, Hulk 8, Schnigge 3.
- ✅ `executeBuyCannon`/`executeSellCannon` (`turn-system.ts`), `BUY_CANNON`/`SELL_CANNON` actions.
- ✅ `cannonSellValue()` = 60% of `CANNON_PRICE`, rounded; counted in `computeNetWorth` (ADR-020).
- ✅ Every "Cargo N/M" readout shows the cannon-reduced capacity and, when the ship carries cannons, "(N used by cannons)".

### Pre-Battle Posture and Pirate Encounters

**Status:** Implemented (ADR-010's power-roll flow; first pass, not simulation-tuned).

Posture is set anytime, anywhere (not shipyard-restricted, same as insurance's toggle) via a 3-button selector in the Shipyard section — Aggressive / Defensive / Flee. When a `pirate_raid` event targets a ship (`event-system.ts`, `pickPirateTarget`), `combat-system.ts`'s `resolveCombat` decides the outcome:

- **Aggressive/Defensive:** `player_power = cannons×10 + crew×2 + posture_modifier` (aggressive +15, defensive +0) is compared against `enemy_power = rand(20,60)` scaled by the route's pirate-risk-vs-network-average factor (same normalisation `event-system.ts` already used for pirate-event weighting, duplicated in `combat-system.ts` to avoid a circular import). `diff = player_power - enemy_power + rand(-10,10)`:
  - `diff > 15` → **Victory** — captures loot: 1-2 random goods (fixed pool, not a simulated enemy cargo hold — see Open Questions) at 5-15 units each, capped by remaining cargo space.
  - `diff < -15` → **Defeat** — 20-40 durability lost, 30-50% of cargo seized. If durability reaches 0, the ship is **sunk**: removed from the fleet with all remaining cargo, same fate as a storm wreck.
  - Otherwise → **Retreat** — no durability loss, 10-20% of cargo lost.
- **Flee:** always escapes — no power roll at all — but isn't free: 20-35% of cargo is lost jettisoning to outrun pursuit, deliberately set between Retreat's and Defeat's cargo-loss ranges (explicit player direction, 2026-07-25) rather than derived from them, so tuning one doesn't silently shift the other two.
- The turn-summary message for a fought (non-flee) encounter always reports both sides' strength — `"Your strength: N vs. their strength: M"` — so the player can see why they won or lost, not just the outcome (explicit player direction, 2026-07-25).
- Insurance needs no changes: `computeInsurancePayouts` already diffs ship state generically before/after any event, so a combat-damaged insured ship is covered automatically, same as storm damage.

**Implementation Status:**
- ✅ `Ship.posture` (additive save-file field, defaults `'defensive'`). `SET_POSTURE { shipId, posture }` action, `executeSetPosture` (`turn-system.ts`).
- ✅ `combat-system.ts`: `resolveCombat`, `playerCombatPower`, pure and independently unit-tested (statistical sanity checks: an unarmed ship never wins, a well-armed aggressive ship usually does).
- ✅ `fleet-system.ts`'s `applyCombatOutcome` applies a resolved `CombatResult` to the fleet (cargo loss, loot grant capped by space, durability loss, removal on sinking) — replaces the old flat, unconditional `applyPirateRaid` (deleted; it ignored cannons/crew/posture entirely).
- ✅ Shipyard section (both City and List views) shows the posture selector with a one-line description of what each option does.
- ✅ Unit tests: `combat-system.test.ts`, `fleet-system.test.ts` (`applyCombatOutcome`), `event-system.test.ts` (`applyEvent('pirate_raid')` integration — strength reporting, flee cargo loss, sinking).
- ✅ Verified live: posture selector updates immediately; no console errors across normal play.

**Open Questions:**
- Loot is drawn from a fixed random-goods pool rather than a simulated enemy fleet with its own cargo/route/ship-type — a later pass could give pirates (and rival trading houses) actual private fleets whose composition determines what's capturable, per explicit player direction that this is deferred, not rejected.
- Cannon price (150 Mark), resale fraction (60%), and every combat-power/threshold/loss constant are first-pass numbers, unvalidated by simulation — same caveat as every other numeric proposal in this doc set.
- No way to *initiate* combat (hunt pirates) yet — encounters are always pirate-triggered.

---

## Data Model

```typescript
// src/game/state/types.ts — Ship interface (abridged; also carries insured,
// repairCooldown — see the file itself for the full, currently-accurate shape)
interface Ship {
  id: string;
  name: string;
  type: ShipType;
  durability: number;       // 0–100
  position: CityId | RoutePosition;
  cargo: Partial<Record<GoodId, number>>;
  crew: number;
  cannons: number;
  posture: 'aggressive' | 'defensive' | 'flee';
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
- **Repair ship** — repairs the *selected* ship to full (100) durability for `(100 - durability) × repairCostPerPoint` Mark (same rate for every type). There is no partial-repair control in the MVP UI — it is full-repair-or-nothing, which keeps the interaction to a single button and avoids needing a repair-quantity input alongside the existing buy/sell quantity inputs. A repaired ship also sits in dock for **1 turn** before it can depart again (`Ship.repairCooldown`, ticked down once per turn in `resolveTurn`) — a repair takes a turn, not an instant fix. (2026-07-25, per player feedback.)

This resolves the two open questions below: repair (and purchase) are restricted to the three designated shipyard cities, not all five, and the MVP does include a manual shipyard UI rather than automatic charge-on-visit — automatic repair was rejected because it would silently spend the player's cash without an explicit decision point.

## Renaming Ships (Implemented, v1.1)

Ships get a name from a small fixed list at creation (`nextShipName` in `ships.ts`); the player can now change it afterward. Implemented as proposed: a text input next to each ship in the Shipyard building (both City view and List view), free (no cash cost — flavor, not an economic decision) and unrestricted (any non-empty string up to 30 characters, no uniqueness requirement across the fleet — two ships can share a name). `executeRenameShip` (`turn-system.ts`) and the `RENAME_SHIP { shipId, name }` action set `Ship.name` directly, trimming whitespace and rejecting a blank or unchanged name; no other state changes. Unlike the doc's original "fleet panel, currently-selected ship" sketch, the control lives in the Shipyard section per-ship (matching the "Ready to extend as crew/cannons/renaming land" note left when the Shipyard building first shipped) and is **not** restricted to shipyard cities — renaming doesn't need a dry-dock, so it's available on any ship regardless of position, same reasoning as insurance's anytime-toggle. Verified live: renaming a ship updates its name immediately across the UI.

## Auctioning Ships (Implemented, 2026-07-25)

A player asked for a way to sell an unwanted ship rather than only ever buying/repairing. Each ship in the Shipyard section (both City view and List view) has an **Auction** button, available at any port (not restricted to shipyard cities — this is a sale, not a build/repair action, same reasoning as renaming). Clicking it immediately sells the ship to "the highest bidder" for `purchasePrice × 80% × (durability / 100)` (`auctionSaleValue()` in `ships.ts`) — a fully seaworthy Kogge nets 3,200 Mark, a critical one (25 durability) nets 800. The ship (and any cargo still aboard it) leaves the fleet immediately; cash is credited immediately. A popup confirms the sale with the in-game date (season + year) and the price paid.

This is a first-pass, single-step implementation: there's no real waiting period or competing-bidder simulation yet — "the highest bidder" is flavor text for an instant, deterministic sale. A later pass could spread this over a few turns (mirroring the church-donation throttle) if that turns out to matter for balance; not done here since the request was explicitly framed as a placeholder ("for now, at this date just popup with the message").

- ✅ `executeAuctionShip` (`turn-system.ts`) and the `AUCTION_SHIP { shipId }` action — rejects if the ship isn't in port (can't auction a ship at sea), no other restrictions (fleet size, cargo, or shipyard-city gating).
- ✅ Verified live: Shipyard readout showed "Auction this ship... for 3200 Mark" for a full-durability Kogge (4,000 base × 80%); clicking Auction removed the ship, credited 3,200 Mark, and the popup read "Wulf von Lübeck was sold to the highest bidder for 3200 Mark."

### Revised (2026-07-31): fixed a stranded-ship soft-lock

The claim above — "available at any port, not restricted to shipyard cities" — was true of `executeAuctionShip` itself but not of the UI: the only Auction button lived inside the Shipyard building panel, which `city-scene.ts` only renders at shipyard cities at all (`SHIPYARD_CITIES`). A ship reaching `critical`/`wrecked` durability (`canDepart()` returns false) while docked at Riga or Malmö — the two non-shipyard cities — had no available action whatsoever: can't depart (durability), can't repair (`executeRepairShip` requires a shipyard city, correctly), and couldn't reach the Auction button either (UI gap, not intended). A genuine permanent soft-lock for that ship, reported by a player.

Fixed by surfacing the existing Auction action directly in the Harbor building's "can't depart" message (both City view and List view), specifically when `!isShipyardCity(portCity)` — i.e. exactly the stuck case, without changing `canDepart` or `executeRepairShip`'s shipyard restriction, both of which are deliberate. The Shipyard panel's own Auction button (available at shipyard cities, for any ship regardless of durability) is unchanged. Verified live: imported a save with a critical-durability ship at Riga, confirmed the rescue Auction button appeared with the correct sale price, clicked it, and confirmed the ship left the fleet and cash was credited.

## Implementation Status (as of 2026-07-18)

- ✅ Buy ship (all three types), repair ship, shipyard-city restriction, `MAX_SHIPS` cap — implemented (`src/game/data/ships.ts`, `executeBuyShip`/`executeRepairShip` in `turn-system.ts`; `BUY_SHIP` `GameAction` now carries a `shipType` field)
- ✅ **Durability-threshold effects are implemented** (ADR-015): `canDepart` blocks Critical/Wrecked ships from receiving new sail orders (`setDestination` in `fleet-system.ts` returns the ship unchanged; the port UI shows an explicit "cannot depart" warning instead of the destination buttons); `durabilityTravelTimePenalty` adds +1 turn for a Damaged ship; `durabilityStormChancePenalty` (0/0.05/0.10 for Seaworthy/Worn/Damaged) feeds both the storm event's pool-selection weight and its per-ship damage formula — see `event-table.md` "Per-Route & Session Risk". The UI shows a durability status label (Seaworthy/Worn/Damaged/Critical) on every ship card.
- ✅ Per-route/season storm risk (`city-graph.md`) and the new `pirateRisk` table are both consumed by the event system — see ADR-015 and `event-table.md`. Storm damage per ship now ranges 6–22 based on route risk and durability, rather than a flat 10 to every ship in transit.
- ✅ **Hulk and Schnigge are implemented** (pulled forward from v1.1, alongside the Kogge) — `speedRatio()` scales route travel time relative to the Kogge baseline; the UI destination-time preview (`shipTravelTurns()` in `App.svelte`) was initially found to still show the Kogge's time for other ship types (a real bug caught via a live-browser check before shipping) and has been fixed to match.
- ❌ Wrecked-ship "full repair for 200 Mark" language does not apply in practice — a wrecked ship (0 durability) is removed from the fleet entirely (`fleet-system.ts` `applyStormDamage`), so there is nothing left to repair. Buying a replacement ship is the only recovery path.

## Related

- ADR-010 (Combat — implemented 2026-07-25, see "Combat" section above)
- ADR-015 (Per-route & session event risk — durability thresholds and storm-risk consumption)
- ADR-018 (Feature delivery sequencing — cannons ship with the Shipyard building, gated on the city-view skeleton)
- docs/design/city-graph.md (storm/pirate risk per route; Kogge-calibrated `route.turns`)
- docs/design/mvp-scope.md (ship types now implemented ahead of schedule; max 3 ships fleet-wide)
- docs/design/turn-resolution-order.md (step 4: storm damage resolved on arrival)
- docs/design/event-table.md (storm damage formula, durability-driven event weighting)
- `src/game/data/ships.ts`, `src/game/systems/turn-system.ts` (`executeBuyShip`, `executeRepairShip`)
