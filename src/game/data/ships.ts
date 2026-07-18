import type { CityId, ShipType } from '../state/types.ts';

export interface ShipTypeDefinition {
  type: ShipType;
  cargoCapacity: number;
  turnsPerLeg: number;
  purchasePrice: number;
  repairCostPerPoint: number;
}

export const SHIP_TYPES: Record<ShipType, ShipTypeDefinition> = {
  kogge: {
    type: 'kogge',
    cargoCapacity: 50,
    turnsPerLeg: 2,
    purchasePrice: 400,
    repairCostPerPoint: 2,
  },
};

export const SHIPYARD_CITIES: CityId[] = ['lubeck', 'danzig', 'hamburg'];

export const MAX_SHIPS = 3;

export function isShipyardCity(cityId: CityId): boolean {
  return SHIPYARD_CITIES.includes(cityId);
}

export function shipNetWorth(purchasePrice: number, durability: number): number {
  return Math.round(purchasePrice * (durability / 100));
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
  return NEW_SHIP_NAMES[existingCount % NEW_SHIP_NAMES.length] ?? `Kogge ${String(existingCount + 1)}`;
}
