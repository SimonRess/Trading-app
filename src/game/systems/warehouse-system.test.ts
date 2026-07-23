import { describe, it, expect } from 'vitest';
import { buildStartingState } from '../data/starting-config.ts';
import {
  executeBuyWarehouse,
  executeSellWarehouse,
  accrueWarehouseIncome,
  warehouseSellValue,
  MAX_WAREHOUSES_PER_CITY,
  WAREHOUSE_PRICE,
} from './warehouse-system.ts';

describe('executeBuyWarehouse', () => {
  it('deducts the price and adds one warehouse to the city', () => {
    const state = { ...buildStartingState('TestPlayer'), player: { ...buildStartingState('TestPlayer').player, cash: 2_000 } };
    const before = state.player.cash;
    const next = executeBuyWarehouse(state, 'lubeck');
    expect(next.warehouses.lubeck).toBe(1);
    expect(next.player.cash).toBe(before - WAREHOUSE_PRICE);
  });

  it('does not affect other cities', () => {
    const base = buildStartingState('TestPlayer');
    const state = { ...base, player: { ...base.player, cash: 2_000 } };
    const next = executeBuyWarehouse(state, 'lubeck');
    expect(next.warehouses.hamburg ?? 0).toBe(0);
  });

  it('rejects buying beyond the per-city cap', () => {
    let state = buildStartingState('TestPlayer');
    state = { ...state, player: { ...state.player, cash: 10_000 } };
    for (let i = 0; i < MAX_WAREHOUSES_PER_CITY; i++) {
      state = executeBuyWarehouse(state, 'lubeck');
    }
    expect(state.warehouses.lubeck).toBe(MAX_WAREHOUSES_PER_CITY);
    const next = executeBuyWarehouse(state, 'lubeck');
    expect(next).toBe(state);
  });

  it('rejects buying if insufficient cash', () => {
    const state = buildStartingState('TestPlayer');
    const poor = { ...state, player: { ...state.player, cash: 0 } };
    const next = executeBuyWarehouse(poor, 'lubeck');
    expect(next).toBe(poor);
  });
});

describe('executeSellWarehouse', () => {
  it('removes one warehouse and refunds 70% of the price', () => {
    const base = buildStartingState('TestPlayer');
    const rich = { ...base, player: { ...base.player, cash: 2_000 } };
    const state = executeBuyWarehouse(rich, 'lubeck');
    const before = state.player.cash;
    const next = executeSellWarehouse(state, 'lubeck');
    expect(next.warehouses.lubeck).toBe(0);
    expect(next.player.cash).toBe(before + warehouseSellValue());
  });

  it('rejects selling when none are owned', () => {
    const state = buildStartingState('TestPlayer');
    const next = executeSellWarehouse(state, 'lubeck');
    expect(next).toBe(state);
  });
});

describe('accrueWarehouseIncome', () => {
  it('is 0 with no warehouses', () => {
    expect(accrueWarehouseIncome({})).toBe(0);
  });

  it('sums income across all cities', () => {
    expect(accrueWarehouseIncome({ lubeck: 2, hamburg: 1 })).toBe(3 * 15);
  });
});
