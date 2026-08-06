# Design: City Stores

**Status:** Implemented (2026-08-06). Data model: ADR-024 (Accepted). Manually verified live via dev server + Playwright: bought a warehouse, deposited cargo from a docked ship, bought goods directly into the store with no ship involved, confirmed the occupied warehouse stopped earning passive income, and confirmed overflow storage rent (85 Mark for 170 goods over capacity — 17 bands of 10 × 5 Mark) was charged and reported correctly in the turn summary. The two Open Questions below remain genuinely open (UI reused the existing table markup directly rather than a dedicated component; stores are not raidable) — neither blocked shipping.

### Implementation Status

- ✅ `GameState.cityStores`, `CityDefinition.warehouseCapacity`, capacity/occupancy/rent helpers (`warehouse-system.ts`), all 6 new `GameAction` variants (`store-system.ts`), `computeNetWorth`'s `storeValue` term, `resolveTurn`'s rent step alongside the existing (now occupancy-aware) warehouse-income step.
- ✅ UI: the Warehouse District panel extended in place (not a new building) with an owned/occupied breakdown line, a stock table (buy/sell direct against the market, deposit/withdraw against a docked ship or convoy), gated correctly on the selected ship/convoy being in port at the selected city.
- ✅ 30 new unit tests (`store-system.test.ts`, plus additions to `warehouse-system.test.ts` and `turn-system.test.ts`) — 357 tests total, all passing.
- Not attempted: **Agents** (roadmap item 10's other half) — still a separate, later design doc, unchanged from this doc's original scoping.

## Purpose

Warehouses (`docs/design/warehouses.md`) are a pure passive-income asset today — buying one earns flat cash every turn, with no way to actually use it to hold goods. That doc's own Non-Goals deferred a real storage mechanic to "v3+, once the reason for it is clearer." This doc is that mechanic: the player can store goods in a city (filling owned warehouse capacity first, then paying to rent overflow up to that city's fixed total capacity), move goods freely between that storage and a ship or convoy docked there, and trade goods directly against the city market without a ship at all — useful for building up stock ahead of a price swing, or offloading cargo without needing a buyer immediately available.

Deliberately scoped to **storage only** — the "agents" half of roadmap item 10 (hireable NPCs who act autonomously) is a separate, later design doc; see `docs/design/roadmap-next-versions.md`.

## Inputs & Outputs

**Reads:** `GameState.warehouses` (existing, unchanged meaning), `GameState.cityStores` (new), `GameState.market` (for direct store↔market trades), `GameState.fleet` (ships/convoys for deposit/withdraw), `CITIES[cityId].warehouseCapacity` (new static data).
**Produces/modifies:** `GameState.cityStores`, `GameState.market` (on direct store trades), `GameState.fleet.ships[].cargo` (on deposit/withdraw), `GameState.player.cash` (rent charges, warehouse income, direct trades).

## Data Model

```typescript
// cities.ts — one new field on the existing CityDefinition
export interface CityDefinition {
  id: CityId;
  name: string;
  position: { x: number; y: number };
  population: number;
  warehouseCapacity: number; // total physical warehouses in this city — see ADR-024
}

// Placeholder values, needs tuning like every other economic constant here —
// scaled from the existing population field, not a new sizing signal.
// lubeck: 14, danzig: 10, riga: 9, hamburg: 7, malmo: 6

// types.ts — one new top-level GameState field, additive, no schema bump
cityStores: Partial<Record<CityId, Partial<Record<GoodId, number>>>>;

// warehouse-system.ts — one new constant alongside the existing three
export const WAREHOUSE_CAPACITY = 100; // goods per owned warehouse
export const STORAGE_RENT_PER_10_GOODS_PER_TURN = 5;
```

`MAX_WAREHOUSES_PER_CITY` (existing, still 3) is unchanged — it's the cap on warehouses the *player* can own in one city. `CITIES[cityId].warehouseCapacity` is the new, larger total-in-city cap covering owned + rentable-from-others storage; `rentable = warehouseCapacity − warehousesOwned`.

## Core Logic

### Capacity & occupancy

All derived from the existing fungible `warehouses[cityId]: number` count plus the new `cityStores[cityId]` contents — no per-warehouse identity (see ADR-024's Alternatives Considered):

```
ownedCapacity(cityId)   = warehouses[cityId] × WAREHOUSE_CAPACITY
totalCapacity(cityId)   = CITIES[cityId].warehouseCapacity × WAREHOUSE_CAPACITY
storedTotal(cityId)     = sum(cityStores[cityId])
storedInOwned(cityId)   = min(storedTotal, ownedCapacity)
storedInRented(cityId)  = storedTotal − storedInOwned
occupiedWarehouses      = ceil(storedInOwned / WAREHOUSE_CAPACITY)
idleWarehouses          = warehouses[cityId] − occupiedWarehouses
```

A warehouse holding *any* stored goods (even 1 unit) counts as occupied for its whole 100-unit slot and stops earning `WAREHOUSE_INCOME_PER_TURN` — the product owner's exact requirement. Since storage fills owned capacity before spilling into rented, `occupiedWarehouses` is always the count of warehouses closest to "full first," not an arbitrary subset.

Any deposit/buy that would push `storedTotal` past `totalCapacity` is rejected (the city's storage — owned and rentable combined — is full), the same "reject at the boundary" pattern `executeBuy`/`executeConvoyBuy` already use for cargo space.

### Turn resolution

Both effects land in `resolveTurn` next to the existing warehouse-income step (`turn-system.ts`, currently Step 5f, between insurance premiums and the yearly family update):

- `accrueWarehouseIncome` gains a second parameter (the store's occupied-count-per-city) so it only pays `WAREHOUSE_INCOME_PER_TURN` for **idle** warehouses, not the raw owned count as today.
- A new adjacent charge sums `ceil(storedInRented(cityId) / 10) × STORAGE_RENT_PER_10_GOODS_PER_TURN` across every city with rented storage, deducted from `player.cash`, reported as a turn-summary expense line (🏬 emoji, mirroring the existing income message — "Paid N Mark in city storage rent.").

### Direct store ↔ market trading

`STORE_BUY_GOOD`/`STORE_SELL_GOOD { cityId, goodId, quantity }` — no ship involved at all. Each is one `resolveTradeStepped` call against `market[cityId][goodId]` (identical pricing mechanics to `BUY_GOOD`/`SELL_GOOD`), with the resulting quantity added to/removed from `cityStores[cityId][goodId]` instead of a ship's cargo. `STORE_BUY_GOOD` is gated on remaining city capacity (`totalCapacity − storedTotal`) the same way `BUY_GOOD` gates on `cargoSpace(ship)`; both respect `isEmbargoed(cityEffects, cityId, goodId)` exactly as ship trades do.

### Ship & convoy deposit/withdraw

`STORE_DEPOSIT`/`STORE_WITHDRAW { shipId, cityId, goodId, quantity }` — pure repositioning between a docked ship's `cargo` and `cityStores[cityId]`. No market transaction, no cost. Gated on the ship being in port at `cityId`, and on cargo space / store capacity respectively.

`CONVOY_STORE_DEPOSIT`/`CONVOY_STORE_WITHDRAW { convoyId, cityId, goodId, quantity }` — same operation for a convoy, reusing `convoy-system.ts`'s existing `ConvoyDistributionStrategy` machinery exactly as `executeConvoyBuy`/`executeConvoySell` already do:
- **Deposit** (convoy → store) uses sell-direction weights (`PROPORTIONAL_DISTRIBUTION`'s `'sell'` branch — proportional to what each member currently holds) to decide how much comes off each ship.
- **Withdraw** (store → convoy) uses buy-direction weights (proportional to each member's remaining cargo space) to decide how much each ship receives.

No new distribution logic — this is the same swappable `ConvoyDistributionStrategy` type from ADR-023, just invoked for a different transfer direction.

### Net worth

`computeNetWorth` gains a `storeValue` term: `Σ GOODS[goodId].basePrice × qty` across every city's `cityStores`, identical treatment to the existing `cargoValue` term for ship cargo.

## UI Design (sketch — not fully specced)

The existing Warehouse District panel (`App.svelte`, City-view only, no List-view duplicate today) grows into a Store panel:

- Keep the existing city selector and owned-count/buy/sell warehouse controls.
- Add an owned/idle/occupied/rented breakdown line (e.g. "3 owned (1 idle, 2 in use) · 4/7 rented capacity used").
- A stock table (good × quantity held in store) with direct Buy/Sell columns trading store↔market — likely `TradeTable.svelte` extended again with a store-facing prop pair, following the same pattern its `convoyCargo`/`convoyCargoSpace` props already established for convoys, though a dedicated component is also plausible given store trading needs *four* action columns (direct buy, direct sell, deposit, withdraw) instead of TradeTable's existing two — left as an open question below rather than decided here.
- Deposit/Withdraw controls appear when a ship or convoy is selected and currently in port at the selected city.

## Edge Cases

- A city's `warehouseCapacity` is a static, game-start constant with no in-game way to change it (matches `warehouses.md`'s own unresolved "does a warehouse ever become unavailable?" question staying in the same direction — no, nothing changes city capacity mid-game).
- `isEmbargoed` blocks `STORE_BUY_GOOD`/`STORE_SELL_GOOD` exactly as it blocks `BUY_GOOD`/`SELL_GOOD` — an embargoed good can't be traded through the store either.
- Deposit/withdraw are always free and uncapped by cash (they're not trades), only by cargo space / store capacity.
- A convoy deposit/withdraw where the convoy isn't fully in port, or its members are split across cities, is rejected the same way `executeConvoyBuy`/`executeConvoySell` already require every member co-located and in port.
- Store contents are **not** subject to pirate raids — stores are ashore, out of scope for ship combat (see Open Questions).

## Open Questions

- **UI component reuse**: extend `TradeTable.svelte` again, or build a dedicated store-trading component given it needs buy/sell/deposit/withdraw (four actions) rather than TradeTable's existing buy/sell (two)? Leaning toward a dedicated component to avoid overloading `TradeTable.svelte`'s prop surface further, but not decided.
- **Can a store be raided or otherwise targeted by an event** (storm, plague, embargo already covers trade-blocking)? Leaning toward no — stores are ashore, only ships/cargo at sea are exposed to `pirate_raid`/`storm` — but this should be an explicit call once the event system is touched again, not an oversight.
- **Remote store access**: `STORE_BUY_GOOD`/`STORE_SELL_GOOD` currently work from any city with no ship there and no warehouse owned there. Decided 2026-08-06: this should eventually require physical presence (leaning toward "owns at least one warehouse in that city"), but is deliberately staying as-is for now — see `docs/design/roadmap-next-versions.md` item 11a for the tracked follow-up.

## Related

- ADR-024 (data model decision this doc implements)
- `docs/design/warehouses.md` (the passive-income mechanic this extends; its Non-Goals section is being superseded by this doc for the storage piece specifically)
- ADR-020 (net worth includes warehouse resale value — this doc's `storeValue` term follows the same amendment pattern)
- `docs/design/ship-convoys.md`, ADR-023 (convoy distribution-strategy reuse for deposit/withdraw; the flat-`GameAction`-variant precedent this doc's new actions follow)
- `docs/design/roadmap-next-versions.md` item 10 (this doc covers the "stores" half only; "agents" is a separate, later design doc) and item 11 (per-city warehouse income/price variance — `warehouseCapacity` is itself a new per-city variance point that item may want to build on)
