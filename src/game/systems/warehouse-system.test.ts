import { describe, it, expect } from 'vitest';
import { buildStartingState } from '../data/starting-config.ts';
import {
  executeBuyWarehouse,
  executeSellWarehouse,
  accrueWarehouseIncome,
  accrueStorageRent,
  warehouseSellValue,
  ownedStoreCapacity,
  totalStoreCapacity,
  storeCapacityRemaining,
  occupiedWarehouses,
  storedInRented,
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
    expect(accrueWarehouseIncome({}, {})).toBe(0);
  });

  it('sums income across all cities', () => {
    expect(accrueWarehouseIncome({ lubeck: 2, hamburg: 1 }, {})).toBe(3 * 15);
  });

  it('excludes warehouses currently occupied by stored goods', () => {
    expect(accrueWarehouseIncome({ lubeck: 2 }, { lubeck: { salt: 1 } })).toBe(1 * 15);
  });
});

describe('occupiedWarehouses / storedInRented', () => {
  it('a single unit stored occupies a whole warehouse slot', () => {
    expect(occupiedWarehouses(2, { salt: 1 })).toBe(1);
  });

  it('storage exactly filling owned capacity occupies exactly that many warehouses', () => {
    expect(occupiedWarehouses(2, { salt: 200 })).toBe(2);
  });

  it('storage beyond owned capacity does not inflate occupied count past what is owned', () => {
    expect(occupiedWarehouses(1, { salt: 150 })).toBe(1);
  });

  it('storedInRented is 0 until owned capacity is exceeded', () => {
    expect(storedInRented(2, { salt: 150 })).toBe(0);
    expect(storedInRented(1, { salt: 150 })).toBe(50);
  });
});

describe('ownedStoreCapacity / totalStoreCapacity / storeCapacityRemaining', () => {
  it('owned capacity is warehouses owned times 100', () => {
    expect(ownedStoreCapacity(3)).toBe(300);
  });

  it('total capacity comes from the city\'s fixed warehouseCapacity', () => {
    expect(totalStoreCapacity('lubeck')).toBe(14 * 100);
  });

  it('remaining capacity subtracts what is already stored', () => {
    const state = { ...buildStartingState('TestPlayer'), cityStores: { lubeck: { salt: 50 } } };
    expect(storeCapacityRemaining(state, 'lubeck')).toBe(14 * 100 - 50);
  });
});

describe('accrueStorageRent', () => {
  it('is 0 when everything stored fits in owned capacity', () => {
    expect(accrueStorageRent({ lubeck: 2 }, { lubeck: { salt: 150 } })).toBe(0);
  });

  it('charges per 10-good band, rounded up, only for the overflow beyond owned capacity', () => {
    // 1 warehouse owned = 100 capacity; 125 stored = 25 rented = 3 bands of 10 (ceil) * 5 Mark
    expect(accrueStorageRent({ lubeck: 1 }, { lubeck: { salt: 125 } })).toBe(3 * 5);
  });

  it('sums rent across every city with rented storage', () => {
    expect(accrueStorageRent({ lubeck: 0 }, { lubeck: { salt: 10 }, hamburg: { grain: 20 } })).toBe(1 * 5 + 2 * 5);
  });
});
