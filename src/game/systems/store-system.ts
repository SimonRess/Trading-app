import type { GameState, CityId, GoodId } from '../state/types.ts';
import { isInPort, cargoSpace } from './fleet-system.ts';
import { resolveTradeStepped, isEmbargoed } from './market-system.ts';
import { traitPurchasePriceFactor } from './family-system.ts';
import { storeCapacityRemaining } from './warehouse-system.ts';
import { convoyMembers } from './convoy-system.ts';
import type { ConvoyDistributionStrategy } from './convoy-system.ts';
import { PROPORTIONAL_DISTRIBUTION } from './convoy-system.ts';

function addToStore(state: GameState, cityId: CityId, goodId: GoodId, qty: number): GameState['cityStores'] {
  const cityStore = state.cityStores[cityId] ?? {};
  return { ...state.cityStores, [cityId]: { ...cityStore, [goodId]: (cityStore[goodId] ?? 0) + qty } };
}

function removeFromStore(state: GameState, cityId: CityId, goodId: GoodId, qty: number): GameState['cityStores'] {
  const cityStore = state.cityStores[cityId] ?? {};
  const newQty = (cityStore[goodId] ?? 0) - qty;
  const { [goodId]: _drop, ...rest } = cityStore;
  void _drop;
  const newCityStore = newQty <= 0 ? rest : { ...rest, [goodId]: newQty };
  return { ...state.cityStores, [cityId]: newCityStore };
}

// Direct city market <-> store trading — no ship involved, one stepped
// trade against the market same as executeBuy/executeSell, but the
// resulting quantity moves into/out of cityStores instead of ship cargo.
// See docs/design/city-stores.md "Direct store <-> market trading".
export function executeStoreBuy(state: GameState, cityId: CityId, goodId: GoodId, quantity: number): GameState {
  if (isEmbargoed(state.cityEffects, cityId, goodId)) return state;
  if (storeCapacityRemaining(state, cityId) < quantity) return state;

  const market = state.market[cityId][goodId];
  const { market: nextGoodMarket, totalCost } = resolveTradeStepped(
    market,
    quantity,
    1,
    traitPurchasePriceFactor(state.player.traits),
  );
  if (state.player.cash < totalCost) return state;

  return {
    ...state,
    player: { ...state.player, cash: state.player.cash - totalCost },
    cityStores: addToStore(state, cityId, goodId, quantity),
    market: { ...state.market, [cityId]: { ...state.market[cityId], [goodId]: nextGoodMarket } },
  };
}

export function executeStoreSell(state: GameState, cityId: CityId, goodId: GoodId, quantity: number): GameState {
  if (isEmbargoed(state.cityEffects, cityId, goodId)) return state;
  const held = state.cityStores[cityId]?.[goodId] ?? 0;
  if (held < quantity) return state;

  const market = state.market[cityId][goodId];
  const { market: nextGoodMarket, totalCost: totalRevenue } = resolveTradeStepped(market, quantity, -1);

  return {
    ...state,
    player: { ...state.player, cash: state.player.cash + totalRevenue },
    cityStores: removeFromStore(state, cityId, goodId, quantity),
    market: { ...state.market, [cityId]: { ...state.market[cityId], [goodId]: nextGoodMarket } },
  };
}

// Pure repositioning between a docked ship's cargo and the city's store —
// no market transaction, no cost.
export function executeStoreDeposit(state: GameState, shipId: string, cityId: CityId, goodId: GoodId, quantity: number): GameState {
  const ship = state.fleet.ships.find(s => s.id === shipId);
  if (!ship || !isInPort(ship) || ship.position !== cityId) return state;
  const held = ship.cargo[goodId] ?? 0;
  if (held < quantity) return state;
  if (storeCapacityRemaining(state, cityId) < quantity) return state;

  const newQty = held - quantity;
  const { [goodId]: _drop, ...rest } = ship.cargo;
  void _drop;
  const newCargo: typeof ship.cargo = newQty <= 0 ? rest : { ...rest, [goodId]: newQty };
  const newShip = { ...ship, cargo: newCargo };

  return {
    ...state,
    fleet: { ...state.fleet, ships: state.fleet.ships.map(s => (s.id === shipId ? newShip : s)) },
    cityStores: addToStore(state, cityId, goodId, quantity),
  };
}

export function executeStoreWithdraw(state: GameState, shipId: string, cityId: CityId, goodId: GoodId, quantity: number): GameState {
  const ship = state.fleet.ships.find(s => s.id === shipId);
  if (!ship || !isInPort(ship) || ship.position !== cityId) return state;
  if (cargoSpace(ship) < quantity) return state;
  const held = state.cityStores[cityId]?.[goodId] ?? 0;
  if (held < quantity) return state;

  const newShip = { ...ship, cargo: { ...ship.cargo, [goodId]: (ship.cargo[goodId] ?? 0) + quantity } };

  return {
    ...state,
    fleet: { ...state.fleet, ships: state.fleet.ships.map(s => (s.id === shipId ? newShip : s)) },
    cityStores: removeFromStore(state, cityId, goodId, quantity),
  };
}

// Convoy deposit/withdraw reuse the exact same swappable
// ConvoyDistributionStrategy convoy-system.ts already established for
// CONVOY_BUY_GOOD/CONVOY_SELL_GOOD — deposit pulls from members
// proportional to what each holds (sell-direction weights), withdraw
// pushes to members proportional to remaining space (buy-direction
// weights). See docs/design/city-stores.md "Ship & convoy deposit/withdraw".
export function executeConvoyStoreDeposit(
  state: GameState,
  convoyId: string,
  cityId: CityId,
  goodId: GoodId,
  quantity: number,
  strategy: ConvoyDistributionStrategy = PROPORTIONAL_DISTRIBUTION,
): GameState {
  const convoy = state.fleet.convoys.find(c => c.id === convoyId);
  if (!convoy) return state;
  const members = convoyMembers(state.fleet, convoy);
  if (!members.every(isInPort) || !members.every(s => s.position === cityId)) return state;

  const totalHeld = members.reduce((sum, s) => sum + (s.cargo[goodId] ?? 0), 0);
  if (totalHeld < quantity) return state;
  if (storeCapacityRemaining(state, cityId) < quantity) return state;

  const distribution = strategy(members, goodId, quantity, 'sell');
  const newShips = state.fleet.ships.map(s => {
    const share = distribution[s.id];
    if (!share) return s;
    const newQty = (s.cargo[goodId] ?? 0) - share;
    const { [goodId]: _drop, ...rest } = s.cargo;
    void _drop;
    const newCargo: typeof s.cargo = newQty <= 0 ? rest : { ...rest, [goodId]: newQty };
    return { ...s, cargo: newCargo };
  });

  return {
    ...state,
    fleet: { ...state.fleet, ships: newShips },
    cityStores: addToStore(state, cityId, goodId, quantity),
  };
}

export function executeConvoyStoreWithdraw(
  state: GameState,
  convoyId: string,
  cityId: CityId,
  goodId: GoodId,
  quantity: number,
  strategy: ConvoyDistributionStrategy = PROPORTIONAL_DISTRIBUTION,
): GameState {
  const convoy = state.fleet.convoys.find(c => c.id === convoyId);
  if (!convoy) return state;
  const members = convoyMembers(state.fleet, convoy);
  if (!members.every(isInPort) || !members.every(s => s.position === cityId)) return state;

  const held = state.cityStores[cityId]?.[goodId] ?? 0;
  if (held < quantity) return state;
  const totalSpace = members.reduce((sum, s) => sum + cargoSpace(s), 0);
  if (totalSpace < quantity) return state;

  const distribution = strategy(members, goodId, quantity, 'buy');
  const newShips = state.fleet.ships.map(s => {
    const share = distribution[s.id];
    if (!share) return s;
    return { ...s, cargo: { ...s.cargo, [goodId]: (s.cargo[goodId] ?? 0) + share } };
  });

  return {
    ...state,
    fleet: { ...state.fleet, ships: newShips },
    cityStores: removeFromStore(state, cityId, goodId, quantity),
  };
}
