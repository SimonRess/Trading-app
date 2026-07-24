import type { GameState, GoodId, CityId, ShipType } from '../state/types.ts';
import type { TurnResult } from '../state/types.ts';
import type { PlayerOrders } from '../client/game-client.ts';
import { advanceCalendar } from './calendar-system.ts';
import { updateAllMarkets, currentPrice, resolveTrade } from './market-system.ts';
import { advanceShips, setDestination, isInPort, cargoSpace, cargoTotal, cargoCapacity } from './fleet-system.ts';
import { selectEvent, applyEvent } from './event-system.ts';
import { driftRiskState } from './risk-system.ts';
import {
  shipNetWorth,
  SHIP_TYPES,
  MAX_SHIPS,
  isShipyardCity,
  repairCost,
  nextShipName,
  CREW_MAX,
  CREW_HIRE_COST,
  WAGE_PER_SAILOR_PER_TURN,
  defaultCrew,
  CANNON_MAX,
  CANNON_PRICE,
  cannonSellValue,
} from '../data/ships.ts';
import { GOODS } from '../data/goods.ts';
import { evaluateRankUp, gainReputation, rankUpMessage } from './political-system.ts';
import { advanceChurchProgress } from './church-system.ts';
import { accrueLoanInterest } from './banking-system.ts';
import { accrueInsurancePremiums, computeInsurancePayouts } from './insurance-system.ts';
import { accrueWarehouseIncome, warehouseSellValue } from './warehouse-system.ts';
import { CITIES } from '../data/cities.ts';

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

  // Cannons and warehouses are resellable assets, valued at what they'd
  // actually fetch on resale (ADR-020), same "liquidation value" spirit as
  // shipNetWorth scaling by durability rather than counting full purchase
  // price.
  const cannonValue = state.fleet.ships.reduce((sum, ship) => sum + ship.cannons * cannonSellValue(), 0);
  const warehouseValue = Object.values(state.warehouses).reduce((sum, count) => sum + count * warehouseSellValue(), 0);

  // Outstanding loan principal is a liability (ADR-014 amendment, see
  // ADR-019 and docs/design/banking-loans.md) — otherwise an unpaid loan
  // would look like free cash in the player's own net-worth readout.
  return Math.round(
    state.player.cash + shipValue + cargoValue + cannonValue + warehouseValue - state.player.loan,
  );
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
  const preEventShips = fleet.ships;

  if (eventId) {
    const eventResult = applyEvent(eventId, stateForEvent);
    fleet = eventResult.fleet;
    finalMarket = eventResult.market;
    events.push(...eventResult.messages);
  }

  let newState: GameState = { ...state, fleet, market: finalMarket, calendar, risk };

  // Step 5a2: Insurance payouts (docs/design/insurance.md) — compares ship
  // state just before vs. after the event above, paying insured ships 50%
  // of any storm damage/lost cargo value this turn caused.
  const insurancePayout = computeInsurancePayouts(preEventShips, newState.fleet.ships);
  if (insurancePayout.totalPayout > 0) {
    newState = { ...newState, player: { ...newState.player, cash: newState.player.cash + insurancePayout.totalPayout } };
    events.push(...insurancePayout.messages);
  }

  // Step 5b: Advance any pledged church funds (docs/design/church-donations.md)
  // — capped at 1 percentage point per city per turn, so a big donation is
  // felt gradually rather than instantly.
  const churchProgress = advanceChurchProgress(newState.cities);
  newState = { ...newState, cities: churchProgress.cities };
  const completedCitySet = new Set(churchProgress.completedCities);
  for (const { cityId, gained, completion } of churchProgress.progressed) {
    if (completedCitySet.has(cityId)) {
      events.push(`⛪ The Church of ${CITIES[cityId].name} was completed, thanks in part to your generosity.`);
    } else {
      events.push(`⛪ Church of ${CITIES[cityId].name}: +${String(Math.round(gained))}% (now ${String(Math.round(completion))}%).`);
    }
  }

  // Step 5c: Deduct crew wages (docs/design/crew-management.md) — an
  // ongoing upkeep cost, same "flat per-turn cash effect" shape as the
  // (future) warehouse-income step, just the opposite sign.
  const crewWages = newState.fleet.ships.reduce((sum, ship) => sum + ship.crew * WAGE_PER_SAILOR_PER_TURN, 0);
  if (crewWages > 0) {
    newState = { ...newState, player: { ...newState.player, cash: newState.player.cash - crewWages } };
    events.push(`👥 Paid ${String(crewWages)} Mark in crew wages.`);
  }

  // Step 5d: Accrue loan interest (docs/design/banking-loans.md) —
  // compounding, same "flat per-turn financial effect" shape as crew wages
  // above, just tied to an outstanding balance instead of a fleet size.
  const loanResult = accrueLoanInterest(newState.player);
  if (loanResult.interestCharged > 0) {
    newState = { ...newState, player: loanResult.player };
    events.push(`🏦 ${String(loanResult.interestCharged)} Mark in loan interest accrued.`);
  }

  // Step 5e: Deduct insurance premiums (docs/design/insurance.md) — flat
  // per-turn cost per insured ship, same shape as crew wages above.
  const insurancePremium = accrueInsurancePremiums(newState.fleet.ships);
  if (insurancePremium > 0) {
    newState = { ...newState, player: { ...newState.player, cash: newState.player.cash - insurancePremium } };
    events.push(`🛡️ Paid ${String(insurancePremium)} Mark in insurance premiums.`);
  }

  // Step 5f: Accrue warehouse income (docs/design/warehouses.md) — flat
  // per-turn cash effect, opposite sign from crew wages/loan interest/
  // insurance premiums above. Originally silent (like market drift) to
  // avoid a noisy event every turn, but reported per player feedback that
  // every cash-affecting change should show up in the turn summary.
  const warehouseIncome = accrueWarehouseIncome(newState.warehouses);
  if (warehouseIncome > 0) {
    newState = { ...newState, player: { ...newState.player, cash: newState.player.cash + warehouseIncome } };
    events.push(`🏬 Earned ${String(warehouseIncome)} Mark in warehouse income.`);
  }

  // Step 6: Net worth, then political rank (needs net worth + Lübeck
  // reputation — see docs/design/political-rank.md).
  const netWorth = computeNetWorth(newState);
  const nextRank = evaluateRankUp(newState.player, netWorth);
  if (nextRank !== newState.player.politicalRank) {
    newState = { ...newState, player: { ...newState.player, politicalRank: nextRank } };
    events.push(rankUpMessage(nextRank));
  }

  // Step 7: Check win/lose. Winning (10,000+ net worth, or reaching Mayor)
  // no longer ends the session — the player can continue playing — so it
  // only ever fires the 'win' outcome once per game (newState.hasWon
  // latches permanently) rather than re-triggering the win screen every
  // subsequent turn while the qualifying condition remains true. Losing
  // conditions are unaffected and still apply even after a win.
  let outcome: 'win' | 'lose' | null = null;
  const qualifiesForWin = netWorth >= 10_000 || newState.player.politicalRank === 3;
  if (qualifiesForWin && !newState.hasWon) {
    outcome = 'win';
    newState = { ...newState, hasWon: true };
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
    crew: defaultCrew(type),
    cannons: 0,
    insured: false,
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

const MAX_SHIP_NAME_LENGTH = 30;

// Free, available anywhere — purely cosmetic, no gating like the other
// Shipyard actions need (a name isn't a physical repair/upgrade).
export function executeRenameShip(state: GameState, shipId: string, name: string): GameState {
  const trimmed = name.trim().slice(0, MAX_SHIP_NAME_LENGTH);
  if (!trimmed) return state;
  const ship = state.fleet.ships.find(s => s.id === shipId);
  if (!ship || trimmed === ship.name) return state;

  const newShip = { ...ship, name: trimmed };
  const newFleet = { ships: state.fleet.ships.map(s => (s.id === shipId ? newShip : s)) };

  return { ...state, fleet: newFleet };
}

export function executeHireCrew(state: GameState, shipId: string): GameState {
  const ship = state.fleet.ships.find(s => s.id === shipId);
  if (!ship || !isInPort(ship) || !isShipyardCity(ship.position)) return state;
  if (ship.crew >= CREW_MAX[ship.type]) return state;
  if (state.player.cash < CREW_HIRE_COST) return state;

  const newShip = { ...ship, crew: ship.crew + 1 };
  const newFleet = { ships: state.fleet.ships.map(s => (s.id === shipId ? newShip : s)) };
  const newPlayer = { ...state.player, cash: state.player.cash - CREW_HIRE_COST };

  return { ...state, player: newPlayer, fleet: newFleet };
}

// Releasing crew refunds nothing — a one-way cost, same severance-free
// friction as selling a warehouse (see crew-management.md).
export function executeReleaseCrew(state: GameState, shipId: string): GameState {
  const ship = state.fleet.ships.find(s => s.id === shipId);
  if (!ship || !isInPort(ship) || !isShipyardCity(ship.position)) return state;
  if (ship.crew <= 0) return state;

  const newShip = { ...ship, crew: ship.crew - 1 };
  const newFleet = { ships: state.fleet.ships.map(s => (s.id === shipId ? newShip : s)) };

  return { ...state, fleet: newFleet };
}

export function executeBuyCannon(state: GameState, shipId: string): GameState {
  const ship = state.fleet.ships.find(s => s.id === shipId);
  if (!ship || !isInPort(ship) || !isShipyardCity(ship.position)) return state;
  if (ship.cannons >= CANNON_MAX[ship.type]) return state;
  if (state.player.cash < CANNON_PRICE) return state;

  // Buying a cannon shrinks usable hold space by CANNON_CARGO_COST — reject
  // if currently-held cargo wouldn't fit the smaller capacity (same pattern
  // as executeBuy already rejecting a purchase beyond cargoSpace).
  const newShip = { ...ship, cannons: ship.cannons + 1 };
  if (cargoTotal(newShip) > cargoCapacity(newShip)) return state;

  const newFleet = { ships: state.fleet.ships.map(s => (s.id === shipId ? newShip : s)) };
  const newPlayer = { ...state.player, cash: state.player.cash - CANNON_PRICE };

  return { ...state, player: newPlayer, fleet: newFleet };
}

export function executeSellCannon(state: GameState, shipId: string): GameState {
  const ship = state.fleet.ships.find(s => s.id === shipId);
  if (!ship || !isInPort(ship) || !isShipyardCity(ship.position)) return state;
  if (ship.cannons <= 0) return state;

  const newShip = { ...ship, cannons: ship.cannons - 1 };
  const newFleet = { ships: state.fleet.ships.map(s => (s.id === shipId ? newShip : s)) };
  const newPlayer = { ...state.player, cash: state.player.cash + cannonSellValue() };

  return { ...state, player: newPlayer, fleet: newFleet };
}
