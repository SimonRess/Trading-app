import type { CityId, GameState } from '../state/types.ts';

export const WAREHOUSE_PRICE = 1_000;
export const WAREHOUSE_SELL_FRACTION = 0.7;
export const WAREHOUSE_INCOME_PER_TURN = 15;
// No cap was settled in the original design doc's Open Questions — added
// here to keep passive income from becoming the dominant strategy once a
// player has enough capital to buy many (the doc's own stated risk).
export const MAX_WAREHOUSES_PER_CITY = 3;

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

// Flat per-turn income, no turn-summary message (would be noisy every
// single turn) — visible only via the cash figure changing, same as market
// price drift (docs/design/warehouses.md "Passive income").
export function accrueWarehouseIncome(warehouses: Partial<Record<CityId, number>>): number {
  return Object.values(warehouses).reduce((sum, count) => sum + count * WAREHOUSE_INCOME_PER_TURN, 0);
}
