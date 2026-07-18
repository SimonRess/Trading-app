import { describe, it, expect } from 'vitest';
import { averageShipRisk, stormDamageForShip, pickPirateTarget, applyEvent } from './event-system.ts';
import { buildInitialRiskState } from './risk-system.ts';
import { buildStartingState } from '../data/starting-config.ts';
import type { Ship, GameState } from '../state/types.ts';

const shipInTransit = (overrides?: Partial<Ship>): Ship => ({
  id: 'ship-1',
  name: 'Wulf',
  type: 'kogge',
  durability: 100,
  position: { from: 'lubeck', to: 'danzig', turnsRemaining: 1 },
  cargo: {},
  ...overrides,
});

describe('averageShipRisk', () => {
  it('is 0 with no ships in transit', () => {
    const risk = buildInitialRiskState();
    expect(averageShipRisk([], risk, 'winter', 'storm')).toBe(0);
  });

  it('is higher on a documented high-risk route/season than a low-risk one', () => {
    const risk = buildInitialRiskState();
    const safe = shipInTransit({ position: { from: 'hamburg', to: 'lubeck', turnsRemaining: 1 } });
    const dangerous = shipInTransit({ position: { from: 'malmo', to: 'riga', turnsRemaining: 1 } });
    const safeRisk = averageShipRisk([safe], risk, 'winter', 'storm');
    const dangerousRisk = averageShipRisk([dangerous], risk, 'winter', 'storm');
    expect(dangerousRisk).toBeGreaterThan(safeRisk);
  });

  it('a route risk modifier scales the average proportionally', () => {
    const risk = buildInitialRiskState();
    const ship = shipInTransit({ position: { from: 'lubeck', to: 'danzig', turnsRemaining: 1 } });
    const base = averageShipRisk([ship], risk, 'summer', 'pirate');

    const elevated = buildInitialRiskState();
    elevated.routeModifiers['danzig-lubeck'] = 1.8;
    const boosted = averageShipRisk([ship], elevated, 'summer', 'pirate');

    expect(boosted).toBeCloseTo(base * 1.8, 5);
  });

  it('adds a durability bonus only for the storm kind', () => {
    const risk = buildInitialRiskState();
    const healthy = shipInTransit({ durability: 100 });
    const worn = shipInTransit({ durability: 60 });
    expect(averageShipRisk([worn], risk, 'spring', 'storm')).toBeGreaterThan(
      averageShipRisk([healthy], risk, 'spring', 'storm'),
    );
    // Pirate risk is unaffected by durability.
    expect(averageShipRisk([worn], risk, 'spring', 'pirate')).toBeCloseTo(
      averageShipRisk([healthy], risk, 'spring', 'pirate'),
      5,
    );
  });
});

describe('stormDamageForShip', () => {
  it('is within the documented [6, 22] clamp', () => {
    const risk = buildInitialRiskState();
    const ship = shipInTransit();
    const damage = stormDamageForShip(ship, risk, 'winter');
    expect(damage).toBeGreaterThanOrEqual(6);
    expect(damage).toBeLessThanOrEqual(22);
  });

  it('deals more damage on a higher-risk route', () => {
    const risk = buildInitialRiskState();
    const safe = shipInTransit({ position: { from: 'hamburg', to: 'lubeck', turnsRemaining: 1 } });
    const dangerous = shipInTransit({ position: { from: 'malmo', to: 'riga', turnsRemaining: 1 } });
    expect(stormDamageForShip(dangerous, risk, 'winter')).toBeGreaterThan(
      stormDamageForShip(safe, risk, 'winter'),
    );
  });

  it('deals more damage to a damaged ship than a seaworthy one on the same route', () => {
    const risk = buildInitialRiskState();
    const seaworthy = shipInTransit({ durability: 100 });
    const damaged = shipInTransit({ durability: 30 });
    expect(stormDamageForShip(damaged, risk, 'winter')).toBeGreaterThan(
      stormDamageForShip(seaworthy, risk, 'winter'),
    );
  });

  it('is 0 for a ship in port', () => {
    const risk = buildInitialRiskState();
    const inPort = shipInTransit({ position: 'lubeck' });
    expect(stormDamageForShip(inPort, risk, 'winter')).toBe(0);
  });
});

describe('pickPirateTarget', () => {
  it('returns null with no ships in transit', () => {
    const risk = buildInitialRiskState();
    expect(pickPirateTarget([], risk, 'summer')).toBeNull();
  });

  it('always picks the only ship in transit', () => {
    const risk = buildInitialRiskState();
    const ship = shipInTransit();
    expect(pickPirateTarget([ship], risk, 'summer')?.id).toBe(ship.id);
  });

  it('favours the higher pirate-risk route over many trials', () => {
    const risk = buildInitialRiskState();
    const safe = shipInTransit({ id: 'safe', position: { from: 'hamburg', to: 'lubeck', turnsRemaining: 1 } });
    const dangerous = shipInTransit({ id: 'dangerous', position: { from: 'malmo', to: 'riga', turnsRemaining: 1 } });

    let dangerousPicks = 0;
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      const target = pickPirateTarget([safe, dangerous], risk, 'summer');
      if (target?.id === 'dangerous') dangerousPicks++;
    }
    // hamburg-lubeck summer pirateRisk 0.04 vs malmo-riga summer 0.10 -> dangerous
    // should be picked roughly 0.10/(0.10+0.04) ≈ 71% of the time.
    expect(dangerousPicks / trials).toBeGreaterThan(0.55);
  });
});

describe('applyEvent bumper_harvest', () => {
  it('scales the supply bonus by the city risk modifier', () => {
    const state: GameState = buildStartingState('Test');
    // Start well below the 100 cap so the bonus isn't clamped, isolating
    // the modifier's effect from the "min(100, ...)" ceiling.
    const lowSupplyState: GameState = {
      ...state,
      calendar: { ...state.calendar, season: 'summer' },
      market: {
        ...state.market,
        danzig: { ...state.market.danzig, grain: { ...state.market.danzig.grain, supply: 10 } },
      },
      risk: { ...state.risk, cityModifiers: { ...state.risk.cityModifiers, danzig: 1.5 } },
    };
    const before = lowSupplyState.market.danzig.grain.supply;
    const result = applyEvent('bumper_harvest', lowSupplyState);
    const after = result.market.danzig.grain.supply;
    expect(after - before).toBe(Math.round(30 * 1.5));
  });
});
