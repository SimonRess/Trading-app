import { describe, it, expect, vi } from 'vitest';
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
  executeChooseHeir,
} from './turn-system.ts';
import { executeToggleInsurance } from './insurance-system.ts';
import { executeBuyWarehouse } from './warehouse-system.ts';
import { cannonSellValue } from '../data/ships.ts';
import type { CityEffect, Child } from '../state/types.ts';

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

describe('executeChooseHeir', () => {
  function pendingState() {
    // Pin Math.random so child health decay this turn is deterministic
    // (age/10 exactly, no random component).
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const state = buildStartingState('TestPlayer');
    const heirA: Child = { id: 'a', name: 'Grete', age: 15, gender: 'female', health: 80, traits: ['charismatic'], tutoredThisYear: false };
    const heirB: Child = { id: 'b', name: 'Hans', age: 12, gender: 'male', health: 70, traits: [], tutoredThisYear: false };
    const dying = { ...state, player: { ...state.player, health: 0, children: [heirA, heirB], reputation: { ...state.player.reputation, lubeck: 40 } } };
    const result = resolveTurn(dying, { destinations: {} }).state;
    vi.restoreAllMocks();
    return result;
  }

  it('applies the chosen child as the new player and clears pendingSuccession', () => {
    const paused = pendingState();
    const next = executeChooseHeir(paused, 'b');
    expect(next.pendingSuccession).toBeNull();
    expect(next.player.name).toBe('Hans');
    expect(next.player.age).toBe(12);
    expect(next.player.health).toBeCloseTo(70 - 12 / 40);
    expect(next.player.traits).toEqual([]);
    expect(next.player.reputation.lubeck).toBe(20); // halved from 40, snapshotted at death
  });

  it('can choose the other candidate too', () => {
    const paused = pendingState();
    const next = executeChooseHeir(paused, 'a');
    expect(next.player.name).toBe('Grete');
    expect(next.player.traits).toEqual(['charismatic']);
  });

  it('is a no-op with no pending succession', () => {
    const state = buildStartingState('TestPlayer');
    const next = executeChooseHeir(state, 'a');
    expect(next).toBe(state);
  });

  it('is a no-op for an unknown candidate id', () => {
    const paused = pendingState();
    const next = executeChooseHeir(paused, 'no-such-child');
    expect(next).toBe(paused);
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

  it('does not win on net worth alone — only reaching Mayor wins (ADR-021)', () => {
    const state = buildStartingState('TestPlayer');
    const richState = { ...state, player: { ...state.player, cash: 9_999 } };
    // net worth exceeds 10,000, but Lübeck reputation doesn't clear the
    // Mayor threshold, so this must not win.
    const { summary } = resolveTurn(richState, { destinations: {} });
    expect(summary.outcome).not.toBe('win');
  });

  it('does not re-trigger the win outcome on a later turn once hasWon is set', () => {
    const state = buildStartingState('TestPlayer');
    const alreadyWon = {
      ...state,
      player: { ...state.player, cash: 9_600, politicalRank: 3 as const, reputation: { ...state.player.reputation, lubeck: 75 } },
      hasWon: true,
    };
    const { summary } = resolveTurn(alreadyWon, { destinations: {} });
    expect(summary.outcome).toBeNull();
  });

  it('winning does not prevent a later lose outcome (e.g. bankruptcy)', () => {
    const state = buildStartingState('TestPlayer');
    const wonButBroke = {
      ...state,
      player: { ...state.player, cash: -1_000, politicalRank: 3 as const, reputation: { ...state.player.reputation, lubeck: 75 } },
      hasWon: true,
    };
    const { summary } = resolveTurn(wonButBroke, { destinations: {} });
    expect(summary.outcome).toBe('lose');
  });

  it('returns lose outcome when max turns elapsed', () => {
    const state = buildStartingState('TestPlayer');
    const finalTurn = { ...state, calendar: { ...state.calendar, turn: 40, maxTurns: 40 } };
    const { summary } = resolveTurn(finalTurn, { destinations: {} });
    expect(summary.outcome).toBe('lose');
  });

  it('promotes political rank and announces it once thresholds are met', () => {
    // Pin Math.random so no random event nudges reputation this turn.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const state = buildStartingState('TestPlayer');
    const eligible = {
      ...state,
      player: { ...state.player, cash: 2_000, reputation: { ...state.player.reputation, lubeck: 30 } },
    };
    const { state: next, summary } = resolveTurn(eligible, { destinations: {} });
    expect(next.player.politicalRank).toBe(1);
    expect(summary.events.some(e => e.includes('Guild'))).toBe(true);
    vi.restoreAllMocks();
  });

  it('reaching Mayor rank triggers a win outcome', () => {
    // Pin Math.random so no random event (which could nudge Lübeck
    // reputation) fires this turn — keeps the rank-threshold check
    // deterministic.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const state = buildStartingState('TestPlayer');
    const eligible = {
      ...state,
      player: { ...state.player, cash: 9_600, reputation: { ...state.player.reputation, lubeck: 75 } },
    };
    const { state: next, summary } = resolveTurn(eligible, { destinations: {} });
    expect(next.player.politicalRank).toBe(3);
    expect(summary.outcome).toBe('win');
    vi.restoreAllMocks();
  });

  it('does not promote rank when only one condition is met', () => {
    const state = buildStartingState('TestPlayer');
    const richButUnknown = { ...state, player: { ...state.player, cash: 5_000 } };
    const { state: next } = resolveTurn(richButUnknown, { destinations: {} });
    expect(next.player.politicalRank).toBe(0);
  });

  it('decays player health every turn', () => {
    const state = buildStartingState('TestPlayer');
    const before = state.player.health;
    const { state: next } = resolveTurn(state, { destinations: {} });
    expect(next.player.health).toBeLessThan(before);
  });

  it('decays and can kill a child, reporting it in the turn summary', () => {
    const state = buildStartingState('TestPlayer');
    const child: Child = { id: 'c1', name: 'Hans', age: 5, gender: 'male', health: 0, traits: [], tutoredThisYear: false };
    const withChild = { ...state, player: { ...state.player, children: [child] } };
    const { state: next, summary } = resolveTurn(withChild, { destinations: {} });
    expect(next.player.children).toHaveLength(0);
    expect(summary.events.some(e => e.includes('Hans') && e.includes('died'))).toBe(true);
  });

  it('succeeds to the oldest eligible child when the player dies', () => {
    // Pin Math.random so no random event nudges reputation this turn,
    // keeping the halving math deterministic.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const state = buildStartingState('TestPlayer');
    const heir: Child = { id: 'heir', name: 'Grete', age: 15, gender: 'female', health: 80, traits: ['charismatic'], tutoredThisYear: false };
    const tooYoung: Child = { id: 'young', name: 'Peter', age: 5, gender: 'male', health: 80, traits: [], tutoredThisYear: false };
    const dying = {
      ...state,
      player: { ...state.player, health: 0, children: [tooYoung, heir], reputation: { ...state.player.reputation, lubeck: 40 } },
    };
    const { state: next, summary } = resolveTurn(dying, { destinations: {} });
    expect(next.player.name).toBe('Grete');
    expect(next.player.age).toBe(15);
    expect(next.player.traits).toEqual(['charismatic']);
    expect(next.player.maritalStatus).toBe('single');
    expect(next.player.reputation.lubeck).toBe(20); // halved from 40
    expect(summary.events.some(e => e.includes('Grete'))).toBe(true);
    vi.restoreAllMocks();
  });

  it('loses the game when the player dies with no eligible heir', () => {
    const state = buildStartingState('TestPlayer');
    const dying = { ...state, player: { ...state.player, health: 0, children: [] } };
    const { summary } = resolveTurn(dying, { destinations: {} });
    expect(summary.outcome).toBe('lose');
  });

  it('does not select a child under the heir-eligible age', () => {
    const state = buildStartingState('TestPlayer');
    const tooYoung: Child = { id: 'young', name: 'Peter', age: 5, gender: 'male', health: 80, traits: [], tutoredThisYear: false };
    const dying = { ...state, player: { ...state.player, health: 0, children: [tooYoung] } };
    const { summary } = resolveTurn(dying, { destinations: {} });
    expect(summary.outcome).toBe('lose');
  });

  it('pauses for a heir choice when more than one child is eligible, instead of auto-picking', () => {
    const state = buildStartingState('TestPlayer');
    const heirA: Child = { id: 'a', name: 'Grete', age: 15, gender: 'female', health: 80, traits: [], tutoredThisYear: false };
    const heirB: Child = { id: 'b', name: 'Hans', age: 12, gender: 'male', health: 80, traits: [], tutoredThisYear: false };
    const dying = { ...state, player: { ...state.player, health: 0, children: [heirA, heirB] } };
    const { state: next, summary } = resolveTurn(dying, { destinations: {} });
    expect(next.pendingSuccession).not.toBeNull();
    expect(next.pendingSuccession?.candidates.map(c => c.id).sort()).toEqual(['a', 'b']);
    expect(next.player.name).toBe('TestPlayer'); // unchanged — not yet succeeded
    expect(summary.outcome).toBeNull(); // paused, not a loss
    expect(summary.events.some(e => e.includes('Choose'))).toBe(true);
  });

  it('does not resolve further turns while a heir choice is pending', () => {
    const state = buildStartingState('TestPlayer');
    const heirA: Child = { id: 'a', name: 'Grete', age: 15, gender: 'female', health: 80, traits: [], tutoredThisYear: false };
    const heirB: Child = { id: 'b', name: 'Hans', age: 12, gender: 'male', health: 80, traits: [], tutoredThisYear: false };
    const dying = { ...state, player: { ...state.player, health: 0, children: [heirA, heirB] } };
    const { state: paused } = resolveTurn(dying, { destinations: {} });
    const { state: still, summary } = resolveTurn(paused, { destinations: {} });
    expect(still).toBe(paused);
    expect(summary.events).toEqual([]);
    expect(summary.outcome).toBeNull();
  });

  it('expires city effects after their duration and applies event-created ones', () => {
    const state = buildStartingState('TestPlayer');
    const effect: CityEffect = { cityId: 'hamburg', goodId: 'salt', type: 'embargo', turnsRemaining: 1 };
    const withEffect = { ...state, cityEffects: [effect] };
    const { state: next } = resolveTurn(withEffect, { destinations: {} });
    // The pre-existing effect (turnsRemaining 1) should have expired.
    expect(next.cityEffects.some(e => e.cityId === 'hamburg' && e.goodId === 'salt')).toBe(false);
  });

  it('advances a full year (age, birth chance, child growth) on the Spring rollover', () => {
    const state = buildStartingState('TestPlayer');
    // calendar starts at spring turn 1; advancing 4 turns rolls into the
    // next spring, incrementing year and player age.
    let current = state;
    for (let i = 0; i < 4; i++) {
      current = resolveTurn(current, { destinations: {} }).state;
    }
    expect(current.calendar.season).toBe('spring');
    expect(current.player.age).toBe(state.player.age + 1);
  });
});

describe('executeBuy trait and embargo interactions', () => {
  it('applies the penny-pincher discount to purchase price', () => {
    const state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    const withTrait = { ...state, player: { ...state.player, traits: ['penny-pincher' as const] } };
    const plain = executeBuy(state, shipId, 'lubeck', 'furs', 10);
    const discounted = executeBuy(withTrait, shipId, 'lubeck', 'furs', 10);
    const plainCost = state.player.cash - plain.player.cash;
    const discountedCost = withTrait.player.cash - discounted.player.cash;
    expect(discountedCost).toBeLessThan(plainCost);
  });

  it('rejects buying an embargoed good', () => {
    const state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    const embargoed = {
      ...state,
      cityEffects: [{ cityId: 'lubeck' as const, goodId: 'grain' as const, type: 'embargo' as const, turnsRemaining: 2 }],
    };
    const next = executeBuy(embargoed, shipId, 'lubeck', 'grain', 1);
    expect(next).toBe(embargoed);
  });

  it('rejects selling an embargoed good', () => {
    const state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    const embargoed = {
      ...state,
      cityEffects: [{ cityId: 'lubeck' as const, goodId: 'salt' as const, type: 'embargo' as const, turnsRemaining: 2 }],
    };
    const next = executeSell(embargoed, shipId, 'lubeck', 'salt', 1);
    expect(next).toBe(embargoed);
  });
});
