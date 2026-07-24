import { describe, it, expect } from 'vitest';
import { buildStartingState } from '../data/starting-config.ts';
import {
  resolveTurn,
  computeNetWorth,
  executeBuy,
  executeSell,
  executeBuyShip,
  executeRepairShip,
  executeRenameShip,
  executeHireCrew,
  executeReleaseCrew,
  executeBuyCannon,
  executeSellCannon,
} from './turn-system.ts';
import { executeToggleInsurance } from './insurance-system.ts';
import { executeBuyWarehouse } from './warehouse-system.ts';
import { cannonSellValue } from '../data/ships.ts';

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

  it('subtracts outstanding loan principal', () => {
    const state = buildStartingState('TestPlayer');
    const withLoan = { ...state, player: { ...state.player, loan: 500 } };
    expect(computeNetWorth(withLoan)).toBe(computeNetWorth(state) - 500);
  });

  it('includes cannons at resale value', () => {
    const state = buildStartingState('TestPlayer');
    const withCannons = { ...state, fleet: { ships: [{ ...state.fleet.ships[0]!, cannons: 2 }] } };
    expect(computeNetWorth(withCannons)).toBe(computeNetWorth(state) + 2 * cannonSellValue());
  });

  it('includes warehouses at resale value', () => {
    const state = buildStartingState('TestPlayer');
    const withWarehouse = { ...state, warehouses: { lubeck: 1 } };
    expect(computeNetWorth(withWarehouse)).toBe(computeNetWorth(state) + 700);
  });

  it('drifts only by known crew wages when holding cargo across turns without trading', () => {
    let state = buildStartingState('TestPlayer');
    state = executeBuy(state, state.fleet.ships[0]!.id, 'lubeck', 'furs', 10);
    const baseline = computeNetWorth(state);
    const crewWagesPerTurn = state.fleet.ships[0]!.crew * 2;
    for (let t = 0; t < 6; t++) {
      state = resolveTurn(state, { destinations: {} }).state;
    }
    // Cargo is valued at a stable base price and there's no storm damage, so
    // with no trades the only change is crew wages (crew-management.md), a
    // known, flat per-turn cost.
    expect(computeNetWorth(state)).toBe(baseline - crewWagesPerTurn * 6);
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

describe('executeRenameShip', () => {
  it('renames the ship', () => {
    const state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    const next = executeRenameShip(state, shipId, 'Seemöwe');
    expect(next.fleet.ships[0]!.name).toBe('Seemöwe');
  });

  it('trims whitespace and caps length at 30 characters', () => {
    const state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    const next = executeRenameShip(state, shipId, `  ${'A'.repeat(40)}  `);
    expect(next.fleet.ships[0]!.name).toBe('A'.repeat(30));
  });

  it('is available regardless of ship position (not shipyard-restricted)', () => {
    let state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    state = { ...state, fleet: { ships: [{ ...state.fleet.ships[0]!, position: 'riga' as const }] } };
    const next = executeRenameShip(state, shipId, 'Seemöwe');
    expect(next.fleet.ships[0]!.name).toBe('Seemöwe');
  });

  it('rejects a blank or whitespace-only name', () => {
    const state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    expect(executeRenameShip(state, shipId, '')).toBe(state);
    expect(executeRenameShip(state, shipId, '   ')).toBe(state);
  });

  it('is a no-op when the name is unchanged', () => {
    const state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    const next = executeRenameShip(state, shipId, state.fleet.ships[0]!.name);
    expect(next).toBe(state);
  });

  it('is a no-op for an unknown ship id', () => {
    const state = buildStartingState('TestPlayer');
    const next = executeRenameShip(state, 'no-such-ship', 'Seemöwe');
    expect(next).toBe(state);
  });
});

describe('executeHireCrew', () => {
  it('adds one crew and deducts the hire cost at a shipyard city', () => {
    const state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    const before = state.fleet.ships[0]!.crew;
    const beforeCash = state.player.cash;
    const next = executeHireCrew(state, shipId);
    expect(next.fleet.ships[0]!.crew).toBe(before + 1);
    expect(next.player.cash).toBe(beforeCash - 20);
  });

  it('rejects hiring beyond the type\'s crew max', () => {
    let state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    state = { ...state, fleet: { ships: [{ ...state.fleet.ships[0]!, crew: 8 }] } };
    const next = executeHireCrew(state, shipId);
    expect(next).toBe(state);
  });

  it('rejects hiring outside a shipyard city', () => {
    let state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    state = { ...state, fleet: { ships: [{ ...state.fleet.ships[0]!, position: 'riga' as const }] } };
    const next = executeHireCrew(state, shipId);
    expect(next).toBe(state);
  });

  it('rejects hiring if insufficient cash', () => {
    let state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    state = { ...state, player: { ...state.player, cash: 0 } };
    const next = executeHireCrew(state, shipId);
    expect(next).toBe(state);
  });
});

describe('executeReleaseCrew', () => {
  it('removes one crew without refunding cash', () => {
    const state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    const before = state.fleet.ships[0]!.crew;
    const beforeCash = state.player.cash;
    const next = executeReleaseCrew(state, shipId);
    expect(next.fleet.ships[0]!.crew).toBe(before - 1);
    expect(next.player.cash).toBe(beforeCash);
  });

  it('rejects releasing below 0', () => {
    let state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    state = { ...state, fleet: { ships: [{ ...state.fleet.ships[0]!, crew: 0 }] } };
    const next = executeReleaseCrew(state, shipId);
    expect(next).toBe(state);
  });
});

describe('executeBuyCannon', () => {
  it('adds one cannon and deducts the price at a shipyard city', () => {
    const state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    const beforeCash = state.player.cash;
    const next = executeBuyCannon(state, shipId);
    expect(next.fleet.ships[0]!.cannons).toBe(1);
    expect(next.player.cash).toBe(beforeCash - 150);
  });

  it('rejects buying beyond the type\'s cannon max', () => {
    let state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    state = { ...state, fleet: { ships: [{ ...state.fleet.ships[0]!, cannons: 6 }] } };
    const next = executeBuyCannon(state, shipId);
    expect(next).toBe(state);
  });

  it('rejects buying outside a shipyard city', () => {
    let state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    state = { ...state, fleet: { ships: [{ ...state.fleet.ships[0]!, position: 'riga' as const }] } };
    const next = executeBuyCannon(state, shipId);
    expect(next).toBe(state);
  });

  it('rejects buying if insufficient cash', () => {
    let state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    state = { ...state, player: { ...state.player, cash: 0 } };
    const next = executeBuyCannon(state, shipId);
    expect(next).toBe(state);
  });

  it('rejects buying when held cargo would no longer fit the smaller hold', () => {
    let state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    // Kogge holds 50; loaded to exactly 50 leaves no room for -2 cargo space.
    state = { ...state, fleet: { ships: [{ ...state.fleet.ships[0]!, cargo: { salt: 50 } }] } };
    const next = executeBuyCannon(state, shipId);
    expect(next).toBe(state);
  });
});

describe('executeSellCannon', () => {
  it('removes one cannon and refunds 60% of the price', () => {
    const state = executeBuyCannon(buildStartingState('TestPlayer'), buildStartingState('TestPlayer').fleet.ships[0]!.id);
    const shipId = state.fleet.ships[0]!.id;
    const beforeCash = state.player.cash;
    const next = executeSellCannon(state, shipId);
    expect(next.fleet.ships[0]!.cannons).toBe(0);
    expect(next.player.cash).toBe(beforeCash + 90);
  });

  it('rejects selling below 0', () => {
    const state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    const next = executeSellCannon(state, shipId);
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

  it('advances pledged church funds by at most 1% and announces completion', () => {
    const state = buildStartingState('TestPlayer');
    const almostDone = {
      ...state,
      cities: { ...state.cities, hamburg: { ...state.cities.hamburg, churchCompletion: 99, churchPledged: 100 } },
    };
    const { state: next, summary } = resolveTurn(almostDone, { destinations: {} });
    expect(next.cities.hamburg.churchCompletion).toBe(100);
    expect(summary.events.some(e => e.includes('Church of Hamburg') && e.includes('completed'))).toBe(true);
  });

  it('announces incremental church progress even when not yet complete', () => {
    const state = buildStartingState('TestPlayer');
    const pledged = {
      ...state,
      cities: { ...state.cities, hamburg: { ...state.cities.hamburg, churchPledged: 100 } },
    };
    const { summary } = resolveTurn(pledged, { destinations: {} });
    expect(summary.events.some(e => e.includes('Church of Hamburg') && e.includes('+1%'))).toBe(true);
  });

  it('deducts crew wages each turn (2 Mark per sailor)', () => {
    const state = buildStartingState('TestPlayer');
    const crew = state.fleet.ships[0]!.crew;
    const before = state.player.cash;
    const { state: next, summary } = resolveTurn(state, { destinations: {} });
    expect(next.player.cash).toBe(before - crew * 2);
    expect(summary.events.some(e => e.includes('crew wages'))).toBe(true);
  });

  it('accrues 5% compounding loan interest each turn and announces it', () => {
    const state = buildStartingState('TestPlayer');
    const withLoan = { ...state, player: { ...state.player, loan: 1_000 } };
    const { state: next, summary } = resolveTurn(withLoan, { destinations: {} });
    expect(next.player.loan).toBe(1_050);
    expect(summary.events.some(e => e.includes('loan interest'))).toBe(true);
  });

  it('does not announce loan interest when there is no active loan', () => {
    const state = buildStartingState('TestPlayer');
    const { summary } = resolveTurn(state, { destinations: {} });
    expect(summary.events.some(e => e.includes('loan interest'))).toBe(false);
  });

  it('deducts insurance premiums for insured ships each turn', () => {
    const state = buildStartingState('TestPlayer');
    const insured = executeToggleInsurance(state, state.fleet.ships[0]!.id);
    const beforeCash = insured.player.cash;
    const { state: next, summary } = resolveTurn(insured, { destinations: {} });
    expect(next.player.cash).toBe(beforeCash - 20 - 8); // 20 insurance + crew wages (4 * 2)
    expect(summary.events.some(e => e.includes('insurance premiums'))).toBe(true);
  });

  it('does not charge insurance premiums for uninsured ships', () => {
    const state = buildStartingState('TestPlayer');
    const { summary } = resolveTurn(state, { destinations: {} });
    expect(summary.events.some(e => e.includes('insurance premiums'))).toBe(false);
  });

  it('adds warehouse income each turn and reports it in the turn summary', () => {
    const state = buildStartingState('TestPlayer');
    const rich = { ...state, player: { ...state.player, cash: 2_000 } };
    const withWarehouse = executeBuyWarehouse(rich, 'lubeck');
    const beforeCash = withWarehouse.player.cash;
    const { state: next, summary } = resolveTurn(withWarehouse, { destinations: {} });
    expect(next.player.cash).toBe(beforeCash + 15 - 8); // +15 income, -8 crew wages
    expect(summary.events.some(e => e.toLowerCase().includes('warehouse'))).toBe(true);
  });

  it('does not report warehouse income when there are no warehouses', () => {
    const state = buildStartingState('TestPlayer');
    const { summary } = resolveTurn(state, { destinations: {} });
    expect(summary.events.some(e => e.toLowerCase().includes('warehouse'))).toBe(false);
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
