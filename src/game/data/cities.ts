import type { CityId } from '../state/types.ts';

export interface CityDefinition {
  id: CityId;
  name: string;
  position: { x: number; y: number };
}

export const CITIES: Record<CityId, CityDefinition> = {
  lubeck:  { id: 'lubeck',  name: 'Lübeck',  position: { x: 320, y: 310 } },
  hamburg: { id: 'hamburg', name: 'Hamburg',  position: { x: 180, y: 340 } },
  danzig:  { id: 'danzig',  name: 'Danzig',   position: { x: 580, y: 280 } },
  riga:    { id: 'riga',    name: 'Riga',      position: { x: 720, y: 180 } },
  malmo:   { id: 'malmo',   name: 'Malmö',    position: { x: 390, y: 200 } },
};
