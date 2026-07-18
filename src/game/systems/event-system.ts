import type { GameState, Season, Ship, RiskState } from '../state/types.ts';
import type { FleetState, MarketState } from '../state/types.ts';
import { isInTransit } from './fleet-system.ts';
import { applyStormDamage, applyPirateRaid } from './fleet-system.ts';
import { ROUTES, findRoute } from '../data/routes.ts';
import { routeRiskModifier, cityRiskModifier } from './risk-system.ts';
import { durabilityStormChancePenalty } from '../data/ships.ts';

export type EventId = 'storm' | 'bumper_harvest' | 'pirate_raid';

const STORM_WEIGHTS: Record<Season, number> = { spring: 2, summer: 1, autumn: 3, winter: 5 };
const PIRATE_WEIGHTS: Record<Season, number> = { spring: 2, summer: 3, autumn: 2, winter: 1 };
const HARVEST_WEIGHTS: Record<Season, number> = { spring: 0, summer: 2, autumn: 3, winter: 0 };

const BASE_STORM_DAMAGE = 10;
const STORM_ROUTE_DAMAGE_SCALE = 25; // route.stormRisk * modifier * this = extra durability points
const STORM_DAMAGE_MIN = 6;
const STORM_DAMAGE_MAX = 22;

const BASE_HARVEST_BONUS = 30;

// The pool weights below (STORM_WEIGHTS etc.) are tuned on a 1-5 integer
// scale. route.stormRisk/pirateRisk are raw probabilities (0.01-0.25) — on
// a completely different scale. Multiplying them together directly would
// crush storm/pirate weights to near-zero relative to harvest's fixed
// integer weight, badly skewing the event mix. Dividing each route's risk
// by the network-wide average for that event kind turns it into a
// *relative danger factor* centered on 1.0 (an average route/season keeps
// the original tuned weight; a route twice as risky as average doubles
// it), which preserves the original event-type balance while still making
// per-route risk meaningfully change which event fires.
function averageRisk(kind: 'storm' | 'pirate'): number {
  const values = ROUTES.flatMap(r => Object.values(kind === 'storm' ? r.stormRisk : r.pirateRisk));
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

const STORM_RISK_BASELINE = averageRisk('storm');
const PIRATE_RISK_BASELINE = averageRisk('pirate');
const RISK_FACTOR_MIN = 0.3;
const RISK_FACTOR_MAX = 3.0;
const DURABILITY_FACTOR_SCALE = 2; // durability storm-chance penalty (0.05/0.10) -> +0.1/+0.2 risk factor

// Average, across a ship's route+season+session-modifier (and, for storms,
// its own durability), how dangerous transit currently is *relative to a
// typical route* (1.0 = average). Used to weight which event fires this
// turn — see docs/design/event-table.md "Per-Route & Session Risk".
export function averageShipRisk(ships: Ship[], risk: RiskState, season: Season, kind: 'storm' | 'pirate'): number {
  const transiting = ships.filter(isInTransit);
  if (transiting.length === 0) return 0;

  const baseline = kind === 'storm' ? STORM_RISK_BASELINE : PIRATE_RISK_BASELINE;

  const values = transiting.map(ship => {
    const route = findRoute(ship.position.from, ship.position.to);
    if (!route) return 1;
    const base = kind === 'storm' ? route.stormRisk[season] : route.pirateRisk[season];
    const modifier = routeRiskModifier(risk, ship.position.from, ship.position.to);
    const routeFactor = Math.min(RISK_FACTOR_MAX, Math.max(RISK_FACTOR_MIN, (base * modifier) / baseline));
    const durabilityBump = kind === 'storm' ? durabilityStormChancePenalty(ship.durability) * DURABILITY_FACTOR_SCALE : 0;
    return routeFactor + durabilityBump;
  });

  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function selectEvent(state: GameState): EventId | null {
  if (Math.random() > 0.25) return null;

  const season = state.calendar.season;
  const shipsInTransit = state.fleet.ships.filter(isInTransit);

  const pool: Array<{ id: EventId; weight: number }> = [];

  if (shipsInTransit.length > 0) {
    pool.push({
      id: 'storm',
      weight: STORM_WEIGHTS[season] * averageShipRisk(state.fleet.ships, state.risk, season, 'storm'),
    });
    pool.push({
      id: 'pirate_raid',
      weight: PIRATE_WEIGHTS[season] * averageShipRisk(state.fleet.ships, state.risk, season, 'pirate'),
    });
  }

  if (season === 'summer' || season === 'autumn') {
    pool.push({
      id: 'bumper_harvest',
      weight: HARVEST_WEIGHTS[season] * cityRiskModifier(state.risk, 'danzig'),
    });
  }

  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) return null;

  let pick = Math.random() * total;
  for (const entry of pool) {
    pick -= entry.weight;
    if (pick <= 0) return entry.id;
  }

  return pool[pool.length - 1]?.id ?? null;
}

export interface EventResult {
  fleet: FleetState;
  market: MarketState;
  messages: string[];
  wreckedShips: Ship[];
}

export function stormDamageForShip(ship: Ship, risk: RiskState, season: Season): number {
  if (!isInTransit(ship)) return 0;
  const route = findRoute(ship.position.from, ship.position.to);
  if (!route) return BASE_STORM_DAMAGE;

  const modifier = routeRiskModifier(risk, ship.position.from, ship.position.to);
  const routeBonus = Math.round(route.stormRisk[season] * modifier * STORM_ROUTE_DAMAGE_SCALE);
  const durabilityBonus = Math.round(durabilityStormChancePenalty(ship.durability) * 100);
  const damage = BASE_STORM_DAMAGE + routeBonus + durabilityBonus;

  return Math.min(STORM_DAMAGE_MAX, Math.max(STORM_DAMAGE_MIN, damage));
}

export function pickPirateTarget(ships: Ship[], risk: RiskState, season: Season): Ship | null {
  const transiting = ships.filter(isInTransit);
  if (transiting.length === 0) return null;

  const weights = transiting.map(ship => {
    const route = findRoute(ship.position.from, ship.position.to);
    if (!route) return 0.01;
    const modifier = routeRiskModifier(risk, ship.position.from, ship.position.to);
    return Math.max(0.01, route.pirateRisk[season] * modifier);
  });

  const total = weights.reduce((sum, w) => sum + w, 0);
  let pick = Math.random() * total;
  for (let i = 0; i < transiting.length; i++) {
    pick -= weights[i] ?? 0;
    if (pick <= 0) return transiting[i] ?? null;
  }
  return transiting[transiting.length - 1] ?? null;
}

export function applyEvent(eventId: EventId, state: GameState): EventResult {
  const messages: string[] = [];
  let fleet = state.fleet;
  let market = state.market;
  let wreckedShips: Ship[] = [];
  const season = state.calendar.season;

  if (eventId === 'storm') {
    const result = applyStormDamage(fleet, ship => stormDamageForShip(ship, state.risk, season));
    fleet = result.fleet;
    wreckedShips = result.wrecked;
    if (wreckedShips.length > 0) {
      const names = wreckedShips.map(s => s.name).join(', ');
      messages.push(`⛈️ A violent storm swept the Baltic. ${names} sank with all cargo.`);
    } else {
      messages.push('⛈️ A violent storm swept the Baltic. Your ships at sea took damage.');
    }
  } else if (eventId === 'bumper_harvest') {
    const danzig = market['danzig'];
    const grain = danzig['grain'];
    const bonus = Math.round(BASE_HARVEST_BONUS * cityRiskModifier(state.risk, 'danzig'));
    const newSupply = Math.min(100, grain.supply + bonus);
    market = { ...market, danzig: { ...danzig, grain: { ...grain, supply: newSupply } } };
    messages.push('🌾 A bumper harvest in the east — grain prices in Danzig collapsed.');
  } else {
    const target = pickPirateTarget(fleet.ships, state.risk, season);
    if (target) {
      const result = applyPirateRaid(fleet, target.id);
      fleet = result.fleet;
      if (result.raidedShipName !== null) {
        messages.push(`🏴‍☠️ Pirates intercepted the ${result.raidedShipName}! Part of the cargo was seized.`);
      }
    }
  }

  return { fleet, market, messages, wreckedShips };
}
