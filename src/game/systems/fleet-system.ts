import type { Ship, FleetState, CityId, GoodId } from '../state/types.ts';
import { findRoute } from '../data/routes.ts';
import { SHIP_TYPES } from '../data/ships.ts';

export function isInTransit(ship: Ship): ship is Ship & { position: { from: CityId; to: CityId; turnsRemaining: number } } {
  return typeof ship.position !== 'string';
}

export function isInPort(ship: Ship): ship is Ship & { position: CityId } {
  return typeof ship.position === 'string';
}

export function setDestination(ship: Ship, destination: CityId): Ship {
  if (!isInPort(ship)) return ship;
  if (ship.position === destination) return ship;

  const route = findRoute(ship.position, destination);
  if (!route) return ship;

  // route.turns is already the full travel time "assuming a Kogge at
  // standard speed" (see city-graph.md) — it must not be multiplied by
  // turnsPerLeg again, or every voyage silently takes twice as long as
  // documented.
  return {
    ...ship,
    position: { from: ship.position, to: destination, turnsRemaining: route.turns },
  };
}

export function advanceShips(fleet: FleetState): { fleet: FleetState; arrivals: Array<{ ship: Ship; city: CityId }> } {
  const arrivals: Array<{ ship: Ship; city: CityId }> = [];

  const ships = fleet.ships.map(ship => {
    if (isInPort(ship)) return ship;

    const pos = ship.position as { from: CityId; to: CityId; turnsRemaining: number };
    if (pos.turnsRemaining <= 1) {
      const arrived: Ship = { ...ship, position: pos.to };
      arrivals.push({ ship: arrived, city: pos.to });
      return arrived;
    }

    return { ...ship, position: { ...pos, turnsRemaining: pos.turnsRemaining - 1 } };
  });

  return { fleet: { ships }, arrivals };
}

export function applyStormDamage(fleet: FleetState, damage: number): { fleet: FleetState; wrecked: Ship[] } {
  const wrecked: Ship[] = [];

  const ships = fleet.ships
    .map(ship => {
      if (!isInTransit(ship)) return ship;
      const newDurability = ship.durability - damage;
      if (newDurability <= 0) {
        wrecked.push(ship);
        return null;
      }
      return { ...ship, durability: newDurability };
    })
    .filter((s): s is Ship => s !== null);

  return { fleet: { ships }, wrecked };
}

export function applyPirateRaid(fleet: FleetState): { fleet: FleetState; raidedShipName: string | null; loot: Partial<Record<GoodId, number>> } {
  const inTransit = fleet.ships.filter(isInTransit);
  if (inTransit.length === 0) return { fleet, raidedShipName: null, loot: {} };

  const target = inTransit[Math.floor(Math.random() * inTransit.length)];
  if (!target) return { fleet, raidedShipName: null, loot: {} };
  const loot: Partial<Record<GoodId, number>> = {};

  const newCargo: Partial<Record<GoodId, number>> = {};
  for (const [goodId, qty] of Object.entries(target.cargo) as Array<[GoodId, number]>) {
    if (!qty) continue;
    const seized = Math.floor(qty * 0.15);
    loot[goodId] = seized;
    const remaining = qty - seized;
    if (remaining > 0) newCargo[goodId] = remaining;
  }

  const ships = fleet.ships.map(s =>
    s.id === target.id ? { ...s, cargo: newCargo } : s,
  );

  return { fleet: { ships }, raidedShipName: target.name, loot };
}

export function cargoTotal(ship: Ship): number {
  return Object.values(ship.cargo).reduce<number>((sum, qty) => sum + qty, 0);
}

export function cargoCapacity(ship: Ship): number {
  return SHIP_TYPES[ship.type].cargoCapacity;
}

export function cargoSpace(ship: Ship): number {
  return cargoCapacity(ship) - cargoTotal(ship);
}
