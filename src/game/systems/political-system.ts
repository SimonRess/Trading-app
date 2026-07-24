import type { CityId, PlayerState, PoliticalRank } from '../state/types.ts';

// Reputation is earned, not spent — capped at 100, never decays in this
// pass (see docs/design/political-rank.md "Non-Goals").
const REPUTATION_PER_SALE = 1;
const REPUTATION_CAP = 100;

// `amount` defaults to the flat per-sale gain, but callers earning
// reputation a different way (e.g. church-system.ts's donateChurch, scaled
// by Mark donated) pass their own — see docs/design/church-donations.md.
export function gainReputation(
  reputation: PlayerState['reputation'],
  cityId: CityId,
  amount: number = REPUTATION_PER_SALE,
): PlayerState['reputation'] {
  const next = Math.min(REPUTATION_CAP, reputation[cityId] + amount);
  return { ...reputation, [cityId]: next };
}

interface RankThreshold {
  rank: PoliticalRank;
  netWorth: number;
  lubeckReputation: number;
  label: string;
}

// Both conditions must hold: net worth alone would let a player "buy" the
// mayoralty by hoarding cargo without ever trading in Lübeck; reputation
// alone would let a low-net-worth player rank up via small repeated trades.
// Numbers are a first pass, not yet tuned by simulation — see
// docs/design/political-rank.md "Open Questions".
const RANK_THRESHOLDS: RankThreshold[] = [
  { rank: 1, netWorth: 1_500, lubeckReputation: 30, label: 'Guild Member' },
  { rank: 2, netWorth: 4_000, lubeckReputation: 50, label: 'Council Member' },
  { rank: 3, netWorth: 10_000, lubeckReputation: 75, label: 'Mayor of Lübeck' },
];

export const RANK_LABELS: Record<PoliticalRank, string> = {
  0: 'Citizen',
  1: 'Guild Member',
  2: 'Council Member',
  3: 'Mayor of Lübeck',
};

// Never demotes — returns the current rank if no higher threshold is met.
export function evaluateRankUp(player: PlayerState, netWorth: number): PoliticalRank {
  let rank = player.politicalRank;
  for (const threshold of RANK_THRESHOLDS) {
    if (threshold.rank <= rank) continue;
    if (netWorth >= threshold.netWorth && player.reputation.lubeck >= threshold.lubeckReputation) {
      rank = threshold.rank;
    }
  }
  return rank;
}

export function rankUpMessage(rank: PoliticalRank): string {
  const threshold = RANK_THRESHOLDS.find(t => t.rank === rank);
  const label = threshold?.label ?? RANK_LABELS[rank];
  if (rank === 3) return `🏛️ You have been elected ${label}!`;
  return `🏅 You have been inducted as ${label}!`;
}
