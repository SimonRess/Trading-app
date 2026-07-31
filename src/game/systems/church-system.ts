import type { CityId, CitiesState, GameState } from '../state/types.ts';
import { gainReputation } from './political-system.ts';

// Placeholder numbers pending simulation/tuning — see docs/design/
// church-donations.md "Open Questions", same caveat as every other
// economic addition (ADR-015, political-rank.md). Exported so the UI
// (App.svelte's "~N more turns" estimate) computes off the same numbers
// instead of a separately hardcoded one — a mismatch here previously
// showed "~20 more turns" for a pledge that actually finishes in 2.
export const DONATION_COST_PER_PERCENT = 500;
export const REPUTATION_COST_PER_POINT = 1000;

// Completion advances by at most this many percentage points per city per
// turn (advanceChurchProgress below), regardless of how much is pledged —
// a large donation is felt gradually over several turns, not instantly.
export const PROGRESS_CAP_PER_TURN = 1;

// Mark consumed per turn at the cap above — the number the UI needs to
// estimate "how many more turns" for a given pledge.
export const MAX_MARK_PER_TURN = PROGRESS_CAP_PER_TURN * DONATION_COST_PER_PERCENT;

// Donating pledges cash toward a city's church immediately (cash leaves the
// player's hand and reputation is earned right away — the gift was real),
// but the completion percentage itself only moves via advanceChurchProgress
// during turn resolution. Rejects (returns state unchanged) once a city's
// remaining capacity (100% minus what's already complete or pledged) is
// zero, and silently caps the accepted amount to that remaining capacity
// otherwise, so pledged Mark can never accumulate past what the church
// actually needs.
export function donateChurch(state: GameState, cityId: CityId, amount: number): GameState {
  if (!Number.isFinite(amount) || amount <= 0) return state;

  const city = state.cities[cityId];
  const remainingCapacity = Math.max(0, (100 - city.churchCompletion) * DONATION_COST_PER_PERCENT - city.churchPledged);
  if (remainingCapacity <= 0) return state;

  const effectiveAmount = Math.min(amount, remainingCapacity, state.player.cash);
  if (effectiveAmount <= 0) return state;

  const reputationGain = Math.round(effectiveAmount / REPUTATION_COST_PER_POINT);

  return {
    ...state,
    player: {
      ...state.player,
      cash: state.player.cash - effectiveAmount,
      reputation: gainReputation(state.player.reputation, cityId, reputationGain, state.player.traits),
    },
    cities: {
      ...state.cities,
      [cityId]: { ...city, churchPledged: city.churchPledged + effectiveAmount },
    },
  };
}

export interface ChurchProgress {
  cityId: CityId;
  gained: number; // percentage points gained this turn
  completion: number; // resulting completion percentage
}

export interface ChurchProgressResult {
  cities: CitiesState;
  completedCities: CityId[];
  progressed: ChurchProgress[];
}

// Called once per turn (turn-system.ts's resolveTurn) — converts pledged
// Mark into actual completion, capped at PROGRESS_CAP_PER_TURN percentage
// points per city per turn. Every city that actually advanced is reported
// in `progressed` so resolveTurn can surface it in the turn summary — not
// just the turn a church finally crosses 100% (docs/design/
// church-donations.md, per player feedback that turn-summary reporting
// should cover every change, not only completions).
export function advanceChurchProgress(cities: CitiesState): ChurchProgressResult {
  const completedCities: CityId[] = [];
  const progressed: ChurchProgress[] = [];
  const nextCities = { ...cities };

  for (const cityId of Object.keys(cities) as CityId[]) {
    const city = cities[cityId];
    if (city.churchPledged <= 0) continue;

    const consumed = Math.min(city.churchPledged, MAX_MARK_PER_TURN);
    const wasComplete = city.churchCompletion >= 100;
    const nextCompletion = Math.min(100, city.churchCompletion + consumed / DONATION_COST_PER_PERCENT);
    const gained = nextCompletion - city.churchCompletion;

    nextCities[cityId] = { ...city, churchCompletion: nextCompletion, churchPledged: city.churchPledged - consumed };
    if (gained > 0) progressed.push({ cityId, gained, completion: nextCompletion });
    if (!wasComplete && nextCompletion >= 100) completedCities.push(cityId);
  }

  return { cities: nextCities, completedCities, progressed };
}
