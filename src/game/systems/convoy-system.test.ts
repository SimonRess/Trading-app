import { describe, it, expect } from 'vitest';
import type { GameState, Ship } from '../state/types.ts';
import { buildStartingState } from '../data/starting-config.ts';
import {
  executeCreateConvoy,
  executeAddShipToConvoy,
  executeRemoveShipFromConvoy,
  executeDissolveConvoy,
  executeSetConvoyDestination,
  executeSetConvoyPosture,
  executeConvoyBuy,
  executeConvoySell,
  findConvoyForShip,
  PROPORTIONAL_DISTRIBUTION,
} from './convoy-system.ts';

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

describe('executeCreateConvoy', () => {
  it('groups two docked ships in the same port', () => {
    const state = withSecondShip(buildStartingState('P'));
    const next = executeCreateConvoy(state, ['ship-1', 'ship-2'], 'My Convoy');
    expect(next.fleet.convoys).toHaveLength(1);
    expect(next.fleet.convoys[0]?.shipIds).toEqual(['ship-1', 'ship-2']);
    expect(next.fleet.convoys[0]?.name).toBe('My Convoy');
  });

  it('refuses fewer than 2 ships', () => {
    const state = buildStartingState('P');
    const next = executeCreateConvoy(state, ['ship-1']);
    expect(next.fleet.convoys).toHaveLength(0);
  });

  it('refuses ships in different ports', () => {
    const state = withSecondShip(buildStartingState('P'), { position: 'hamburg' });
    const next = executeCreateConvoy(state, ['ship-1', 'ship-2']);
    expect(next.fleet.convoys).toHaveLength(0);
  });

  it('refuses an in-transit ship', () => {
    const state = withSecondShip(buildStartingState('P'), {
      position: { from: 'lubeck', to: 'hamburg', turnsRemaining: 2 },
    });
    const next = executeCreateConvoy(state, ['ship-1', 'ship-2']);
    expect(next.fleet.convoys).toHaveLength(0);
  });
});

describe('executeAddShipToConvoy', () => {
  it('adds a docked ship from the same port to an existing convoy', () => {
    let state = withSecondShip(buildStartingState('P'));
    state = withSecondShip(state, { id: 'ship-3', name: 'Third' });
    state = executeCreateConvoy(state, ['ship-1', 'ship-2']);
    const convoyId = state.fleet.convoys[0]?.id as string;
    const next = executeAddShipToConvoy(state, convoyId, 'ship-3');
    expect(next.fleet.convoys[0]?.shipIds).toEqual(['ship-1', 'ship-2', 'ship-3']);
  });

  it('refuses a ship already in another convoy', () => {
    let state = withSecondShip(buildStartingState('P'));
    state = withSecondShip(state, { id: 'ship-3', name: 'Third' });
    state = withSecondShip(state, { id: 'ship-4', name: 'Fourth' });
    state = executeCreateConvoy(state, ['ship-1', 'ship-2']);
    state = executeCreateConvoy(state, ['ship-3', 'ship-4']);
    const convoyId = state.fleet.convoys[0]?.id as string;
    const next = executeAddShipToConvoy(state, convoyId, 'ship-3');
    expect(next.fleet.convoys[0]?.shipIds).toEqual(['ship-1', 'ship-2']);
  });
});

describe('executeRemoveShipFromConvoy', () => {
  it('excludes a ship while keeping the convoy with 2+ remaining members', () => {
    let state = withSecondShip(buildStartingState('P'));
    state = withSecondShip(state, { id: 'ship-3', name: 'Third' });
    state = executeCreateConvoy(state, ['ship-1', 'ship-2', 'ship-3']);
    const next = executeRemoveShipFromConvoy(state, 'ship-2');
    expect(findConvoyForShip(next.fleet, 'ship-2')).toBeUndefined();
    expect(next.fleet.convoys[0]?.shipIds).toEqual(['ship-1', 'ship-3']);
  });

  it('auto-dissolves the convoy when only 1 member remains', () => {
    let state = withSecondShip(buildStartingState('P'));
    state = executeCreateConvoy(state, ['ship-1', 'ship-2']);
    const next = executeRemoveShipFromConvoy(state, 'ship-2');
    expect(next.fleet.convoys).toHaveLength(0);
  });
});

describe('executeDissolveConvoy', () => {
  it('removes the convoy entirely', () => {
    let state = withSecondShip(buildStartingState('P'));
    state = executeCreateConvoy(state, ['ship-1', 'ship-2']);
    const convoyId = state.fleet.convoys[0]?.id as string;
    const next = executeDissolveConvoy(state, convoyId);
    expect(next.fleet.convoys).toHaveLength(0);
  });
});

describe('executeSetConvoyDestination', () => {
  it('applies the slowest member travel time to every member', () => {
    let state = withSecondShip(buildStartingState('P'), { type: 'hulk' });
    state = executeCreateConvoy(state, ['ship-1', 'ship-2']);
    const convoyId = state.fleet.convoys[0]?.id as string;
    const next = executeSetConvoyDestination(state, convoyId, 'hamburg');

    const shipA = next.fleet.ships.find(s => s.id === 'ship-1');
    const shipB = next.fleet.ships.find(s => s.id === 'ship-2');
    const turnsA = typeof shipA?.position === 'object' ? shipA.position.turnsRemaining : undefined;
    const turnsB = typeof shipB?.position === 'object' ? shipB.position.turnsRemaining : undefined;
    expect(turnsA).toBeDefined();
    expect(turnsA).toBe(turnsB);
  });

  it('refuses to depart if any member cannot depart', () => {
    let state = withSecondShip(buildStartingState('P'), { durability: 10 });
    state = executeCreateConvoy(state, ['ship-1', 'ship-2']);
    const convoyId = state.fleet.convoys[0]?.id as string;
    const next = executeSetConvoyDestination(state, convoyId, 'hamburg');
    const shipA = next.fleet.ships.find(s => s.id === 'ship-1');
    expect(shipA?.position).toBe('lubeck');
  });
});

describe('executeSetConvoyPosture', () => {
  it('updates the convoy posture', () => {
    let state = withSecondShip(buildStartingState('P'));
    state = executeCreateConvoy(state, ['ship-1', 'ship-2']);
    const convoyId = state.fleet.convoys[0]?.id as string;
    const next = executeSetConvoyPosture(state, convoyId, 'aggressive');
    expect(next.fleet.convoys[0]?.posture).toBe('aggressive');
  });
});

describe('PROPORTIONAL_DISTRIBUTION', () => {
  it('splits a buy proportionally to remaining cargo space', () => {
    let state = withSecondShip(buildStartingState('P'), { type: 'hulk' });
    state = executeCreateConvoy(state, ['ship-1', 'ship-2']);
    const convoyId = state.fleet.convoys[0]?.id as string;
    const next = executeConvoyBuy(state, convoyId, 'lubeck', 'grain', 10);
    const shipA = next.fleet.ships.find(s => s.id === 'ship-1');
    const shipB = next.fleet.ships.find(s => s.id === 'ship-2');
    const totalAssigned = (shipA?.cargo.grain ?? 0) + (shipB?.cargo.grain ?? 0);
    expect(totalAssigned).toBe(10);
  });
});

describe('executeConvoyBuy / executeConvoySell', () => {
  it('buys as one stepped trade and distributes goods, deducting cash once', () => {
    let state = withSecondShip(buildStartingState('P'));
    state = executeCreateConvoy(state, ['ship-1', 'ship-2']);
    const convoyId = state.fleet.convoys[0]?.id as string;
    const cashBefore = state.player.cash;
    const next = executeConvoyBuy(state, convoyId, 'lubeck', 'grain', 10);
    expect(next.player.cash).toBeLessThan(cashBefore);
    const total = next.fleet.ships.reduce((sum, s) => sum + (s.cargo.grain ?? 0), 0);
    expect(total).toBe(10);
  });

  it('refuses a buy exceeding total convoy cargo space', () => {
    let state = withSecondShip(buildStartingState('P'));
    state = executeCreateConvoy(state, ['ship-1', 'ship-2']);
    const convoyId = state.fleet.convoys[0]?.id as string;
    const next = executeConvoyBuy(state, convoyId, 'lubeck', 'grain', 999_999);
    expect(next).toBe(state);
  });

  it('sells distributed cargo and credits cash once', () => {
    let state = withSecondShip(buildStartingState('P'));
    state = executeCreateConvoy(state, ['ship-1', 'ship-2']);
    const convoyId = state.fleet.convoys[0]?.id as string;
    state = executeConvoyBuy(state, convoyId, 'lubeck', 'grain', 10);
    const cashBefore = state.player.cash;
    const next = executeConvoySell(state, convoyId, 'lubeck', 'grain', 10, PROPORTIONAL_DISTRIBUTION);
    expect(next.player.cash).toBeGreaterThan(cashBefore);
    const total = next.fleet.ships.reduce((sum, s) => sum + (s.cargo.grain ?? 0), 0);
    expect(total).toBe(0);
  });
});
