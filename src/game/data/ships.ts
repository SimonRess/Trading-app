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

const NEW_SHIP_NAMES = ['Möwe von Lübeck', 'Greif von Danzig', 'Falke von Hamburg', 'Adler der Ostsee'];

export function nextShipName(existingCount: number): string {
  return NEW_SHIP_NAMES[existingCount % NEW_SHIP_NAMES.length] ?? `Kogge ${String(existingCount + 1)}`;
}
