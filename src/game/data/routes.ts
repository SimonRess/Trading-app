import type { CityId, Season } from '../state/types.ts';

export interface Route {
  from: CityId;
  to: CityId;
  turns: number;
  stormRisk: Record<Season, number>;
  pirateRisk: Record<Season, number>;
}

export const ROUTES: Route[] = [
  {
    from: 'hamburg', to: 'lubeck', turns: 2,
    stormRisk: { spring: 0.03, summer: 0.02, autumn: 0.05, winter: 0.12 },
    pirateRisk: { spring: 0.02, summer: 0.04, autumn: 0.03, winter: 0.01 },
  },
  {
    from: 'lubeck', to: 'malmo', turns: 2,
    stormRisk: { spring: 0.05, summer: 0.03, autumn: 0.08, winter: 0.18 },
    pirateRisk: { spring: 0.04, summer: 0.06, autumn: 0.05, winter: 0.02 },
  },
  {
    from: 'lubeck', to: 'danzig', turns: 2,
    stormRisk: { spring: 0.05, summer: 0.03, autumn: 0.08, winter: 0.18 },
    pirateRisk: { spring: 0.04, summer: 0.06, autumn: 0.05, winter: 0.02 },
  },
  {
    from: 'malmo', to: 'riga', turns: 3,
    stormRisk: { spring: 0.08, summer: 0.05, autumn: 0.12, winter: 0.25 },
    pirateRisk: { spring: 0.07, summer: 0.10, autumn: 0.08, winter: 0.03 },
  },
  {
    from: 'danzig', to: 'riga', turns: 3,
    stormRisk: { spring: 0.08, summer: 0.05, autumn: 0.12, winter: 0.25 },
    pirateRisk: { spring: 0.07, summer: 0.10, autumn: 0.08, winter: 0.03 },
  },
];

export function findRoute(from: CityId, to: CityId): Route | undefined {
  return ROUTES.find(
    r => (r.from === from && r.to === to) || (r.from === to && r.to === from),
  );
}

// Order-independent key for a city pair, shared by risk-system.ts and map-scene.ts.
export function routeKey(a: CityId, b: CityId): string {
  return [a, b].sort().join('-');
}
