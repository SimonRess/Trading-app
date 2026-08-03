import { describe, it, expect } from 'vitest';
import { evaluateAchievements, achievementMessage } from './achievement-system.ts';
import { buildStartingState } from '../data/starting-config.ts';

describe('evaluateAchievements', () => {
  it('unlocks net-worth-1000 once net worth crosses the threshold', () => {
    const prev = buildStartingState('Tester');
    const next = { ...prev, player: { ...prev.player, cash: 1200 } };
    expect(evaluateAchievements(prev, next, 1200)).toEqual(['net-worth-1000']);
  });

  it('unlocks both net-worth tiers at once if crossed in a single jump', () => {
    const prev = buildStartingState('Tester');
    const next = { ...prev, player: { ...prev.player, cash: 12000 } };
    expect(evaluateAchievements(prev, next, 12000)).toEqual(['net-worth-1000', 'net-worth-10000']);
  });

  it('does not re-unlock an already-unlocked achievement', () => {
    const prev = buildStartingState('Tester');
    const withAchievement = { ...prev, achievements: ['net-worth-1000' as const] };
    expect(evaluateAchievements(prev, withAchievement, 1500)).toEqual([]);
  });

  it('unlocks first-ship-lost when the fleet shrinks', () => {
    const prev = buildStartingState('Tester');
    const next = { ...prev, fleet: { convoys: [], ships: [] } };
    expect(evaluateAchievements(prev, next, 0)).toContain('first-ship-lost');
  });

  it('does not unlock first-ship-lost when the fleet grows or stays the same', () => {
    const prev = buildStartingState('Tester');
    expect(evaluateAchievements(prev, prev, 0)).not.toContain('first-ship-lost');
  });

  it('unlocks first-mayor at political rank 3', () => {
    const prev = buildStartingState('Tester');
    const next = { ...prev, player: { ...prev.player, politicalRank: 3 as const } };
    expect(evaluateAchievements(prev, next, 0)).toContain('first-mayor');
  });

  it('unlocks second-generation when the chronicle records a successful succession', () => {
    const prev = buildStartingState('Tester');
    const next = { ...prev, chronicle: [...prev.chronicle, '⚱️ Wulf has passed away. Their heir, Grete, takes up the family trade.'] };
    expect(evaluateAchievements(prev, next, 0)).toContain('second-generation');
  });

  it('does not unlock second-generation on a no-heir game over', () => {
    const prev = buildStartingState('Tester');
    const next = { ...prev, chronicle: [...prev.chronicle, '⚰️ Wulf has died with no eligible heir. The dynasty ends here.'] };
    expect(evaluateAchievements(prev, next, 0)).not.toContain('second-generation');
  });
});

describe('achievementMessage', () => {
  it('returns distinct text for every achievement id', () => {
    const ids = ['net-worth-1000', 'net-worth-10000', 'first-ship-lost', 'first-mayor', 'second-generation'] as const;
    const messages = ids.map(achievementMessage);
    expect(new Set(messages).size).toBe(ids.length);
  });
});
