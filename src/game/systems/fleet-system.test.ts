import { describe, it, expect } from 'vitest';
import type { Ship, FleetState } from '../state/types.ts';
import {
  isInPort,
  isInTransit,
  setDestination,
  advanceShips,
  applyStormDamage,
  applyPirateRaid,
  cargoSpace,
} from './fleet-system.ts';

const koggeInPort = (overrides?: Partial<Ship>): Ship => ({
  id: 'ship-1',
  name: 'Wulf',
  type: 'kogge',
  durability: 100,
  position: 'lubeck',
  cargo: {},
  ...overrides,
});

const koggeInTransit = (overrides?: Partial<Ship>): Ship => ({
  ...koggeInPort(),
  position: { from: 'lubeck', to: 'danzig', turnsRemaining: 2 },
  ...overrides,
});

describe('isInPort / isInTransit', () => {
  it('identifies port ship', () => {
    expect(isInPort(koggeInPort())).toBe(true);
    expect(isInTransit(koggeInPort())).toBe(false);
  });

  it('identifies transit ship', () => {
    expect(isInTransit(koggeInTransit())).toBe(true);
    expect(isInPort(koggeInTransit())).toBe(false);
  });
});

describe('setDestination', () => {
  it('creates a route with correct turns', () => {
    const ship = koggeInPort();
    const result = setDestination(ship, 'danzig');
    expect(isInTransit(result)).toBe(true);
    if (isInTransit(result)) {
      expect((result.position as { turnsRemaining: number }).turnsRemaining).toBe(4); // 2 legs × 2 turns/leg
    }
  });

  it('does nothing if ship is not in port', () => {
    const ship = koggeInTransit();
    const result = setDestination(ship, 'hamburg');
    expect(result).toEqual(ship);
  });

  it('does nothing if destination equals current position', () => {
    const ship = koggeInPort();
    const result = setDestination(ship, 'lubeck');
    expect(result).toEqual(ship);
  });

  it('does nothing if no route exists', () => {
    const ship = koggeInPort();
    const result = setDestination(ship, 'riga'); // no direct route lubeck→riga
    expect(result).toEqual(ship);
  });
});

describe('advanceShips', () => {
  it('counts down turns remaining', () => {
    const fleet: FleetState = { ships: [koggeInTransit()] };
    const { fleet: next, arrivals } = advanceShips(fleet);
    expect(arrivals).toHaveLength(0);
    const pos = next.ships[0]!.position as { turnsRemaining: number };
    expect(pos.turnsRemaining).toBe(1);
  });

  it('delivers ship on final turn', () => {
    const ship = koggeInTransit({ position: { from: 'lubeck', to: 'danzig', turnsRemaining: 1 } });
    const fleet: FleetState = { ships: [ship] };
    const { fleet: next, arrivals } = advanceShips(fleet);
    expect(arrivals).toHaveLength(1);
    expect(arrivals[0]!.city).toBe('danzig');
    expect(next.ships[0]!.position).toBe('danzig');
  });

  it('does not move ships in port', () => {
    const fleet: FleetState = { ships: [koggeInPort()] };
    const { fleet: next, arrivals } = advanceShips(fleet);
    expect(arrivals).toHaveLength(0);
    expect(next.ships[0]!.position).toBe('lubeck');
  });
});

describe('applyStormDamage', () => {
  it('damages ships in transit', () => {
    const fleet: FleetState = { ships: [koggeInTransit()] };
    const { fleet: next } = applyStormDamage(fleet, 10);
    expect(next.ships[0]!.durability).toBe(90);
  });

  it('does not damage ships in port', () => {
    const fleet: FleetState = { ships: [koggeInPort()] };
    const { fleet: next } = applyStormDamage(fleet, 10);
    expect(next.ships[0]!.durability).toBe(100);
  });

  it('wrecks ships at 0 durability', () => {
    const ship = koggeInTransit({ durability: 10 });
    const { fleet: next, wrecked } = applyStormDamage({ ships: [ship] }, 10);
    expect(wrecked).toHaveLength(1);
    expect(next.ships).toHaveLength(0);
  });
});

describe('applyPirateRaid', () => {
  it('takes 15% of cargo proportionally', () => {
    const ship = koggeInTransit({ cargo: { salt: 20, grain: 10 } });
    const { fleet: next, raidedShipName } = applyPirateRaid({ ships: [ship] });
    expect(raidedShipName).toBe('Wulf');
    const remaining = next.ships[0]!.cargo;
    expect(remaining['salt']).toBe(17); // 20 - floor(20*0.15) = 20-3
    expect(remaining['grain']).toBe(9); // 10 - floor(10*0.15) = 10-1
  });

  it('returns null if no ships in transit', () => {
    const fleet: FleetState = { ships: [koggeInPort()] };
    const { raidedShipName } = applyPirateRaid(fleet);
    expect(raidedShipName).toBeNull();
  });
});

describe('cargoSpace', () => {
  it('returns full capacity for empty ship', () => {
    expect(cargoSpace(koggeInPort())).toBe(50);
  });

  it('accounts for loaded cargo', () => {
    const ship = koggeInPort({ cargo: { salt: 20, grain: 10 } });
    expect(cargoSpace(ship)).toBe(20);
  });
});
