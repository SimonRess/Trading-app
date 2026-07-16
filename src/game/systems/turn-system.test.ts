import { describe, it, expect } from 'vitest';
import { buildStartingState } from '../data/starting-config.ts';
import { resolveTurn, computeNetWorth, executeBuy, executeSell } from './turn-system.ts';

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

  it('returns win outcome when net worth reaches threshold', () => {
    const state = buildStartingState('TestPlayer');
    const richState = { ...state, player: { ...state.player, cash: 9_999 } };
    // net worth = 9999 cash + 400 ship + cargo — will exceed 10000
    const { summary } = resolveTurn(richState, { destinations: {} });
    expect(summary.outcome).toBe('win');
  });

  it('returns lose outcome when max turns elapsed', () => {
    const state = buildStartingState('TestPlayer');
    const finalTurn = { ...state, calendar: { ...state.calendar, turn: 40, maxTurns: 40 } };
    const { summary } = resolveTurn(finalTurn, { destinations: {} });
    expect(summary.outcome).toBe('lose');
  });
});
