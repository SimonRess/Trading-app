import type { AchievementId, GameState } from '../state/types.ts';

export const ACHIEVEMENT_IDS: AchievementId[] = [
  'net-worth-1000',
  'net-worth-10000',
  'first-ship-lost',
  'first-mayor',
  'second-generation',
];

// Pure: given the state just before and just after some change (a resolved
// turn, or a heir choice resolving via executeChooseHeir — succession can
// complete in either place, see family-succession.md), returns the
// achievement ids that became newly true this transition and aren't
// already unlocked. Callers append the result to GameState.achievements
// and report it in the turn summary.
//
// netWorth is passed in rather than computed here via computeNetWorth
// (turn-system.ts) specifically to avoid a circular import — turn-system.ts
// is this module's caller, and every call site already has netWorth
// computed for its own purposes (rank-up, win/lose checks).
//
// Milestones are picked for being cleanly diffable from top-level
// GameState alone, without threading new signals through event-system.ts
// (e.g. "survived a pirate victory" was considered but dropped — cargo
// gained from combat loot isn't reliably distinguishable from cargo
// gained by ordinary trading at this level).
export function evaluateAchievements(prev: GameState, next: GameState, netWorth: number): AchievementId[] {
  const already = new Set(next.achievements);
  const unlocked: AchievementId[] = [];
  const unlock = (id: AchievementId, condition: boolean): void => {
    if (condition && !already.has(id)) unlocked.push(id);
  };

  unlock('net-worth-1000', netWorth >= 1000);
  unlock('net-worth-10000', netWorth >= 10000);
  unlock('first-ship-lost', next.fleet.ships.length < prev.fleet.ships.length);
  unlock('first-mayor', next.player.politicalRank === 3);
  // Reuses the chronicle rather than a separate generation counter — every
  // successful succession (not the no-heir ending, which uses a different
  // message) appends an entry containing this phrase.
  unlock('second-generation', next.chronicle.some(e => e.includes('takes up the family trade')));

  return unlocked;
}

// Turn-summary announcement text, same English-only convention as
// rankUpMessage (political-system.ts) — game-logic messages aren't
// localized (see docs/design/localization.md's scope boundary). The UI
// layer maps AchievementId to a localized label separately for the
// persistent achievements panel; this is only the one-time announcement.
export function achievementMessage(id: AchievementId): string {
  switch (id) {
    case 'net-worth-1000': return '🏆 Milestone: net worth reached 1,000 Mark.';
    case 'net-worth-10000': return '🏆 Milestone: net worth reached 10,000 Mark.';
    case 'first-ship-lost': return '🏆 Milestone: your first ship was lost.';
    case 'first-mayor': return '🏆 Milestone: elected Mayor of Lübeck for the first time.';
    case 'second-generation': return '🏆 Milestone: the dynasty reached its second generation.';
  }
}
