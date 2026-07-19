import { describe, it, expect } from 'vitest';
import { buildStartingState } from '../data/starting-config.ts';
import {
  resolveTurn,
  computeNetWorth,
  executeBuy,
  executeSell,
  executeBuyShip,
  executeRepairShip,
} from './turn-system.ts';

describe('computeNetWorth', () => {
  it('includes cash + ship value + cargo value', () => {
    const state = buildStartingState('TestPlayer');
    const worth = computeNetWorth(state);
    expect(worth).toBeGreaterThan(state.player.cash);
  });

  it('ship at full durability contributes 400 to net worth', () => {
    const state = buildStartingState('TestPlayer');
    const ship = state.fleet.ships[0]!;
    expect(ship.durability).toBe(100);
    const worth = computeNetWorth(state);
    expect(worth).toBeGreaterThan(900); // 500 cash + 400 ship + cargo
  });

  it('does not drift when holding cargo across turns without trading', () => {
    let state = buildStartingState('TestPlayer');
    state = executeBuy(state, state.fleet.ships[0]!.id, 'lubeck', 'furs', 10);
    const baseline = computeNetWorth(state);
    for (let t = 0; t < 6; t++) {
      state = resolveTurn(state, { destinations: {} }).state;
    }
    // Cargo is valued at a stable base price, so with no trades and no storm
    // damage, net worth must not change.
    expect(computeNetWorth(state)).toBe(baseline);
  });
});

describe('executeBuy', () => {
  it('deducts cash and adds cargo', () => {
    const state = buildStartingState('TestPlayer');
    const ship = state.fleet.ships[0]!;
    const cityId = ship.position as 'lubeck';
    const before = state.player.cash;

    const next = executeBuy(state, ship.id, cityId, 'grain', 5);
    expect(next.player.cash).toBeLessThan(before);
    expect(next.fleet.ships[0]!.cargo['grain']).toBe(5);
  });

  it('rejects buy if ship not in city', () => {
    const state = buildStartingState('TestPlayer');
    const ship = state.fleet.ships[0]!;
    const next = executeBuy(state, ship.id, 'hamburg', 'grain', 5);
    expect(next).toBe(state);
  });

  it('rejects buy if insufficient cash', () => {
    const state = buildStartingState('TestPlayer');
    const ship = state.fleet.ships[0]!;
    const poorState = { ...state, player: { ...state.player, cash: 0 } };
    const next = executeBuy(poorState, ship.id, 'lubeck', 'grain', 5);
    expect(next).toBe(poorState);
  });
});

describe('executeSell', () => {
  it('adds cash and removes cargo', () => {
    const state = buildStartingState('TestPlayer');
    const ship = state.fleet.ships[0]!;
    const before = state.player.cash;

    const next = executeSell(state, ship.id, 'lubeck', 'salt', 10);
    expect(next.player.cash).toBeGreaterThan(before);
    expect((next.fleet.ships[0]!.cargo['salt'] ?? 0)).toBe(10);
  });

  it('rejects sell if insufficient cargo', () => {
    const state = buildStartingState('TestPlayer');
    const ship = state.fleet.ships[0]!;
    const next = executeSell(state, ship.id, 'lubeck', 'salt', 999);
    expect(next).toBe(state);
  });

  it('gains reputation in the city where the sale happened', () => {
    const state = buildStartingState('TestPlayer');
    const ship = state.fleet.ships[0]!;
    const before = state.player.reputation.lubeck;
    const next = executeSell(state, ship.id, 'lubeck', 'salt', 10);
    expect(next.player.reputation.lubeck).toBe(before + 1);
  });
});

describe('executeBuyShip', () => {
  it('deducts cash and adds a new ship in port', () => {
    const state = buildStartingState('TestPlayer');
    const before = state.player.cash;
    const next = executeBuyShip(state, 'lubeck', 'kogge');
    expect(next.fleet.ships).toHaveLength(2);
    expect(next.player.cash).toBe(before - 400);
    const newShip = next.fleet.ships[1]!;
    expect(newShip.position).toBe('lubeck');
    expect(newShip.durability).toBe(100);
  });

  it('rejects buying at a non-shipyard city', () => {
    const state = buildStartingState('TestPlayer');
    const next = executeBuyShip(state, 'riga', 'kogge');
    expect(next).toBe(state);
  });

  it('rejects buying if insufficient cash', () => {
    const state = buildStartingState('TestPlayer');
    const poorState = { ...state, player: { ...state.player, cash: 0 } };
    const next = executeBuyShip(poorState, 'lubeck', 'kogge');
    expect(next).toBe(poorState);
  });

  it('rejects buying beyond the fleet cap', () => {
    let state = buildStartingState('TestPlayer');
    state = { ...state, player: { ...state.player, cash: 10_000 } };
    state = executeBuyShip(state, 'lubeck', 'kogge');
    state = executeBuyShip(state, 'lubeck', 'kogge');
    expect(state.fleet.ships).toHaveLength(3);
    const next = executeBuyShip(state, 'lubeck', 'kogge');
    expect(next).toBe(state);
  });

  it('buys a Hulk at its own price and capacity', () => {
    const state = buildStartingState('TestPlayer');
    const richState = { ...state, player: { ...state.player, cash: 1000 } };
    const next = executeBuyShip(richState, 'lubeck', 'hulk');
    expect(next.player.cash).toBe(1000 - 800);
    expect(next.fleet.ships[1]!.type).toBe('hulk');
  });

  it('buys a Schnigge at its own price', () => {
    const state = buildStartingState('TestPlayer');
    const before = state.player.cash;
    const next = executeBuyShip(state, 'lubeck', 'schnigge');
    expect(next.player.cash).toBe(before - 250);
    expect(next.fleet.ships[1]!.type).toBe('schnigge');
  });
});

describe('executeRepairShip', () => {
  it('restores durability to 100 and deducts cost', () => {
    let state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    state = {
      ...state,
      fleet: { ships: state.fleet.ships.map(s => (s.id === shipId ? { ...s, durability: 60 } : s)) },
    };
    const before = state.player.cash;
    const next = executeRepairShip(state, shipId);
    expect(next.fleet.ships[0]!.durability).toBe(100);
    expect(next.player.cash).toBe(before - 80); // 40 points * 2 Mark
  });

  it('rejects repair when already at full durability', () => {
    const state = buildStartingState('TestPlayer');
    const next = executeRepairShip(state, state.fleet.ships[0]!.id);
    expect(next).toBe(state);
  });

  it('rejects repair outside a shipyard city', () => {
    let state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    state = {
      ...state,
      fleet: { ships: state.fleet.ships.map(s => (s.id === shipId ? { ...s, durability: 50, position: 'riga' as const } : s)) },
    };
    const next = executeRepairShip(state, shipId);
    expect(next).toBe(state);
  });

  it('rejects repair if insufficient cash', () => {
    let state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    state = {
      ...state,
      player: { ...state.player, cash: 0 },
      fleet: { ships: state.fleet.ships.map(s => (s.id === shipId ? { ...s, durability: 50 } : s)) },
    };
    const next = executeRepairShip(state, shipId);
    expect(next).toBe(state);
  });
});

describe('resolveTurn', () => {
  it('advances calendar', () => {
    const state = buildStartingState('TestPlayer');
    const { state: next } = resolveTurn(state, { destinations: {} });
    expect(next.calendar.turn).toBe(2);
  });

  it('does not mutate original state', () => {
    const state = buildStartingState('TestPlayer');
    const turnBefore = state.calendar.turn;
    resolveTurn(state, { destinations: {} });
    expect(state.calendar.turn).toBe(turnBefore);
  });

  it('returns win outcome when net worth reaches threshold, and sets hasWon', () => {
    const state = buildStartingState('TestPlayer');
    const richState = { ...state, player: { ...state.player, cash: 9_999 } };
    // net worth = 9999 cash + 400 ship + cargo — will exceed 10000
    const { state: next, summary } = resolveTurn(richState, { destinations: {} });
    expect(summary.outcome).toBe('win');
    expect(next.hasWon).toBe(true);
  });

  it('does not re-trigger the win outcome on a later turn once hasWon is set', () => {
    const state = buildStartingState('TestPlayer');
    const alreadyWon = { ...state, player: { ...state.player, cash: 9_999 }, hasWon: true };
    const { summary } = resolveTurn(alreadyWon, { destinations: {} });
    expect(summary.outcome).toBeNull();
  });

  it('winning does not prevent a later lose outcome (e.g. running out of turns)', () => {
    const state = buildStartingState('TestPlayer');
    const wonButOutOfTime = {
      ...state,
      player: { ...state.player, cash: 9_999 },
      hasWon: true,
      calendar: { ...state.calendar, turn: 40, maxTurns: 40 },
    };
    const { summary } = resolveTurn(wonButOutOfTime, { destinations: {} });
    expect(summary.outcome).toBe('lose');
  });

  it('returns lose outcome when max turns elapsed', () => {
    const state = buildStartingState('TestPlayer');
    const finalTurn = { ...state, calendar: { ...state.calendar, turn: 40, maxTurns: 40 } };
    const { summary } = resolveTurn(finalTurn, { destinations: {} });
    expect(summary.outcome).toBe('lose');
  });

  it('promotes political rank and announces it once thresholds are met', () => {
    const state = buildStartingState('TestPlayer');
    const eligible = {
      ...state,
      player: { ...state.player, cash: 2_000, reputation: { ...state.player.reputation, lubeck: 30 } },
    };
    const { state: next, summary } = resolveTurn(eligible, { destinations: {} });
    expect(next.player.politicalRank).toBe(1);
    expect(summary.events.some(e => e.includes('Guild'))).toBe(true);
  });

  it('reaching Mayor rank triggers a win outcome', () => {
    const state = buildStartingState('TestPlayer');
    // The Mayor threshold's own net-worth bar (10,000) already coincides
    // with the flat net-worth win condition, so this also exercises that
    // both conditions land on the same turn without double-counting.
    const eligible = {
      ...state,
      player: { ...state.player, cash: 9_600, reputation: { ...state.player.reputation, lubeck: 75 } },
    };
    const { state: next, summary } = resolveTurn(eligible, { destinations: {} });
    expect(next.player.politicalRank).toBe(3);
    expect(summary.outcome).toBe('win');
  });

  it('does not promote rank when only one condition is met', () => {
    const state = buildStartingState('TestPlayer');
    const richButUnknown = { ...state, player: { ...state.player, cash: 5_000 } };
    const { state: next } = resolveTurn(richButUnknown, { destinations: {} });
    expect(next.player.politicalRank).toBe(0);
  });
});
