import type { CityId, GameState } from '../state/types.ts';
import { gainReputation } from './political-system.ts';

// Placeholder numbers pending simulation/tuning — see docs/design/
// church-donations.md "Open Questions", same caveat as every other
// economic addition (ADR-015, political-rank.md).
const DONATION_COST_PER_PERCENT = 50;
const REPUTATION_COST_PER_POINT = 100;

export function donateChurch(state: GameState, cityId: CityId, amount: number): GameState {
  if (!Number.isFinite(amount) || amount <= 0) return state;
  if (state.player.cash < amount) return state;

  const city = state.cities[cityId];
  const nextCompletion = Math.min(100, city.churchCompletion + amount / DONATION_COST_PER_PERCENT);
  const reputationGain = Math.round(amount / REPUTATION_COST_PER_POINT);

  return {
    ...state,
    player: {
      ...state.player,
      cash: state.player.cash - amount,
      reputation: gainReputation(state.player.reputation, cityId, reputationGain),
    },
    cities: {
      ...state.cities,
      [cityId]: { ...city, churchCompletion: nextCompletion },
    },
  };
}
