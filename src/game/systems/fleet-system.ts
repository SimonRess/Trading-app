import type { Ship, FleetState, CityId, GoodId } from '../state/types.ts';
import { findRoute } from '../data/routes.ts';
import {
  SHIP_TYPES,
  canDepart,
  durabilityTravelTimePenalty,
  crewTravelTimePenalty,
  speedRatio,
  CANNON_CARGO_COST,
} from '../data/ships.ts';
import type { CombatResult } from './combat-system.ts';

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
  if (ship.repairCooldown > 0) return ship;

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
  // leg, so this is a flat +1 regardless of ship type. An under-crewed ship
  // (crew-management.md) adds another +1 turn on top, independent of and
  // stackable with the durability penalty.
  const baseTurns = Math.max(1, Math.round(route.turns * speedRatio(ship.type)));
  const turns = baseTurns + durabilityTravelTimePenalty(ship.durability) + crewTravelTimePenalty(ship.type, ship.crew);

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

  return { fleet: { ...fleet, ships }, arrivals };
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

  return { fleet: { ...fleet, ships }, wrecked };
}

// Applies a CombatResult (event-system.ts's pirate_raid, via
// combat-system.ts's resolveCombat) to the targeted ship: cargo lost to
// the fraction rolled, any victory loot added back (capped by remaining
// cargo space), and durability reduced. A ship whose durability reaches 0
// is removed from the fleet entirely — same "wrecked/sunk" fate and same
// pattern as applyStormDamage, just triggered by combat instead of
// weather. Does not decide the outcome itself (that's resolveCombat's
// job) — this only ever applies a result that's already been rolled,
// keeping the RNG centralised in combat-system.ts.
export function applyCombatOutcome(
  fleet: FleetState,
  targetShipId: string,
  result: CombatResult,
): { fleet: FleetState; sunk: boolean; shipName: string | null } {
  const target = fleet.ships.find(s => s.id === targetShipId);
  if (!target) return { fleet, sunk: false, shipName: null };

  const newDurability = target.durability - result.durabilityLoss;
  if (newDurability <= 0) {
    return { fleet: { ...fleet, ships: fleet.ships.filter(s => s.id !== target.id) }, sunk: true, shipName: target.name };
  }

  let newCargo: Partial<Record<GoodId, number>> = { ...target.cargo };
  if (result.cargoLossFraction > 0) {
    const afterLoss: Partial<Record<GoodId, number>> = {};
    for (const [goodId, qty] of Object.entries(newCargo) as Array<[GoodId, number]>) {
      if (!qty) continue;
      const remaining = qty - Math.floor(qty * result.cargoLossFraction);
      if (remaining > 0) afterLoss[goodId] = remaining;
    }
    newCargo = afterLoss;
  }

  const lootEntries = Object.entries(result.loot) as Array<[GoodId, number]>;
  if (lootEntries.length > 0) {
    const currentTotal = Object.values(newCargo).reduce<number>((sum, qty) => sum + qty, 0);
    let remainingSpace = cargoCapacity(target) - currentTotal;
    for (const [goodId, qty] of lootEntries) {
      if (remainingSpace <= 0) break;
      const grant = Math.min(qty, remainingSpace);
      newCargo[goodId] = (newCargo[goodId] ?? 0) + grant;
      remainingSpace -= grant;
    }
  }

  const newShip = { ...target, durability: newDurability, cargo: newCargo };
  return {
    fleet: { ...fleet, ships: fleet.ships.map(s => (s.id === target.id ? newShip : s)) },
    sunk: false,
    shipName: target.name,
  };
}

export function cargoTotal(ship: Ship): number {
  return Object.values(ship.cargo).reduce<number>((sum, qty) => sum + qty, 0);
}

// Each cannon eats into usable hold space (docs/design/ship-stats.md
// "Buying & Selling Cannons") — the single function everything else reads
// for capacity checks, so buying/selling cannons is automatically reflected
// everywhere cargo capacity is displayed or checked.
export function cargoCapacity(ship: Ship): number {
  return SHIP_TYPES[ship.type].cargoCapacity - ship.cannons * CANNON_CARGO_COST;
}

export function cargoSpace(ship: Ship): number {
  return cargoCapacity(ship) - cargoTotal(ship);
}
