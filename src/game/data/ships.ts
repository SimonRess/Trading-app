import type { CityId, ShipType } from '../state/types.ts';

export interface ShipTypeDefinition {
  type: ShipType;
  name: string;
  cargoCapacity: number;
  turnsPerLeg: number;
  purchasePrice: number;
  repairCostPerPoint: number;
  description: string;
}

// turnsPerLeg values are calibrated so the Kogge's ratio to itself is 1.0 —
// route.turns (routes.ts) already IS the Kogge-standard travel time (see
// city-graph.md / the ADR fixing the earlier "doubled travel time" bug).
// Other ship types scale route.turns by their turnsPerLeg relative to the
// Kogge's, via speedRatio() below — never by multiplying route.turns
// directly by their own turnsPerLeg in isolation.
export const SHIP_TYPES: Record<ShipType, ShipTypeDefinition> = {
  kogge: {
    type: 'kogge',
    name: 'Kogge',
    cargoCapacity: 50,
    turnsPerLeg: 2,
    purchasePrice: 4000,
    repairCostPerPoint: 2,
    description: 'The Hanseatic workhorse. Reliable and affordable.',
  },
  hulk: {
    type: 'hulk',
    name: 'Hulk',
    cargoCapacity: 100,
    turnsPerLeg: 3,
    purchasePrice: 8000,
    repairCostPerPoint: 2,
    description: 'Large hauler. Twice the hold of a Kogge, but slower.',
  },
  schnigge: {
    type: 'schnigge',
    name: 'Schnigge',
    cargoCapacity: 20,
    turnsPerLeg: 1,
    purchasePrice: 2500,
    repairCostPerPoint: 2,
    description: 'Fast courier. Half the travel time of a Kogge, small hold.',
  },
};

// Per docs/design/crew-management.md — roughly proportional to cargo capacity.
export const CREW_MAX: Record<ShipType, number> = {
  kogge: 8,
  hulk: 12,
  schnigge: 5,
};

export const CREW_HIRE_COST = 20;
export const WAGE_PER_SAILOR_PER_TURN = 2;

// New ships start half-crewed rather than empty, so a freshly-bought ship
// isn't immediately under-crewed by default.
export function defaultCrew(type: ShipType): number {
  return Math.round(CREW_MAX[type] / 2);
}

export function isUndercrewed(type: ShipType, crew: number): boolean {
  return crew < CREW_MAX[type] / 2;
}

// Under-crewed ships take +1 turn per leg, same shape as
// durabilityTravelTimePenalty — being short-handed slows a ship down just
// like being damaged does.
export function crewTravelTimePenalty(type: ShipType, crew: number): number {
  return isUndercrewed(type, crew) ? 1 : 0;
}

// Per docs/design/ship-stats.md "Buying & Selling Cannons" — roughly
// proportional to each type's cargo capacity, so a Schnigge can't devote
// most of its small hold to cannons.
export const CANNON_MAX: Record<ShipType, number> = {
  kogge: 6,
  hulk: 8,
  schnigge: 3,
};

export const CANNON_PRICE = 150;
export const CANNON_SELL_FRACTION = 0.6;
export const CANNON_CARGO_COST = 2;

export function cannonSellValue(): number {
  return Math.round(CANNON_PRICE * CANNON_SELL_FRACTION);
}

export function speedRatio(type: ShipType): number {
  return SHIP_TYPES[type].turnsPerLeg / SHIP_TYPES.kogge.turnsPerLeg;
}

export const SHIPYARD_CITIES: CityId[] = ['lubeck', 'danzig', 'hamburg'];

export const MAX_SHIPS = 3;

export function isShipyardCity(cityId: CityId): boolean {
  return SHIPYARD_CITIES.includes(cityId);
}

export function shipNetWorth(purchasePrice: number, durability: number): number {
  return Math.round(purchasePrice * (durability / 100));
}

// Auction proceeds are the type's purchase price scaled by both durability
// (a beat-up ship fetches less) and a flat 80% "highest bidder" discount
// off list price (proposed, unvalidated by simulation like every other
// numeric first pass — see docs/design/ship-stats.md).
export const AUCTION_SALE_FRACTION = 0.8;

export function auctionSaleValue(purchasePrice: number, durability: number): number {
  return Math.round(purchasePrice * AUCTION_SALE_FRACTION * (durability / 100));
}

export function repairCost(ship: { type: ShipType; durability: number }): number {
  const def = SHIP_TYPES[ship.type];
  return (100 - ship.durability) * def.repairCostPerPoint;
}

export type DurabilityStatus = 'seaworthy' | 'worn' | 'damaged' | 'critical' | 'wrecked';

// Thresholds per docs/design/ship-stats.md "Durability thresholds".
export function durabilityStatus(durability: number): DurabilityStatus {
  if (durability <= 0) return 'wrecked';
  if (durability <= 25) return 'critical';
  if (durability <= 50) return 'damaged';
  if (durability <= 75) return 'worn';
  return 'seaworthy';
}

// Additive storm-damage-chance penalty from ship-stats.md: Worn +5%, Damaged +10%.
export function durabilityStormChancePenalty(durability: number): number {
  const status = durabilityStatus(durability);
  if (status === 'damaged') return 0.1;
  if (status === 'worn') return 0.05;
  return 0;
}

// Damaged ships take +1 turn per leg. MVP routes are always a single leg
// between two directly-connected cities, so this is a flat +1 turn.
export function durabilityTravelTimePenalty(durability: number): number {
  return durabilityStatus(durability) === 'damaged' ? 1 : 0;
}

// Critical ships cannot depart until repaired.
export function canDepart(durability: number): boolean {
  return durabilityStatus(durability) !== 'critical' && durabilityStatus(durability) !== 'wrecked';
}

const NEW_SHIP_NAMES = ['Möwe von Lübeck', 'Greif von Danzig', 'Falke von Hamburg', 'Adler der Ostsee'];

export function nextShipName(existingCount: number): string {
  return NEW_SHIP_NAMES[existingCount % NEW_SHIP_NAMES.length] ?? `Ship ${String(existingCount + 1)}`;
}
