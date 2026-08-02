import type { GameState, FleetState, Convoy, Ship, CityId, GoodId } from '../state/types.ts';
import { isInPort, isInTransit, setDestination, cargoSpace, cargoCapacity } from './fleet-system.ts';
import { canDepart } from '../data/ships.ts';
import { resolveTradeStepped } from './market-system.ts';
import { isEmbargoed } from './market-system.ts';
import { traitPurchasePriceFactor } from './family-system.ts';

export function findConvoyForShip(fleet: FleetState, shipId: string): Convoy | undefined {
  return fleet.convoys.find(c => c.shipIds.includes(shipId));
}

export function convoyMembers(fleet: FleetState, convoy: Convoy): Ship[] {
  return convoy.shipIds
    .map(id => fleet.ships.find(s => s.id === id))
    .filter((s): s is Ship => s !== undefined);
}

function nextConvoyName(fleet: FleetState): string {
  let n = fleet.convoys.length + 1;
  const taken = new Set(fleet.convoys.map(c => c.name));
  while (taken.has(`Convoy ${String(n)}`)) n += 1;
  return `Convoy ${String(n)}`;
}

// A ship in dock, unassigned to any other convoy, is eligible. All members
// must already share a port (App.svelte's creation flow only offers ships
// docked together, but this re-validates server-side).
export function executeCreateConvoy(state: GameState, shipIds: string[], name?: string): GameState {
  if (shipIds.length < 2) return state;
  const ships = shipIds.map(id => state.fleet.ships.find(s => s.id === id)).filter((s): s is Ship => s !== undefined);
  if (ships.length !== shipIds.length) return state;
  if (!ships.every(isInPort)) return state;
  const firstPort = ships[0]?.position;
  if (!ships.every(s => s.position === firstPort)) return state;
  if (ships.some(s => findConvoyForShip(state.fleet, s.id))) return state;

  const convoy: Convoy = {
    id: `convoy-${String(Date.now())}`,
    name: name?.trim() || nextConvoyName(state.fleet),
    shipIds,
    posture: 'defensive',
  };

  return { ...state, fleet: { ...state.fleet, convoys: [...state.fleet.convoys, convoy] } };
}

export function executeAddShipToConvoy(state: GameState, convoyId: string, shipId: string): GameState {
  const convoy = state.fleet.convoys.find(c => c.id === convoyId);
  const ship = state.fleet.ships.find(s => s.id === shipId);
  if (!convoy || !ship) return state;
  if (!isInPort(ship)) return state;
  const members = convoyMembers(state.fleet, convoy);
  if (members.length > 0 && members[0]?.position !== ship.position) return state;
  if (findConvoyForShip(state.fleet, shipId)) return state;

  const newConvoy = { ...convoy, shipIds: [...convoy.shipIds, shipId] };
  return {
    ...state,
    fleet: { ...state.fleet, convoys: state.fleet.convoys.map(c => (c.id === convoyId ? newConvoy : c)) },
  };
}

// Excluding a ship only while docked — mid-voyage membership changes are
// deliberately not offered (docs/design/ship-convoys.md Edge Cases). A
// convoy left with a single member auto-dissolves back to independent.
export function executeRemoveShipFromConvoy(state: GameState, shipId: string): GameState {
  const convoy = findConvoyForShip(state.fleet, shipId);
  const ship = state.fleet.ships.find(s => s.id === shipId);
  if (!convoy || !ship || !isInPort(ship)) return state;

  const remaining = convoy.shipIds.filter(id => id !== shipId);
  const convoys =
    remaining.length < 2
      ? state.fleet.convoys.filter(c => c.id !== convoy.id)
      : state.fleet.convoys.map(c => (c.id === convoy.id ? { ...c, shipIds: remaining } : c));

  return { ...state, fleet: { ...state.fleet, convoys } };
}

export function executeDissolveConvoy(state: GameState, convoyId: string): GameState {
  return { ...state, fleet: { ...state.fleet, convoys: state.fleet.convoys.filter(c => c.id !== convoyId) } };
}

export function executeSetConvoyPosture(state: GameState, convoyId: string, posture: Ship['posture']): GameState {
  return {
    ...state,
    fleet: {
      ...state.fleet,
      convoys: state.fleet.convoys.map(c => (c.id === convoyId ? { ...c, posture } : c)),
    },
  };
}

// Travel time for the convoy = the slowest member's individually-computed
// travel time, applied uniformly to every member so they stay in lockstep
// (docs/design/ship-convoys.md "Travel"). Gated on every member being able
// to depart — one crippled ship holds the whole convoy in port.
export function executeSetConvoyDestination(state: GameState, convoyId: string, destination: CityId): GameState {
  const convoy = state.fleet.convoys.find(c => c.id === convoyId);
  if (!convoy) return state;
  const members = convoyMembers(state.fleet, convoy);
  if (members.length === 0) return state;
  if (!members.every(isInPort)) return state;
  if (!members.every(s => canDepart(s.durability) && s.repairCooldown === 0)) return state;

  const updated = members.map(s => setDestination(s, destination));
  if (updated.some(s => isInPort(s))) return state; // some member couldn't route there

  const maxTurns = Math.max(
    ...updated.map(s => (isInTransit(s) ? s.position.turnsRemaining : 0)),
  );

  const finalShips = updated.map(s => {
    if (!isInTransit(s)) return s;
    return { ...s, position: { from: s.position.from, to: s.position.to, turnsRemaining: maxTurns } };
  });

  const shipsById = new Map(finalShips.map(s => [s.id, s]));
  return {
    ...state,
    fleet: {
      ...state.fleet,
      ships: state.fleet.ships.map(s => shipsById.get(s.id) ?? s),
    },
  };
}

// Interchangeable per docs/design/ship-convoys.md — a distribution strategy
// takes the member ships and a total quantity and decides each ship's
// share. Proportional is the default: for a buy, weighted by each ship's
// remaining cargo space; for a sell, weighted by each ship's held quantity
// of that good.
export type ConvoyDistributionStrategy = (
  ships: Ship[],
  goodId: GoodId,
  totalQty: number,
  direction: 'buy' | 'sell',
) => Record<string, number>;

export const PROPORTIONAL_DISTRIBUTION: ConvoyDistributionStrategy = (ships, goodId, totalQty, direction) => {
  const weights = ships.map(s => (direction === 'buy' ? cargoSpace(s) : (s.cargo[goodId] ?? 0)));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const result: Record<string, number> = {};
  if (totalWeight <= 0) return result;

  let remaining = totalQty;
  ships.forEach((ship, i) => {
    const weight = weights[i] ?? 0;
    const isLast = i === ships.length - 1;
    let share = isLast ? remaining : Math.min(remaining, Math.floor((totalQty * weight) / totalWeight));
    share = Math.min(share, weight); // never assign more than the ship can hold/has
    result[ship.id] = share;
    remaining -= share;
  });

  return result;
};

export function executeConvoyBuy(
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
  if (isEmbargoed(state.cityEffects, cityId, goodId)) return state;

  const totalSpace = members.reduce((sum, s) => sum + cargoSpace(s), 0);
  if (totalSpace < quantity) return state;

  const market = state.market[cityId][goodId];
  const { market: nextGoodMarket, totalCost } = resolveTradeStepped(
    market,
    quantity,
    1,
    traitPurchasePriceFactor(state.player.traits),
  );
  if (state.player.cash < totalCost) return state;

  const distribution = strategy(members, goodId, quantity, 'buy');
  const newShips = state.fleet.ships.map(s => {
    const share = distribution[s.id];
    if (!share) return s;
    return { ...s, cargo: { ...s.cargo, [goodId]: (s.cargo[goodId] ?? 0) + share } };
  });

  return {
    ...state,
    player: { ...state.player, cash: state.player.cash - totalCost },
    fleet: { ...state.fleet, ships: newShips },
    market: { ...state.market, [cityId]: { ...state.market[cityId], [goodId]: nextGoodMarket } },
  };
}

export function executeConvoySell(
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
  if (isEmbargoed(state.cityEffects, cityId, goodId)) return state;

  const totalHeld = members.reduce((sum, s) => sum + (s.cargo[goodId] ?? 0), 0);
  if (totalHeld < quantity) return state;

  const market = state.market[cityId][goodId];
  const { market: nextGoodMarket, totalCost: totalRevenue } = resolveTradeStepped(market, quantity, -1);

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
    player: { ...state.player, cash: state.player.cash + totalRevenue },
    fleet: { ...state.fleet, ships: newShips },
    market: { ...state.market, [cityId]: { ...state.market[cityId], [goodId]: nextGoodMarket } },
  };
}

export function convoyCargoSpace(fleet: FleetState, convoy: Convoy): number {
  return convoyMembers(fleet, convoy).reduce((sum, s) => sum + cargoSpace(s), 0);
}

export function convoyCargoCapacity(fleet: FleetState, convoy: Convoy): number {
  return convoyMembers(fleet, convoy).reduce((sum, s) => sum + cargoCapacity(s), 0);
}

export interface ConvoyGroup {
  convoy: Convoy;
  ships: Ship[];
}

// Groups a fleet's ships for display (docs/design/ship-convoys.md "UI
// Design"): convoyed ships come back bundled with their convoy, everything
// else comes back as a standalone entry in `independent`.
export function groupShipsByConvoy(fleet: FleetState): { groups: ConvoyGroup[]; independent: Ship[] } {
  const groups = fleet.convoys.map(convoy => ({ convoy, ships: convoyMembers(fleet, convoy) }));
  const groupedIds = new Set(fleet.convoys.flatMap(c => c.shipIds));
  const independent = fleet.ships.filter(s => !groupedIds.has(s.id));
  return { groups, independent };
}

export function convoyCargo(fleet: FleetState, convoy: Convoy): Partial<Record<GoodId, number>> {
  const totals: Partial<Record<GoodId, number>> = {};
  for (const ship of convoyMembers(fleet, convoy)) {
    for (const [goodId, qty] of Object.entries(ship.cargo) as Array<[GoodId, number]>) {
      totals[goodId] = (totals[goodId] ?? 0) + qty;
    }
  }
  return totals;
}
