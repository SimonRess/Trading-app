import type { GameState, Season, Ship } from '../state/types.ts';
import type { FleetState, MarketState } from '../state/types.ts';
import { isInTransit } from './fleet-system.ts';
import { applyStormDamage, applyPirateRaid } from './fleet-system.ts';

export type EventId = 'storm' | 'bumper_harvest' | 'pirate_raid';

const STORM_WEIGHTS: Record<Season, number> = { spring: 2, summer: 1, autumn: 3, winter: 5 };
const PIRATE_WEIGHTS: Record<Season, number> = { spring: 2, summer: 3, autumn: 2, winter: 1 };
const HARVEST_WEIGHTS: Record<Season, number> = { spring: 0, summer: 2, autumn: 3, winter: 0 };

export function selectEvent(state: GameState): EventId | null {
  if (Math.random() > 0.25) return null;

  const season = state.calendar.season;
  const shipsInTransit = state.fleet.ships.filter(isInTransit);

  const pool: Array<{ id: EventId; weight: number }> = [];

  if (shipsInTransit.length > 0) {
    pool.push({ id: 'storm', weight: STORM_WEIGHTS[season] });
    pool.push({ id: 'pirate_raid', weight: PIRATE_WEIGHTS[season] });
  }

  if (season === 'summer' || season === 'autumn') {
    pool.push({ id: 'bumper_harvest', weight: HARVEST_WEIGHTS[season] });
  }

  if (pool.length === 0) return null;

  const total = pool.reduce((sum, e) => sum + e.weight, 0);
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

export function applyEvent(eventId: EventId, state: GameState): EventResult {
  const messages: string[] = [];
  let fleet = state.fleet;
  let market = state.market;
  let wreckedShips: Ship[] = [];

  if (eventId === 'storm') {
    const result = applyStormDamage(fleet, 10);
    fleet = result.fleet;
    wreckedShips = result.wrecked;
    if (wreckedShips.length > 0) {
      const names = wreckedShips.map(s => s.name).join(', ');
      messages.push(`A violent storm swept the Baltic. ${names} sank with all cargo.`);
    } else {
      messages.push('A violent storm swept the Baltic. Your ships at sea took 10 durability damage.');
    }
  } else if (eventId === 'bumper_harvest') {
    const danzig = market['danzig'];
    const grain = danzig['grain'];
    const newSupply = Math.min(100, grain.supply + 30);
    market = { ...market, danzig: { ...danzig, grain: { ...grain, supply: newSupply } } };
    messages.push('A bumper harvest in the east — grain prices in Danzig collapsed.');
  } else {
    const result = applyPirateRaid(fleet);
    fleet = result.fleet;
    const name = result.raidedShipName;
    if (name !== null) {
      messages.push(`Pirates intercepted the ${name}! Part of the cargo was seized.`);
    }
  }

  return { fleet, market, messages, wreckedShips };
}
