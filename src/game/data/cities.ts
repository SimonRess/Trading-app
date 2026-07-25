import type { CityId } from '../state/types.ts';

export interface CityDefinition {
  id: CityId;
  name: string;
  position: { x: number; y: number };
  // Flavor only — a rough, static approximation of each city's population
  // c. 1320, not simulated or affected by anything in-game. Shown in the
  // Town Hall building.
  population: number;
}

export const CITIES: Record<CityId, CityDefinition> = {
  lubeck:  { id: 'lubeck',  name: 'Lübeck',  position: { x: 320, y: 310 }, population: 18_000 },
  hamburg: { id: 'hamburg', name: 'Hamburg',  position: { x: 180, y: 340 }, population: 6_000 },
  danzig:  { id: 'danzig',  name: 'Danzig',   position: { x: 580, y: 280 }, population: 10_000 },
  riga:    { id: 'riga',    name: 'Riga',      position: { x: 720, y: 180 }, population: 8_000 },
  malmo:   { id: 'malmo',   name: 'Malmö',    position: { x: 390, y: 200 }, population: 4_000 },
};
