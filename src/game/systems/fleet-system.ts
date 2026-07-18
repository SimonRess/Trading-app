import type { Ship, FleetState, CityId, GoodId } from '../state/types.ts';
import { findRoute } from '../data/routes.ts';
import { SHIP_TYPES, canDepart, durabilityTravelTimePenalty, speedRatio } from '../data/ships.ts';

export function isInTransit(ship: Ship): ship is Ship & { position: { from: CityId; to: CityId; turnsRemaining: number } } {
  return typeof ship.position !== 'string';
}

export function isInPort(ship: Ship): ship is Ship & { position: CityId } {
  return typeof ship.position === 'string';
}

export function setDestination(ship: Ship, destination: CityId): Ship {
  if (!isInPort(ship)) return ship;
  if (ship.position === destination) return ship;
  if (!canDepart(ship.durability)) return ship;

  const route = findRoute(ship.position, destination);
  if (!route) return ship;

  // route.turns is the Kogge-standard travel time (see city-graph.md) — for
  // a Kogge, speedRatio() is exactly 1.0, so this reduces to the original
  // fixed value (the earlier "doubled travel time" bug came from multiplying
  // route.turns by turnsPerLeg directly instead of by a ratio relative to
  // the Kogge). Other ship types scale it: a Hulk (turnsPerLeg 3) takes 1.5x
  // as long, a Schnigge (turnsPerLeg 1) takes half as long, floored at 1
  // turn. A Damaged ship (26-50 durability) additionally takes +1 turn
  // (ship-stats.md durability thresholds); MVP routes are always a single
  // leg, so this is a flat +1 regardless of ship type.
  const baseTurns = Math.max(1, Math.round(route.turns * speedRatio(ship.type)));
  const turns = baseTurns + durabilityTravelTimePenalty(ship.durability);

  return {
    ...ship,
    position: { from: ship.position, to: destination, turnsRemaining: turns },
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

// damageForShip lets the caller (event-system.ts) vary damage per ship
// based on that ship's route risk and durability status — see
// docs/design/event-table.md "Per-Route & Session Risk".
export function applyStormDamage(
  fleet: FleetState,
  damageForShip: (ship: Ship) => number,
): { fleet: FleetState; wrecked: Ship[] } {
  const wrecked: Ship[] = [];

  const ships = fleet.ships
    .map(ship => {
      if (!isInTransit(ship)) return ship;
      const newDurability = ship.durability - damageForShip(ship);
      if (newDurability <= 0) {
        wrecked.push(ship);
        return null;
      }
      return { ...ship, durability: newDurability };
    })
    .filter((s): s is Ship => s !== null);

  return { fleet: { ships }, wrecked };
}

// targetShipId is chosen by the caller (event-system.ts), weighted by
// route pirate-risk — this function only applies the raid once a target is
// already decided, keeping the RNG centralised in one place.
export function applyPirateRaid(
  fleet: FleetState,
  targetShipId: string,
): { fleet: FleetState; raidedShipName: string | null; loot: Partial<Record<GoodId, number>> } {
  const target = fleet.ships.find(s => s.id === targetShipId);
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
