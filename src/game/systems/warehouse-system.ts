import type { CityId, GoodId, GameState } from '../state/types.ts';
import { CITIES } from '../data/cities.ts';

export const WAREHOUSE_PRICE = 1_000;
export const WAREHOUSE_SELL_FRACTION = 0.7;
export const WAREHOUSE_INCOME_PER_TURN = 15;
// No cap was settled in the original design doc's Open Questions — added
// here to keep passive income from becoming the dominant strategy once a
// player has enough capital to buy many (the doc's own stated risk).
export const MAX_WAREHOUSES_PER_CITY = 3;

// City Store (ADR-024, docs/design/city-stores.md) — goods physically
// stored fill owned warehouse capacity first, then rent overflow up to
// the city's fixed total warehouseCapacity (cities.ts).
export const WAREHOUSE_CAPACITY = 100; // goods per owned warehouse
export const STORAGE_RENT_PER_10_GOODS_PER_TURN = 5;

function cityStoreTotal(cityStore: Partial<Record<GoodId, number>> | undefined): number {
  return Object.values(cityStore ?? {}).reduce<number>((sum, qty) => sum + qty, 0);
}

export function ownedStoreCapacity(warehousesOwned: number): number {
  return warehousesOwned * WAREHOUSE_CAPACITY;
}

export function totalStoreCapacity(cityId: CityId): number {
  return CITIES[cityId].warehouseCapacity * WAREHOUSE_CAPACITY;
}

export function storeCapacityRemaining(state: GameState, cityId: CityId): number {
  const stored = cityStoreTotal(state.cityStores[cityId]);
  return totalStoreCapacity(cityId) - stored;
}

// A warehouse holding any stored goods at all — even 1 unit — counts as
// occupied for its whole 100-unit slot and stops earning
// WAREHOUSE_INCOME_PER_TURN (docs/design/city-stores.md "Capacity &
// occupancy"). Storage fills owned capacity before spilling into rented,
// so this is always "however many warehouses are needed to hold what's
// stored, up to what's owned," not an arbitrary subset.
export function occupiedWarehouses(warehousesOwned: number, cityStore: Partial<Record<GoodId, number>> | undefined): number {
  const storedInOwned = Math.min(cityStoreTotal(cityStore), ownedStoreCapacity(warehousesOwned));
  return Math.ceil(storedInOwned / WAREHOUSE_CAPACITY);
}

export function storedInRented(warehousesOwned: number, cityStore: Partial<Record<GoodId, number>> | undefined): number {
  const stored = cityStoreTotal(cityStore);
  return Math.max(0, stored - ownedStoreCapacity(warehousesOwned));
}

export function warehouseSellValue(): number {
  return Math.round(WAREHOUSE_PRICE * WAREHOUSE_SELL_FRACTION);
}

export function executeBuyWarehouse(state: GameState, cityId: CityId): GameState {
  const owned = state.warehouses[cityId] ?? 0;
  if (owned >= MAX_WAREHOUSES_PER_CITY) return state;
  if (state.player.cash < WAREHOUSE_PRICE) return state;

  return {
    ...state,
    player: { ...state.player, cash: state.player.cash - WAREHOUSE_PRICE },
    warehouses: { ...state.warehouses, [cityId]: owned + 1 },
  };
}

export function executeSellWarehouse(state: GameState, cityId: CityId): GameState {
  const owned = state.warehouses[cityId] ?? 0;
  if (owned <= 0) return state;

  return {
    ...state,
    player: { ...state.player, cash: state.player.cash + warehouseSellValue() },
    warehouses: { ...state.warehouses, [cityId]: owned - 1 },
  };
}

// Only IDLE warehouses earn passive income — one actively holding stored
// goods (occupiedWarehouses above) can't simultaneously be rented out to
// someone else (docs/design/city-stores.md, ADR-024). Turn-system.ts now
// reports this in the turn summary (see resolveTurn's Step 5f comment) —
// the "no turn-summary message" framing this comment used to have is
// stale, kept only as a note that it was originally silent like market
// drift before player feedback asked for it to be visible.
export function accrueWarehouseIncome(
  warehouses: Partial<Record<CityId, number>>,
  cityStores: Partial<Record<CityId, Partial<Record<GoodId, number>>>>,
): number {
  return (Object.entries(warehouses) as Array<[CityId, number]>).reduce((sum, [cityId, count]) => {
    const idle = count - occupiedWarehouses(count, cityStores[cityId]);
    return sum + idle * WAREHOUSE_INCOME_PER_TURN;
  }, 0);
}

// Rent for storage beyond owned warehouse capacity, charged every turn,
// rounded up per 10-unit band — the "certain amount of money per 10 goods
// per turn" requirement (docs/design/city-stores.md).
export function accrueStorageRent(
  warehouses: Partial<Record<CityId, number>>,
  cityStores: Partial<Record<CityId, Partial<Record<GoodId, number>>>>,
): number {
  return (Object.keys(cityStores) as CityId[]).reduce((sum, cityId) => {
    const owned = warehouses[cityId] ?? 0;
    const rented = storedInRented(owned, cityStores[cityId]);
    return sum + Math.ceil(rented / 10) * STORAGE_RENT_PER_10_GOODS_PER_TURN;
  }, 0);
}
