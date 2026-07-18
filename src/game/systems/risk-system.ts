import type { CityId, RiskState } from '../state/types.ts';
import { ROUTES, routeKey } from '../data/routes.ts';

const MIN_MODIFIER = 0.5;
const MAX_MODIFIER = 1.8;
const MAX_DRIFT_PER_TURN = 0.08;

// Cities with a location-based event whose intensity can drift (currently
// only Danzig, for bumper harvest). Extend this list if a future city-based
// event is added.
const HARVEST_CITIES: CityId[] = ['danzig'];

export function buildInitialRiskState(): RiskState {
  const routeModifiers: Record<string, number> = {};
  for (const route of ROUTES) {
    routeModifiers[routeKey(route.from, route.to)] = 1.0;
  }

  const cityModifiers: Partial<Record<CityId, number>> = {};
  for (const cityId of HARVEST_CITIES) {
    cityModifiers[cityId] = 1.0;
  }

  return { routeModifiers, cityModifiers };
}

function drift(value: number): number {
  const delta = (Math.random() * 2 - 1) * MAX_DRIFT_PER_TURN;
  return Math.min(MAX_MODIFIER, Math.max(MIN_MODIFIER, value + delta));
}

// Bounded random walk, applied once per turn in resolveTurn. Represents
// regional danger levels waxing and waning over a session (e.g. "pirate
// activity near Riga is currently elevated") without needing any player
// configuration or persisted history beyond the current multiplier.
export function driftRiskState(risk: RiskState): RiskState {
  const routeModifiers: Record<string, number> = {};
  for (const [key, value] of Object.entries(risk.routeModifiers)) {
    routeModifiers[key] = drift(value);
  }

  const cityModifiers: Partial<Record<CityId, number>> = {};
  for (const [key, value] of Object.entries(risk.cityModifiers) as Array<[CityId, number]>) {
    cityModifiers[key] = drift(value);
  }

  return { routeModifiers, cityModifiers };
}

export function routeRiskModifier(risk: RiskState, from: CityId, to: CityId): number {
  return risk.routeModifiers[routeKey(from, to)] ?? 1.0;
}

export function cityRiskModifier(risk: RiskState, cityId: CityId): number {
  return risk.cityModifiers[cityId] ?? 1.0;
}
