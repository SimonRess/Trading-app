import { describe, it, expect, vi } from 'vitest';
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
  crew: 8,
  cannons: 0,
  insured: false,
  repairCooldown: 0,
  posture: 'defensive',
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

describe('applyEvent market_boom', () => {
  it('creates a market_boost city effect with supply bonus larger than demand bonus', () => {
    const state = buildStartingState('Test');
    const result = applyEvent('market_boom', state);
    expect(result.newCityEffects).toHaveLength(1);
    const effect = result.newCityEffects[0]!;
    expect(effect.type).toBe('market_boost');
    expect(effect.supplyBonus).toBeGreaterThan(effect.demandBonus ?? 0);
    expect(result.messages[0]).toContain('trade boom');
  });
});

describe('applyEvent guild_festival', () => {
  it('gains reputation in the city where a ship is docked', () => {
    const state = buildStartingState('Test'); // starting ship is in port at lubeck
    const result = applyEvent('guild_festival', state);
    expect(result.reputationChange).toEqual({ cityId: 'lubeck', amount: 5, kind: 'gain' });
  });
});

describe('applyEvent reputation_scandal', () => {
  it('loses reputation in the city where a ship is docked', () => {
    const state = buildStartingState('Test');
    const result = applyEvent('reputation_scandal', state);
    expect(result.reputationChange).toEqual({ cityId: 'lubeck', amount: 5, kind: 'loss' });
  });
});

describe('applyEvent shipwreck_salvage', () => {
  it('adds cargo to a ship in transit, capped by cargo space', () => {
    const state = buildStartingState('Test');
    const inTransit: GameState = {
      ...state,
      fleet: { convoys: [], ships: [{ ...state.fleet.ships[0]!, position: { from: 'lubeck', to: 'danzig', turnsRemaining: 1 }, cargo: {} }] },
    };
    const before = inTransit.fleet.ships[0]!.cargo;
    const result = applyEvent('shipwreck_salvage', inTransit);
    const after = result.fleet.ships[0]!.cargo;
    const totalBefore = Object.values(before).reduce((s, v) => s + v, 0);
    const totalAfter = Object.values(after).reduce((s, v) => s + v, 0);
    expect(totalAfter).toBeGreaterThan(totalBefore);
  });
});

describe('applyEvent pirate_raid', () => {
  const inTransitState = (shipOverrides?: Partial<Ship>): GameState => {
    const state = buildStartingState('Test');
    return {
      ...state,
      fleet: { convoys: [], ships: [shipInTransit({ id: state.fleet.ships[0]!.id, name: state.fleet.ships[0]!.name, ...shipOverrides })] },
    };
  };

  it('reports both strengths for a non-flee outcome', () => {
    const state = inTransitState({ cannons: 6, crew: 8, posture: 'aggressive', cargo: { salt: 20 } });
    const result = applyEvent('pirate_raid', state);
    expect(result.messages[0]).toMatch(/Your strength: \d+ vs\. their strength: \d+/);
  });

  it('flee outcome loses cargo but reports no strength comparison', () => {
    const state = inTransitState({ posture: 'flee', cargo: { salt: 20 } });
    const result = applyEvent('pirate_raid', state);
    expect(result.messages[0]).not.toMatch(/strength/);
    expect(result.messages[0]).toContain('fled');
    const totalAfter = Object.values(result.fleet.ships[0]!.cargo).reduce((s, v) => s + v, 0);
    expect(totalAfter).toBeLessThan(20);
  });

  it('an outmatched, unarmed ship can be sunk and removed from the fleet', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.999).mockReturnValue(0);
    const state = inTransitState({ cannons: 0, crew: 0, durability: 10, posture: 'defensive' });
    const result = applyEvent('pirate_raid', state);
    expect(result.fleet.ships).toHaveLength(0);
    expect(result.messages[0]).toContain('sunk');
    vi.restoreAllMocks();
  });
});

describe('applyEvent city_plague', () => {
  it('creates a city-wide plague effect (no goodId)', () => {
    const state = buildStartingState('Test');
    const result = applyEvent('city_plague', state);
    expect(result.newCityEffects).toHaveLength(1);
    expect(result.newCityEffects[0]!.type).toBe('plague');
    expect(result.newCityEffects[0]!.goodId).toBeUndefined();
    expect(result.newCityEffects[0]!.supplyBonus).toBeLessThan(0);
  });
});

describe('applyEvent diplomatic_embargo', () => {
  it('creates an embargo effect on one (city, good) pair', () => {
    const state = buildStartingState('Test');
    const result = applyEvent('diplomatic_embargo', state);
    expect(result.newCityEffects).toHaveLength(1);
    expect(result.newCityEffects[0]!.type).toBe('embargo');
    expect(result.newCityEffects[0]!.goodId).toBeDefined();
  });
});
