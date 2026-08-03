import type { GameState, Season, Ship, RiskState, CityId, GoodId, CityEffect } from '../state/types.ts';
import type { FleetState, MarketState } from '../state/types.ts';
import { isInTransit, isInPort, cargoSpace } from './fleet-system.ts';
import { applyStormDamage, applyCombatOutcome } from './fleet-system.ts';
import { resolveCombat, resolveConvoyCombat } from './combat-system.ts';
import { findConvoyForShip, convoyMembers } from './convoy-system.ts';
import { ROUTES, findRoute } from '../data/routes.ts';
import { routeRiskModifier, cityRiskModifier } from './risk-system.ts';
import { durabilityStormChancePenalty } from '../data/ships.ts';
import { CITIES } from '../data/cities.ts';
import { GOODS } from '../data/goods.ts';

export type EventId =
  | 'storm'
  | 'bumper_harvest'
  | 'pirate_raid'
  | 'market_boom'
  | 'guild_festival'
  | 'shipwreck_salvage'
  | 'city_plague'
  | 'diplomatic_embargo'
  | 'reputation_scandal';

const STORM_WEIGHTS: Record<Season, number> = { spring: 2, summer: 1, autumn: 3, winter: 5 };
const PIRATE_WEIGHTS: Record<Season, number> = { spring: 2, summer: 3, autumn: 2, winter: 1 };
const HARVEST_WEIGHTS: Record<Season, number> = { spring: 0, summer: 2, autumn: 3, winter: 0 };

const BASE_STORM_DAMAGE = 10;
const STORM_ROUTE_DAMAGE_SCALE = 25; // route.stormRisk * modifier * this = extra durability points
const STORM_DAMAGE_MIN = 6;
const STORM_DAMAGE_MAX = 22;

const BASE_HARVEST_BONUS = 30;

// Duration (in turns) for every CityEffect this module creates.
const EFFECT_DURATION = 3;

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
  const shipsInPort = state.fleet.ships.filter(isInPort);

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
    pool.push({ id: 'shipwreck_salvage', weight: 1 });
  }

  if (season === 'summer' || season === 'autumn') {
    pool.push({
      id: 'bumper_harvest',
      weight: HARVEST_WEIGHTS[season] * cityRiskModifier(state.risk, 'danzig'),
    });
  }

  pool.push({ id: 'market_boom', weight: 2 });

  if (season === 'summer' && shipsInPort.length > 0) {
    pool.push({ id: 'guild_festival', weight: 2 });
  }

  if (shipsInPort.length > 0) {
    pool.push({ id: 'reputation_scandal', weight: 1 });
  }

  if (season === 'winter' || season === 'spring') {
    pool.push({ id: 'city_plague', weight: season === 'winter' ? 2 : 1 });
  }

  pool.push({ id: 'diplomatic_embargo', weight: 1 });

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
  newCityEffects: CityEffect[];
  reputationChange: { cityId: CityId; amount: number; kind: 'gain' | 'loss' } | null;
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

// Inverse of pickPirateTarget — a calmer, more-traveled route is more
// likely to be where drifting wreckage is spotted, not a dangerous one.
function pickSalvageTarget(ships: Ship[], risk: RiskState, season: Season): Ship | null {
  const transiting = ships.filter(isInTransit);
  if (transiting.length === 0) return null;

  const weights = transiting.map(ship => {
    const route = findRoute(ship.position.from, ship.position.to);
    if (!route) return 0.01;
    const modifier = routeRiskModifier(risk, ship.position.from, ship.position.to);
    return Math.max(0.01, 1 - Math.min(1, route.pirateRisk[season] * modifier));
  });

  const total = weights.reduce((sum, w) => sum + w, 0);
  let pick = Math.random() * total;
  for (let i = 0; i < transiting.length; i++) {
    pick -= weights[i] ?? 0;
    if (pick <= 0) return transiting[i] ?? null;
  }
  return transiting[transiting.length - 1] ?? null;
}

const CITY_IDS = Object.keys(CITIES) as CityId[];
const GOOD_IDS = Object.keys(GOODS) as GoodId[];

function randomFrom<T>(items: T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

export function applyEvent(eventId: EventId, state: GameState): EventResult {
  const messages: string[] = [];
  let fleet = state.fleet;
  let market = state.market;
  let wreckedShips: Ship[] = [];
  let newCityEffects: CityEffect[] = [];
  let reputationChange: EventResult['reputationChange'] = null;
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
  } else if (eventId === 'pirate_raid') {
    const target = pickPirateTarget(fleet.ships, state.risk, season);
    if (target) {
      const convoy = findConvoyForShip(fleet, target.id);
      if (convoy) {
        const members = convoyMembers(fleet, convoy);
        const combat = resolveConvoyCombat(members, convoy.posture, state.risk, season);
        const strength = combat.playerPower !== null && combat.enemyPower !== null
          ? ` Your strength: ${String(Math.round(combat.playerPower))} vs. their strength: ${String(Math.round(combat.enemyPower))}.`
          : '';

        // Victory loot is a one-time haul for the whole convoy, not a
        // per-ship reward — applying `combat` (with its `loot`) to every
        // member independently would let each one claim the full loot
        // amount. Only the first surviving member gets the loot; every
        // member (including that one) still takes its own durability/cargo
        // loss from the shared `combat` result.
        const sunkIds: string[] = [];
        let lootApplied = false;
        for (const member of members) {
          const resultForMember = lootApplied ? { ...combat, loot: {} } : combat;
          const applied = applyCombatOutcome(fleet, member.id, resultForMember);
          fleet = applied.fleet;
          if (applied.sunk) sunkIds.push(member.id);
          else lootApplied = true;
        }
        // A convoy with fewer than 2 remaining members auto-dissolves.
        const remainingIds = convoy.shipIds.filter(id => !sunkIds.includes(id));
        fleet = {
          ...fleet,
          convoys: remainingIds.length < 2
            ? fleet.convoys.filter(c => c.id !== convoy.id)
            : fleet.convoys.map(c => (c.id === convoy.id ? { ...c, shipIds: remainingIds } : c)),
        };

        const sunkNames = members.filter(m => sunkIds.includes(m.id)).map(m => m.name);
        if (sunkIds.length > 0) wreckedShips = members.filter(m => sunkIds.includes(m.id));

        if (combat.outcome === 'victory') {
          const lootDesc = Object.entries(combat.loot)
            .map(([goodId, qty]) => `${String(qty)} ${GOODS[goodId as GoodId].name}`)
            .join(', ');
          messages.push(`⚔️ Pirates intercepted ${convoy.name}!${strength} Victory! Captured ${lootDesc || 'nothing — the holds were full'}.`);
        } else if (combat.outcome === 'defeat') {
          const sunkNote = sunkNames.length > 0 ? ` The ${sunkNames.join(', ')} went down.` : '';
          messages.push(`🏴‍☠️ Pirates intercepted ${convoy.name}!${strength} Defeated — the convoy took damage and lost cargo fighting them off.${sunkNote}`);
        } else if (combat.outcome === 'flee') {
          messages.push(`🏳️ Pirates gave chase to ${convoy.name} — the crews fled, jettisoning cargo to outrun them.`);
        } else {
          messages.push(`🏴‍☠️ Pirates intercepted ${convoy.name}!${strength} The convoy fought them off and retreated, losing some cargo.`);
        }
      } else {
        const combat = resolveCombat(target, state.risk, season);
        const applied = applyCombatOutcome(fleet, target.id, combat);
        fleet = applied.fleet;

        if (applied.shipName) {
          const strength = combat.playerPower !== null && combat.enemyPower !== null
            ? ` Your strength: ${String(Math.round(combat.playerPower))} vs. their strength: ${String(Math.round(combat.enemyPower))}.`
            : '';

          if (applied.sunk) {
            wreckedShips = [target];
            messages.push(`🏴‍☠️ Pirates intercepted the ${applied.shipName}!${strength} Overwhelmed — the ${applied.shipName} was sunk with all hands and cargo.`);
          } else if (combat.outcome === 'victory') {
            const lootDesc = Object.entries(combat.loot)
              .map(([goodId, qty]) => `${String(qty)} ${GOODS[goodId as GoodId].name}`)
              .join(', ');
            messages.push(`⚔️ Pirates intercepted the ${applied.shipName}!${strength} Victory! Captured ${lootDesc || 'nothing — the hold was full'}.`);
          } else if (combat.outcome === 'defeat') {
            messages.push(`🏴‍☠️ Pirates intercepted the ${applied.shipName}!${strength} Defeated — the ${applied.shipName} took damage and lost cargo fighting them off.`);
          } else if (combat.outcome === 'flee') {
            messages.push(`🏳️ Pirates gave chase to the ${applied.shipName} — the crew fled, jettisoning cargo to outrun them.`);
          } else {
            messages.push(`🏴‍☠️ Pirates intercepted the ${applied.shipName}!${strength} The crew fought them off and retreated, losing some cargo.`);
          }
        }
      }
    }
  } else if (eventId === 'market_boom') {
    const cityId = randomFrom(CITY_IDS);
    const goodId = randomFrom(GOOD_IDS);
    if (cityId && goodId) {
      const riskMod = cityRiskModifier(state.risk, cityId);
      newCityEffects = [{
        cityId,
        goodId,
        type: 'market_boost',
        turnsRemaining: EFFECT_DURATION,
        supplyBonus: Math.round(20 * riskMod),
        demandBonus: Math.round(10 * riskMod),
      }];
      messages.push(`📈 A trade boom in ${CITIES[cityId].name} — ${GOODS[goodId].name} is flowing more freely.`);
    }
  } else if (eventId === 'guild_festival') {
    const dockedShip = fleet.ships.find(isInPort);
    if (dockedShip) {
      const cityId = dockedShip.position as CityId;
      reputationChange = { cityId, amount: 5, kind: 'gain' };
      messages.push(`🎉 A Guild Festival in ${CITIES[cityId].name} raised your standing among the merchants there.`);
    }
  } else if (eventId === 'shipwreck_salvage') {
    const target = pickSalvageTarget(fleet.ships, state.risk, season);
    if (target) {
      const goodId = randomFrom(GOOD_IDS);
      const space = cargoSpace(target);
      if (goodId && space > 0) {
        const qty = Math.min(space, 1 + Math.floor(Math.random() * 10));
        const newCargo = { ...target.cargo, [goodId]: (target.cargo[goodId] ?? 0) + qty };
        fleet = { ...fleet, ships: fleet.ships.map(s => (s.id === target.id ? { ...s, cargo: newCargo } : s)) };
        messages.push(`⚓ The ${target.name} came across drifting wreckage and recovered ${String(qty)} ${GOODS[goodId].name}.`);
      }
    }
  } else if (eventId === 'city_plague') {
    const cityId = randomFrom(CITY_IDS);
    if (cityId) {
      const riskMod = cityRiskModifier(state.risk, cityId);
      newCityEffects = [{
        cityId,
        type: 'plague',
        turnsRemaining: EFFECT_DURATION,
        supplyBonus: -Math.round(15 * riskMod),
      }];
      messages.push(`☠️ Plague has struck ${CITIES[cityId].name}. Trade there is disrupted.`);
    }
  } else if (eventId === 'diplomatic_embargo') {
    const cityId = randomFrom(CITY_IDS);
    const goodId = randomFrom(GOOD_IDS);
    if (cityId && goodId) {
      newCityEffects = [{ cityId, goodId, type: 'embargo', turnsRemaining: EFFECT_DURATION }];
      messages.push(`⚖️ A trade embargo on ${GOODS[goodId].name} has been declared in ${CITIES[cityId].name}.`);
    }
  } else {
    const dockedShip = fleet.ships.find(isInPort);
    if (dockedShip) {
      const cityId = dockedShip.position as CityId;
      reputationChange = { cityId, amount: 5, kind: 'loss' };
      messages.push(`🍷 Rumors of impropriety at a merchants' gathering in ${CITIES[cityId].name} have damaged your reputation there.`);
    }
  }

  return { fleet, market, messages, wreckedShips, newCityEffects, reputationChange };
}
