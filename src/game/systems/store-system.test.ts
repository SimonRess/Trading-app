import { describe, it, expect } from 'vitest';
import type { GameState, Ship } from '../state/types.ts';
import { buildStartingState } from '../data/starting-config.ts';
import {
  executeStoreBuy,
  executeStoreSell,
  executeStoreDeposit,
  executeStoreWithdraw,
  executeConvoyStoreDeposit,
  executeConvoyStoreWithdraw,
} from './store-system.ts';
import { executeCreateConvoy } from './convoy-system.ts';

function withSecondShip(state: GameState, overrides?: Partial<Ship>): GameState {
  const second: Ship = {
    id: 'ship-2',
    name: 'Second Ship',
    type: 'kogge',
    durability: 100,
    position: 'lubeck',
    cargo: {},
    crew: 8,
    cannons: 0,
    insured: false,
    repairCooldown: 0,
    posture: 'defensive',
    ...overrides,
  };
  return { ...state, fleet: { ...state.fleet, ships: [...state.fleet.ships, second] } };
}

describe('executeStoreBuy / executeStoreSell', () => {
  it('buys directly into the store, no ship involved', () => {
    const state = buildStartingState('P');
    const cashBefore = state.player.cash;
    const next = executeStoreBuy(state, 'lubeck', 'grain', 10);
    expect(next.cityStores.lubeck?.grain).toBe(10);
    expect(next.player.cash).toBeLessThan(cashBefore);
    // ship cargo untouched
    expect(next.fleet.ships[0]?.cargo.grain ?? 0).toBe(0);
  });

  it('refuses to buy beyond the city\'s total store capacity', () => {
    const state = buildStartingState('P');
    const next = executeStoreBuy(state, 'lubeck', 'grain', 999_999);
    expect(next).toBe(state);
  });

  it('sells directly from the store', () => {
    let state = buildStartingState('P');
    state = executeStoreBuy(state, 'lubeck', 'grain', 10);
    const cashBefore = state.player.cash;
    const next = executeStoreSell(state, 'lubeck', 'grain', 10);
    expect(next.cityStores.lubeck?.grain ?? 0).toBe(0);
    expect(next.player.cash).toBeGreaterThan(cashBefore);
  });

  it('refuses to sell more than is held in the store', () => {
    const state = buildStartingState('P');
    const next = executeStoreSell(state, 'lubeck', 'grain', 5);
    expect(next).toBe(state);
  });
});

describe('executeStoreDeposit / executeStoreWithdraw', () => {
  it('moves cargo from ship to store for free', () => {
    const state = buildStartingState('P'); // ship-1 starts with 20 salt at lubeck
    const cashBefore = state.player.cash;
    const next = executeStoreDeposit(state, 'ship-1', 'lubeck', 'salt', 20);
    expect(next.fleet.ships[0]?.cargo.salt ?? 0).toBe(0);
    expect(next.cityStores.lubeck?.salt).toBe(20);
    expect(next.player.cash).toBe(cashBefore); // no cost
  });

  it('refuses to deposit more than the ship holds', () => {
    const state = buildStartingState('P');
    const next = executeStoreDeposit(state, 'ship-1', 'lubeck', 'salt', 21);
    expect(next).toBe(state);
  });

  it('moves goods from store to ship for free', () => {
    let state = buildStartingState('P');
    state = executeStoreDeposit(state, 'ship-1', 'lubeck', 'salt', 20);
    const next = executeStoreWithdraw(state, 'ship-1', 'lubeck', 'salt', 20);
    expect(next.fleet.ships[0]?.cargo.salt).toBe(20);
    expect(next.cityStores.lubeck?.salt ?? 0).toBe(0);
  });

  it('refuses to withdraw more than the ship has cargo space for', () => {
    let state = buildStartingState('P');
    state = executeStoreBuy(state, 'lubeck', 'grain', 40); // fill store
    const next = executeStoreWithdraw(state, 'ship-1', 'lubeck', 'grain', 40); // ship already has 20 salt, only 30 space left
    expect(next).toBe(state);
  });
});

describe('executeConvoyStoreDeposit / executeConvoyStoreWithdraw', () => {
  it('deposits cargo pulled from convoy members into the store', () => {
    let state = withSecondShip(buildStartingState('P'), { cargo: { grain: 10 } });
    state = executeCreateConvoy(state, ['ship-1', 'ship-2']);
    const convoyId = state.fleet.convoys[0]?.id as string;

    const next = executeConvoyStoreDeposit(state, convoyId, 'lubeck', 'grain', 10);
    expect(next.cityStores.lubeck?.grain).toBe(10);
    const totalGrainOnShips = next.fleet.ships.reduce((sum, s) => sum + (s.cargo.grain ?? 0), 0);
    expect(totalGrainOnShips).toBe(0);
  });

  it('withdraws from the store and distributes across convoy members', () => {
    let state = withSecondShip(buildStartingState('P'));
    state = { ...state, player: { ...state.player, cash: 5_000 } };
    state = executeCreateConvoy(state, ['ship-1', 'ship-2']);
    const convoyId = state.fleet.convoys[0]?.id as string;
    state = executeStoreBuy(state, 'lubeck', 'grain', 60);

    const next = executeConvoyStoreWithdraw(state, convoyId, 'lubeck', 'grain', 60);
    expect(next.cityStores.lubeck?.grain ?? 0).toBe(0);
    const totalGrainOnShips = next.fleet.ships.reduce((sum, s) => sum + (s.cargo.grain ?? 0), 0);
    expect(totalGrainOnShips).toBe(60); // more than one Kogge's 50 capacity — proves distribution
  });

  it('refuses to withdraw more than the store holds', () => {
    let state = withSecondShip(buildStartingState('P'));
    state = executeCreateConvoy(state, ['ship-1', 'ship-2']);
    const convoyId = state.fleet.convoys[0]?.id as string;
    const next = executeConvoyStoreWithdraw(state, convoyId, 'lubeck', 'grain', 10);
    expect(next).toBe(state);
  });
});
