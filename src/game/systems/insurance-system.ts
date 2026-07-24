import type { GameState, GoodId, Ship } from '../state/types.ts';
import { SHIP_TYPES } from '../data/ships.ts';
import { GOODS } from '../data/goods.ts';

export const INSURANCE_PREMIUM_PER_TURN = 20;
export const INSURANCE_PAYOUT_RATE = 0.5;

// Toggleable anytime, from anywhere — insurance is a financial product, not
// a physical repair, so it isn't shipyard- or port-restricted (see
// docs/design/insurance.md). Implemented as a persistent toggle rather than
// "purchased fresh every turn" — one less click per turn, same mental model
// as the doc's own comparison to crew wages/loan interest being flat
// per-turn charges once active.
export function executeToggleInsurance(state: GameState, shipId: string): GameState {
  const ship = state.fleet.ships.find(s => s.id === shipId);
  if (!ship) return state;

  const newShip = { ...ship, insured: !ship.insured };
  return { ...state, fleet: { ships: state.fleet.ships.map(s => (s.id === shipId ? newShip : s)) } };
}

export function accrueInsurancePremiums(ships: Ship[]): number {
  return ships.filter(s => s.insured).length * INSURANCE_PREMIUM_PER_TURN;
}

export interface InsurancePayoutResult {
  totalPayout: number;
  messages: string[];
}

// Compares ship state immediately before vs. after this turn's event
// resolution and pays insured ships 50% of any storm damage or lost cargo
// value. A wrecked ship no longer appears in postEventShips, so it isn't
// matched here — first pass deliberately doesn't cover a total loss, only
// damage/loss short of it (see docs/design/insurance.md Open Questions).
export function computeInsurancePayouts(preEventShips: Ship[], postEventShips: Ship[]): InsurancePayoutResult {
  const preById = new Map(preEventShips.map(s => [s.id, s]));
  let totalPayout = 0;
  const messages: string[] = [];

  for (const post of postEventShips) {
    if (!post.insured) continue;
    const pre = preById.get(post.id);
    if (!pre) continue;

    const durabilityLost = pre.durability - post.durability;
    if (durabilityLost > 0) {
      const valueLost = Math.round(SHIP_TYPES[post.type].purchasePrice * (durabilityLost / 100));
      const payout = Math.round(valueLost * INSURANCE_PAYOUT_RATE);
      if (payout > 0) {
        totalPayout += payout;
        messages.push(`🛡️ Insurance paid out ${String(payout)} Mark toward ${post.name}'s storm damage.`);
      }
    }

    const goodIds = new Set([...Object.keys(pre.cargo), ...Object.keys(post.cargo)]) as Set<GoodId>;
    let cargoLostValue = 0;
    for (const goodId of goodIds) {
      const lost = (pre.cargo[goodId] ?? 0) - (post.cargo[goodId] ?? 0);
      if (lost > 0) cargoLostValue += lost * GOODS[goodId].basePrice;
    }
    if (cargoLostValue > 0) {
      const payout = Math.round(cargoLostValue * INSURANCE_PAYOUT_RATE);
      if (payout > 0) {
        totalPayout += payout;
        messages.push(`🛡️ Insurance paid out ${String(payout)} Mark toward ${post.name}'s lost cargo.`);
      }
    }
  }

  return { totalPayout, messages };
}
