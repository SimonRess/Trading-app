import type { CityId, Season } from '../state/types.ts';

export interface Route {
  from: CityId;
  to: CityId;
  turns: number;
  stormRisk: Record<Season, number>;
}

export const ROUTES: Route[] = [
  {
    from: 'hamburg', to: 'lubeck', turns: 2,
    stormRisk: { spring: 0.03, summer: 0.02, autumn: 0.05, winter: 0.12 },
  },
  {
    from: 'lubeck', to: 'malmo', turns: 2,
    stormRisk: { spring: 0.05, summer: 0.03, autumn: 0.08, winter: 0.18 },
  },
  {
    from: 'lubeck', to: 'danzig', turns: 2,
    stormRisk: { spring: 0.05, summer: 0.03, autumn: 0.08, winter: 0.18 },
  },
  {
    from: 'malmo', to: 'riga', turns: 3,
    stormRisk: { spring: 0.08, summer: 0.05, autumn: 0.12, winter: 0.25 },
  },
  {
    from: 'danzig', to: 'riga', turns: 3,
    stormRisk: { spring: 0.08, summer: 0.05, autumn: 0.12, winter: 0.25 },
  },
];

export function findRoute(from: CityId, to: CityId): Route | undefined {
  return ROUTES.find(
    r => (r.from === from && r.to === to) || (r.from === to && r.to === from),
  );
}
