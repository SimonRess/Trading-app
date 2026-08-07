import type { CityId } from '../state/types.ts';

export interface CityDefinition {
  id: CityId;
  name: string;
  position: { x: number; y: number };
  // Flavor only — a rough, static approximation of each city's population
  // c. 1320, not simulated or affected by anything in-game. Shown in the
  // Town Hall building.
  population: number;
  // Total physical warehouses in this city (owned by the player + rentable
  // from others), fixed at game start and scaled from population — see
  // ADR-024, docs/design/city-stores.md. Rentable overflow for the player
  // is warehouseCapacity − warehouses[cityId] (warehouse-system.ts), NOT
  // unlimited. Placeholder values, needs tuning like every other economic
  // constant here.
  warehouseCapacity: number;
}

export const CITIES: Record<CityId, CityDefinition> = {
  lubeck:  { id: 'lubeck',  name: 'Lübeck',  position: { x: 320, y: 310 }, population: 18_000, warehouseCapacity: 14 },
  hamburg: { id: 'hamburg', name: 'Hamburg',  position: { x: 180, y: 340 }, population: 6_000, warehouseCapacity: 7 },
  danzig:  { id: 'danzig',  name: 'Danzig',   position: { x: 580, y: 280 }, population: 10_000, warehouseCapacity: 10 },
  riga:    { id: 'riga',    name: 'Riga',      position: { x: 720, y: 180 }, population: 8_000, warehouseCapacity: 9 },
  malmo:   { id: 'malmo',   name: 'Malmö',    position: { x: 390, y: 200 }, population: 4_000, warehouseCapacity: 6 },
};
