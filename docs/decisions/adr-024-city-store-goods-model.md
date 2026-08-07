# ADR-024: City Store Goods Model

**Date:** 2026-08-06
**Status:** Accepted
**Deciders:** Product owner (direct requirements), engineering (data-model translation)

## Context

Warehouses shipped in v2 as a pure passive-income asset (`docs/design/warehouses.md`). That doc's own Non-Goals explicitly ruled out using a warehouse to actually stash cargo: *"despite the name, this is a pure income-generating asset in v2, not a cargo-management feature. A storage mechanic is a plausible v3+ extension once the reason for it is clearer."*

The reason is now clear and specified directly: the player should be able to store goods in a city (in owned warehouse capacity, or rented overflow beyond it), move goods between that storage and a ship/convoy docked there, and trade goods directly against the city market without a ship involved at all. This requires a decision on:

1. Whether stored goods live in a wholly new data structure or extend `GameState.warehouses` in place.
2. Whether individual warehouses need their own identity (to track "is *this* warehouse occupied") or can stay the existing fungible per-city count.
3. How owned-vs-rented storage is capped, given the product owner's explicit requirement that rentable overflow is *not* unlimited — each city has a fixed total warehouse count set at game start, scaled by city size.
4. How goods move between ship/convoy cargo and store, and between store and the city market, in terms of the existing `GameAction`/action-handler pattern (ADR-023's precedent).

## Decision

**Stored goods live in a new, separate top-level field, not inside `GameState.warehouses`.** `warehouses` stays exactly what it is today — a count of player-owned warehouse slots per city, still capped at `MAX_WAREHOUSES_PER_CITY = 3`. A new field holds what's physically stored:

```typescript
// New top-level GameState field, additive — see docs/design/city-stores.md.
// Sparse per city (absent/{} = nothing stored there), sparse per good
// within a city — same shape as Ship.cargo, just city-scoped instead of
// ship-scoped.
cityStores: Partial<Record<CityId, Partial<Record<GoodId, number>>>>;
```

**Warehouses stay fungible (no per-warehouse id).** Occupancy ("is a warehouse currently in use, and therefore not earning rental income") is computed, not stored, from the existing count and the new stored-goods total:

```typescript
// warehouse-system.ts — pure functions, no new state beyond cityStores above.
function ownedCapacity(warehousesOwned: number): number {
  return warehousesOwned * WAREHOUSE_CAPACITY; // WAREHOUSE_CAPACITY = 100
}

function occupiedOwnedWarehouses(warehousesOwned: number, storedTotal: number): number {
  const storedInOwned = Math.min(storedTotal, ownedCapacity(warehousesOwned));
  return Math.ceil(storedInOwned / WAREHOUSE_CAPACITY);
}
```

A warehouse holding any goods at all (even 1 unit) counts as occupied for that whole 100-unit slot and stops earning `WAREHOUSE_INCOME_PER_TURN` — matching the product owner's exact framing ("actively at least one good is stored ... not rented out").

**Each city gets a new, static, larger total-capacity constant, independent of `MAX_WAREHOUSES_PER_CITY`:**

```typescript
// cities.ts — CityDefinition gains one field, alongside the existing
// flavor-only `population`.
export interface CityDefinition {
  id: CityId;
  name: string;
  position: { x: number; y: number };
  population: number;
  // Total physical warehouses in this city (owned + rentable-from-others),
  // fixed at game start, scaled by city size — see ADR-024. Rentable
  // overflow = warehouseCapacity − warehousesOwned, NOT unlimited.
  warehouseCapacity: number;
}
```

Placeholder values (needs tuning, same caveat as every other economic constant in this codebase): Lübeck 14, Danzig 10, Riga 9, Hamburg 7, Malmö 6 — scaled from the existing `population` field rather than inventing a new sizing signal.

**Rent cost for overflow beyond owned capacity**: `5 Mark per 10 goods per turn`, rounded up per 10-unit band (`Math.ceil(storedInRented / 10) * STORAGE_RENT_PER_10_GOODS_PER_TURN`), charged in `resolveTurn` alongside (not replacing) the existing warehouse-income step.

**New `GameAction` variants**, following ADR-023's flat-discriminated-union precedent rather than nesting:

```typescript
| { type: 'STORE_BUY_GOOD'; cityId: CityId; goodId: GoodId; quantity: number }
| { type: 'STORE_SELL_GOOD'; cityId: CityId; goodId: GoodId; quantity: number }
| { type: 'STORE_DEPOSIT'; shipId: string; cityId: CityId; goodId: GoodId; quantity: number }
| { type: 'STORE_WITHDRAW'; shipId: string; cityId: CityId; goodId: GoodId; quantity: number }
| { type: 'CONVOY_STORE_DEPOSIT'; convoyId: string; cityId: CityId; goodId: GoodId; quantity: number }
| { type: 'CONVOY_STORE_WITHDRAW'; convoyId: string; cityId: CityId; goodId: GoodId; quantity: number }
```

`STORE_BUY_GOOD`/`STORE_SELL_GOOD` trade directly against the city market (one `resolveTradeStepped` call each, same as `BUY_GOOD`/`SELL_GOOD`) with no ship involved. `STORE_DEPOSIT`/`STORE_WITHDRAW` move goods between a ship's cargo and the store with no market transaction and no cost. The `CONVOY_*` variants reuse `convoy-system.ts`'s existing `ConvoyDistributionStrategy`/`PROPORTIONAL_DISTRIBUTION` exactly as `CONVOY_BUY_GOOD`/`CONVOY_SELL_GOOD` already do — deposit pulls from members proportional to what each holds (sell-direction weights), withdraw pushes to members proportional to remaining space (buy-direction weights).

## Alternatives Considered

- **Store stock inside `GameState.warehouses` itself** (e.g. change its type from `number` to a richer per-warehouse record). Rejected: `warehouses` is already load-bearing for the existing income/buy/sell mechanic and every existing call site assumes a plain count; conflating "how many I own" with "what's stored" would force every existing warehouse function to change shape for no benefit, versus a new field that's purely additive.
- **Per-warehouse identity** (an id-referenced list of individual warehouses, each with its own occupied/idle flag), mirroring how `Ship`/`Convoy` get individual ids. Rejected for the same reason ADR-023 kept `Ship` free of a `convoyId` back-reference: warehouses are genuinely fungible (unlike ships, which differ in durability/cargo/position), so tracking "which specific warehouse" adds bookkeeping with no gameplay payoff — the count-plus-occupancy-formula approach gives the same player-facing behavior (occupied warehouses stop earning income) without it.
- **Unlimited rentable overflow**, capped only by the per-10-goods cost acting as a natural brake. Rejected per explicit product-owner direction: each city has a fixed total warehouse count set at game start (scaled by size), so overflow is capped at `warehouseCapacity − warehousesOwned`, not open-ended.
- **A single combined `STORE_BUY_GOOD`-style action that infers ship vs. direct-market vs. convoy from context**, instead of 6 separate action variants. Rejected: ADR-023 already established (and explicitly rejected the opposite) that this codebase prefers one action variant per concrete operation over a single parameterized action with implicit branching — consistency with that precedent outweighs the smaller union size a combined action would give.

## Consequences

- ✅ `cityStores` is purely additive — no schema bump, defaults to `{}` per city on load, same pattern as `convoys: []` (ADR-023) and `warehouses: {}` before it.
- ✅ Existing warehouse buy/sell/income functions and their tests stay valid; `accrueWarehouseIncome` gains a parameter (occupied count) rather than being rewritten.
- ✅ Reuses the convoy distribution-strategy machinery instead of inventing a second one, keeping "how a convoy's cargo is split across members" logic in exactly one place.
- ⚠️ `GameAction` grows by 6 variants (from 29 to 35) and `LocalGameClient`'s dispatch switch grows correspondingly — consistent with the codebase's established growth pattern (convoys added 8), not a new architectural concern, but worth noting as the union keeps growing.
- ⚠️ Fungible-warehouse occupancy is a derived value recomputed every turn (`Math.ceil`), not stored state — cheap, but means a UI showing "which warehouses are occupied" can only ever show a count, never per-warehouse identity/history. Accepted as consistent with the existing fungible-count model.
- 🔒 `CityDefinition.warehouseCapacity` is a static, game-start constant (no in-game way to change a city's total warehouse count) — matches `warehouses.md`'s own Open Question ("does a warehouse ever become unavailable? currently no") staying unresolved in the same direction, not a new restriction introduced here.

## Links

- Amends/extends: none directly, but **supersedes** `docs/design/warehouses.md`'s Non-Goals bullet ruling out a storage mechanic
- Related: ADR-020 (net worth includes warehouse resale value — this ADR adds a parallel `storeValue` term to `computeNetWorth`, same treatment as `cargoValue`)
- Related: ADR-023 (ship convoy model — direct precedent for the fungible-vs-identity tradeoff, the flat `GameAction` union style, and the distribution-strategy reuse for convoy deposit/withdraw)
- Related design docs: `docs/design/warehouses.md`, `docs/design/city-stores.md`
