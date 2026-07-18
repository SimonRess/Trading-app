import type { GameState, GoodId, CityId, ShipType } from '../state/types.ts';
import type { TurnResult } from '../state/types.ts';
import type { PlayerOrders } from '../client/game-client.ts';
import { advanceCalendar } from './calendar-system.ts';
import { updateAllMarkets, currentPrice, resolveTrade } from './market-system.ts';
import { advanceShips, setDestination, isInPort, cargoSpace } from './fleet-system.ts';
import { selectEvent, applyEvent } from './event-system.ts';
import { driftRiskState } from './risk-system.ts';
import { shipNetWorth, SHIP_TYPES, MAX_SHIPS, isShipyardCity, repairCost, nextShipName } from '../data/ships.ts';
import { GOODS } from '../data/goods.ts';
import { evaluateRankUp, gainReputation, rankUpMessage } from './political-system.ts';

export function computeNetWorth(state: GameState): number {
  const shipValue = state.fleet.ships.reduce((sum, ship) => {
    const def = SHIP_TYPES[ship.type];
    return sum + shipNetWorth(def.purchasePrice, ship.durability);
  }, 0);

  const cargoValue = state.fleet.ships.reduce((sum, ship) => {
    for (const [goodId, qty] of Object.entries(ship.cargo) as Array<[GoodId, number]>) {
      sum += GOODS[goodId].basePrice * qty;
    }
    return sum;
  }, 0);

  return Math.round(state.player.cash + shipValue + cargoValue);
}

export function resolveTurn(state: GameState, orders: PlayerOrders): TurnResult {
  const events: string[] = [];

  // Step 1: Apply destination orders
  let fleet = { ...state.fleet };
  for (const [shipId, destination] of Object.entries(orders.destinations)) {
    fleet = {
      ...fleet,
      ships: fleet.ships.map(s => (s.id === shipId ? setDestination(s, destination) : s)),
    };
  }

  // Step 2: Advance calendar
  const calendar = advanceCalendar(state.calendar);

  // Step 3: Move fleet — advance all ships one tick
  const { fleet: movedFleet, arrivals } = advanceShips(fleet);
  fleet = movedFleet;
  for (const { ship, city } of arrivals) {
    events.push(`⚓ ${ship.name} arrived in ${city}.`);
  }

  // Step 4: Update market (natural economy — before player trades)
  const market = updateAllMarkets(state.market);

  // Step 4b: Drift regional risk modifiers (session-persistent, see risk-system.ts)
  const risk = driftRiskState(state.risk);

  // Step 5: Trigger and apply random event
  const stateForEvent: GameState = { ...state, fleet, market, calendar, risk };
  const eventId = selectEvent(stateForEvent);
  let finalMarket = market;

  if (eventId) {
    const eventResult = applyEvent(eventId, stateForEvent);
    fleet = eventResult.fleet;
    finalMarket = eventResult.market;
    events.push(...eventResult.messages);
  }

  let newState: GameState = { ...state, fleet, market: finalMarket, calendar, risk };

  // Step 6: Net worth, then political rank (needs net worth + Lübeck
  // reputation — see docs/design/political-rank.md). Reaching Mayor is a
  // milestone only in this pass, not a win condition of its own.
  const netWorth = computeNetWorth(newState);
  const nextRank = evaluateRankUp(newState.player, netWorth);
  if (nextRank !== newState.player.politicalRank) {
    newState = { ...newState, player: { ...newState.player, politicalRank: nextRank } };
    events.push(rankUpMessage(nextRank));
  }

  // Step 7: Check win/lose
  let outcome: 'win' | 'lose' | null = null;
  if (netWorth >= 10_000) {
    outcome = 'win';
  } else if (netWorth <= 0 || calendar.turn >= calendar.maxTurns) {
    outcome = 'lose';
  }

  return { state: newState, summary: { events, outcome } };
}

export function executeBuy(
  state: GameState,
  shipId: string,
  cityId: CityId,
  goodId: GoodId,
  quantity: number,
): GameState {
  const ship = state.fleet.ships.find(s => s.id === shipId);
  if (!ship || !isInPort(ship) || ship.position !== cityId) return state;
  if (cargoSpace(ship) < quantity) return state;

  const market = state.market[cityId][goodId];
  const price = currentPrice(market);
  const totalCost = price * quantity;
  if (state.player.cash < totalCost) return state;

  const newCargo = { ...ship.cargo, [goodId]: (ship.cargo[goodId] ?? 0) + quantity };
  const newShip = { ...ship, cargo: newCargo };
  const newFleet = { ships: state.fleet.ships.map(s => (s.id === shipId ? newShip : s)) };
  const newMarket = { ...state.market, [cityId]: { ...state.market[cityId], [goodId]: resolveTrade(market, quantity) } };
  const newPlayer = { ...state.player, cash: state.player.cash - totalCost };

  return { ...state, player: newPlayer, fleet: newFleet, market: newMarket };
}

export function executeSell(
  state: GameState,
  shipId: string,
  cityId: CityId,
  goodId: GoodId,
  quantity: number,
): GameState {
  const ship = state.fleet.ships.find(s => s.id === shipId);
  if (!ship || !isInPort(ship) || ship.position !== cityId) return state;
  const currentQty = ship.cargo[goodId] ?? 0;
  if (currentQty < quantity) return state;

  const market = state.market[cityId][goodId];
  const price = currentPrice(market);
  const totalRevenue = price * quantity;

  const newQty = currentQty - quantity;
  const { [goodId]: _drop, ...rest } = ship.cargo;
  void _drop;
  const newCargo: typeof ship.cargo = newQty === 0 ? rest : { ...rest, [goodId]: newQty };

  const newShip = { ...ship, cargo: newCargo };
  const newFleet = { ships: state.fleet.ships.map(s => (s.id === shipId ? newShip : s)) };
  const newMarket = { ...state.market, [cityId]: { ...state.market[cityId], [goodId]: resolveTrade(market, -quantity) } };
  const newPlayer = {
    ...state.player,
    cash: state.player.cash + totalRevenue,
    reputation: gainReputation(state.player.reputation, cityId),
  };

  return { ...state, player: newPlayer, fleet: newFleet, market: newMarket };
}

export function executeBuyShip(state: GameState, cityId: CityId, type: ShipType): GameState {
  if (!isShipyardCity(cityId)) return state;
  if (state.fleet.ships.length >= MAX_SHIPS) return state;

  const price = SHIP_TYPES[type].purchasePrice;
  if (state.player.cash < price) return state;

  const newShip = {
    id: `ship-${String(state.fleet.ships.length + 1)}-${String(Date.now())}`,
    name: nextShipName(state.fleet.ships.length),
    type,
    durability: 100,
    position: cityId,
    cargo: {},
  };

  const newFleet = { ships: [...state.fleet.ships, newShip] };
  const newPlayer = { ...state.player, cash: state.player.cash - price };

  return { ...state, player: newPlayer, fleet: newFleet };
}

export function executeRepairShip(state: GameState, shipId: string): GameState {
  const ship = state.fleet.ships.find(s => s.id === shipId);
  if (!ship || !isInPort(ship) || !isShipyardCity(ship.position)) return state;
  if (ship.durability >= 100) return state;

  const cost = repairCost(ship);
  if (state.player.cash < cost) return state;

  const newShip = { ...ship, durability: 100 };
  const newFleet = { ships: state.fleet.ships.map(s => (s.id === shipId ? newShip : s)) };
  const newPlayer = { ...state.player, cash: state.player.cash - cost };

  return { ...state, player: newPlayer, fleet: newFleet };
}
