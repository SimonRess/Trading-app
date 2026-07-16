import type { GameState, GoodId, CityId } from '../state/types.ts';
import type { TurnResult } from '../state/types.ts';
import type { PlayerOrders } from '../client/game-client.ts';
import { advanceCalendar } from './calendar-system.ts';
import { updateAllMarkets, currentPrice, resolveTrade } from './market-system.ts';
import { advanceShips, setDestination, isInPort, cargoSpace } from './fleet-system.ts';
import { selectEvent, applyEvent } from './event-system.ts';
import { shipNetWorth, SHIP_TYPES } from '../data/ships.ts';
import { GOODS } from '../data/goods.ts';

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
    events.push(`${ship.name} arrived in ${city}.`);
  }

  // Step 4: Update market (natural economy — before player trades)
  const market = updateAllMarkets(state.market);

  // Step 5: Trigger and apply random event
  const stateForEvent: GameState = { ...state, fleet, market, calendar };
  const eventId = selectEvent(stateForEvent);
  let finalMarket = market;

  if (eventId) {
    const eventResult = applyEvent(eventId, stateForEvent);
    fleet = eventResult.fleet;
    finalMarket = eventResult.market;
    events.push(...eventResult.messages);
  }

  const newState: GameState = { ...state, fleet, market: finalMarket, calendar };

  // Step 6: Check win/lose
  const netWorth = computeNetWorth(newState);
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
  const newPlayer = { ...state.player, cash: state.player.cash + totalRevenue };

  return { ...state, player: newPlayer, fleet: newFleet, market: newMarket };
}
