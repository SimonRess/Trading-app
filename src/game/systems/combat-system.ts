import type { Ship, RiskState, Season, GoodId } from '../state/types.ts';
import { findRoute, ROUTES } from '../data/routes.ts';
import { routeRiskModifier } from './risk-system.ts';
import { GOODS } from '../data/goods.ts';

export type CombatOutcome = 'victory' | 'retreat' | 'defeat' | 'flee';

export interface CombatResult {
  outcome: CombatOutcome;
  // null for a flee — fleeing always escapes without ever rolling a power
  // comparison, so there's nothing to report (see docs/design/combat.md).
  playerPower: number | null;
  enemyPower: number | null;
  durabilityLoss: number;
  cargoLossFraction: number;
  loot: Partial<Record<GoodId, number>>; // victory only
}

// Per ADR-010: player_power = cannons*10 + crew_bonus + posture_modifier.
const CANNON_POWER = 10;
const CREW_POWER_PER_SAILOR = 2;
const POSTURE_MODIFIER: Record<'aggressive' | 'defensive', number> = { aggressive: 15, defensive: 0 };

const ENEMY_POWER_MIN = 20;
const ENEMY_POWER_MAX = 60;
const OUTCOME_RANDOM_SPREAD = 10;
const OUTCOME_THRESHOLD = 15;

const RETREAT_CARGO_LOSS_MIN = 0.1;
const RETREAT_CARGO_LOSS_MAX = 0.2;
const DEFEAT_DURABILITY_LOSS_MIN = 20;
const DEFEAT_DURABILITY_LOSS_MAX = 40;
const DEFEAT_CARGO_LOSS_MIN = 0.3;
const DEFEAT_CARGO_LOSS_MAX = 0.5;

// Flee always escapes (no power roll at all) but isn't free — the cargo
// lost sits between a successful retreat's and an outright defeat's loss,
// since jettisoning goods to outrun pursuit is worse than a clean retreat
// but better than losing the fight outright. Explicit player direction,
// 2026-07-25 — deliberately placed between RETREAT and DEFEAT's ranges
// above rather than deriving from them, so tuning one doesn't silently
// shift the other two.
const FLEE_CARGO_LOSS_MIN = 0.2;
const FLEE_CARGO_LOSS_MAX = 0.35;

const VICTORY_LOOT_GOOD_COUNT_MIN = 1;
const VICTORY_LOOT_GOOD_COUNT_MAX = 2;
const VICTORY_LOOT_QTY_MIN = 5;
const VICTORY_LOOT_QTY_MAX = 15;

const DANGER_FACTOR_MIN = 0.3;
const DANGER_FACTOR_MAX = 3.0;

// Duplicated from event-system.ts's identical "route risk / network-average
// risk, clamped" normalisation rather than imported — avoids a circular
// import (event-system.ts calls into this module to resolve pirate_raid),
// same trade-off map-scene.ts already makes for its own copy of this calc.
function pirateRiskBaseline(): number {
  const values = ROUTES.flatMap(r => Object.values(r.pirateRisk));
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
const PIRATE_RISK_BASELINE = pirateRiskBaseline();

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function rollEnemyPower(ship: Ship, risk: RiskState, season: Season): number {
  const base = randomBetween(ENEMY_POWER_MIN, ENEMY_POWER_MAX);
  if (typeof ship.position === 'string') return base;

  const route = findRoute(ship.position.from, ship.position.to);
  if (!route) return base;

  const modifier = routeRiskModifier(risk, ship.position.from, ship.position.to);
  const dangerFactor = Math.min(
    DANGER_FACTOR_MAX,
    Math.max(DANGER_FACTOR_MIN, (route.pirateRisk[season] * modifier) / PIRATE_RISK_BASELINE),
  );
  return base * dangerFactor;
}

function rollLoot(): Partial<Record<GoodId, number>> {
  const goodIds = Object.keys(GOODS) as GoodId[];
  const count = Math.min(goodIds.length, Math.floor(randomBetween(VICTORY_LOOT_GOOD_COUNT_MIN, VICTORY_LOOT_GOOD_COUNT_MAX + 1)));
  const shuffled = [...goodIds].sort(() => Math.random() - 0.5);

  const loot: Partial<Record<GoodId, number>> = {};
  for (const goodId of shuffled.slice(0, count)) {
    loot[goodId] = Math.round(randomBetween(VICTORY_LOOT_QTY_MIN, VICTORY_LOOT_QTY_MAX));
  }
  return loot;
}

// cannons*10 + crew*2 + posture bonus — 0 for a fleeing ship, since fleeing
// skips the power comparison entirely.
export function playerCombatPower(ship: Ship): number {
  if (ship.posture === 'flee') return 0;
  return ship.cannons * CANNON_POWER + ship.crew * CREW_POWER_PER_SAILOR + POSTURE_MODIFIER[ship.posture];
}

// Convoy ships fight as one unit (docs/design/ship-convoys.md "Combat"):
// power sums across every member, the posture modifier applies once from
// the convoy's own posture rather than per ship, and a single roll decides
// the outcome for the whole group. The resulting durabilityLoss/
// cargoLossFraction are then meant to be applied independently to each
// member via fleet-system.ts's applyCombatOutcome, same as a solo ship —
// so a defeat can sink a weak member while stronger ones survive damaged.
export function convoyCombatPower(ships: Ship[], posture: Ship['posture']): number {
  if (posture === 'flee') return 0;
  const shipPower = ships.reduce((sum, s) => sum + s.cannons * CANNON_POWER + s.crew * CREW_POWER_PER_SAILOR, 0);
  return shipPower + POSTURE_MODIFIER[posture];
}

// One representative ship (any member — they're co-located) supplies the
// route for the enemy-power roll.
export function resolveConvoyCombat(ships: Ship[], posture: Ship['posture'], risk: RiskState, season: Season): CombatResult {
  if (posture === 'flee' || ships.length === 0) {
    return {
      outcome: 'flee',
      playerPower: null,
      enemyPower: null,
      durabilityLoss: 0,
      cargoLossFraction: randomBetween(FLEE_CARGO_LOSS_MIN, FLEE_CARGO_LOSS_MAX),
      loot: {},
    };
  }

  const representative = ships[0] as Ship;
  const playerPower = convoyCombatPower(ships, posture);
  const enemyPower = rollEnemyPower(representative, risk, season);
  const diff = playerPower - enemyPower + randomBetween(-OUTCOME_RANDOM_SPREAD, OUTCOME_RANDOM_SPREAD);

  if (diff > OUTCOME_THRESHOLD) {
    return { outcome: 'victory', playerPower, enemyPower, durabilityLoss: 0, cargoLossFraction: 0, loot: rollLoot() };
  }
  if (diff < -OUTCOME_THRESHOLD) {
    return {
      outcome: 'defeat',
      playerPower,
      enemyPower,
      durabilityLoss: Math.round(randomBetween(DEFEAT_DURABILITY_LOSS_MIN, DEFEAT_DURABILITY_LOSS_MAX)),
      cargoLossFraction: randomBetween(DEFEAT_CARGO_LOSS_MIN, DEFEAT_CARGO_LOSS_MAX),
      loot: {},
    };
  }
  return {
    outcome: 'retreat',
    playerPower,
    enemyPower,
    durabilityLoss: 0,
    cargoLossFraction: randomBetween(RETREAT_CARGO_LOSS_MIN, RETREAT_CARGO_LOSS_MAX),
    loot: {},
  };
}

// Resolves one pirate encounter for a single targeted ship. Does not
// mutate the ship or fleet — see fleet-system.ts's applyCombatOutcome for
// applying the result (durability/cargo changes, ship removal on a fatal
// blow), same separation as stormDamageForShip/applyStormDamage.
export function resolveCombat(ship: Ship, risk: RiskState, season: Season): CombatResult {
  if (ship.posture === 'flee') {
    return {
      outcome: 'flee',
      playerPower: null,
      enemyPower: null,
      durabilityLoss: 0,
      cargoLossFraction: randomBetween(FLEE_CARGO_LOSS_MIN, FLEE_CARGO_LOSS_MAX),
      loot: {},
    };
  }

  const playerPower = playerCombatPower(ship);
  const enemyPower = rollEnemyPower(ship, risk, season);
  const diff = playerPower - enemyPower + randomBetween(-OUTCOME_RANDOM_SPREAD, OUTCOME_RANDOM_SPREAD);

  if (diff > OUTCOME_THRESHOLD) {
    return { outcome: 'victory', playerPower, enemyPower, durabilityLoss: 0, cargoLossFraction: 0, loot: rollLoot() };
  }
  if (diff < -OUTCOME_THRESHOLD) {
    return {
      outcome: 'defeat',
      playerPower,
      enemyPower,
      durabilityLoss: Math.round(randomBetween(DEFEAT_DURABILITY_LOSS_MIN, DEFEAT_DURABILITY_LOSS_MAX)),
      cargoLossFraction: randomBetween(DEFEAT_CARGO_LOSS_MIN, DEFEAT_CARGO_LOSS_MAX),
      loot: {},
    };
  }
  return {
    outcome: 'retreat',
    playerPower,
    enemyPower,
    durabilityLoss: 0,
    cargoLossFraction: randomBetween(RETREAT_CARGO_LOSS_MIN, RETREAT_CARGO_LOSS_MAX),
    loot: {},
  };
}
