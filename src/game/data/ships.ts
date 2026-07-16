import type { ShipType } from '../state/types.ts';

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

export function shipNetWorth(purchasePrice: number, durability: number): number {
  return Math.round(purchasePrice * (durability / 100));
}
