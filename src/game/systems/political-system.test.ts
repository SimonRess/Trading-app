import { describe, it, expect } from 'vitest';
import { buildStartingState } from '../data/starting-config.ts';
import { gainReputation, loseReputation, evaluateRankUp, rankUpMessage } from './political-system.ts';
import type { PlayerState } from '../state/types.ts';

describe('gainReputation', () => {
  it('increases the given city by 1', () => {
    const { player } = buildStartingState('TestPlayer');
    const next = gainReputation(player.reputation, 'lubeck');
    expect(next.lubeck).toBe(player.reputation.lubeck + 1);
  });

  it('does not affect other cities', () => {
    const { player } = buildStartingState('TestPlayer');
    const next = gainReputation(player.reputation, 'lubeck');
    expect(next.hamburg).toBe(player.reputation.hamburg);
  });

  it('caps at 100', () => {
    const { player } = buildStartingState('TestPlayer');
    const maxed = { ...player.reputation, lubeck: 100 };
    expect(gainReputation(maxed, 'lubeck').lubeck).toBe(100);
  });

  it('does not mutate the input', () => {
    const { player } = buildStartingState('TestPlayer');
    const before = { ...player.reputation };
    gainReputation(player.reputation, 'lubeck');
    expect(player.reputation).toEqual(before);
  });

  it('charismatic boosts gains by 10%', () => {
    const { player } = buildStartingState('TestPlayer');
    const next = gainReputation(player.reputation, 'lubeck', 10, ['charismatic']);
    expect(next.lubeck).toBe(player.reputation.lubeck + 11);
  });
});

describe('loseReputation', () => {
  it('decreases the given city by the amount', () => {
    const { player } = buildStartingState('TestPlayer');
    const next = loseReputation(player.reputation, 'lubeck', 5);
    expect(next.lubeck).toBe(player.reputation.lubeck - 5);
  });

  it('floors at 0', () => {
    const { player } = buildStartingState('TestPlayer');
    const low = { ...player.reputation, lubeck: 2 };
    expect(loseReputation(low, 'lubeck', 10).lubeck).toBe(0);
  });

  it('charismatic softens losses to 90%', () => {
    const { player } = buildStartingState('TestPlayer');
    const next = loseReputation(player.reputation, 'lubeck', 10, ['charismatic']);
    expect(next.lubeck).toBe(player.reputation.lubeck - 9);
  });

  it('hot-tempered worsens losses to 110%', () => {
    const { player } = buildStartingState('TestPlayer');
    const next = loseReputation(player.reputation, 'lubeck', 10, ['hot-tempered']);
    expect(next.lubeck).toBe(player.reputation.lubeck - 11);
  });

  it('hot-tempered does not affect gains', () => {
    const { player } = buildStartingState('TestPlayer');
    const next = gainReputation(player.reputation, 'lubeck', 10, ['hot-tempered']);
    expect(next.lubeck).toBe(player.reputation.lubeck + 10);
  });
});

describe('evaluateRankUp', () => {
  const base: PlayerState = buildStartingState('TestPlayer').player;

  it('stays at Citizen when below every threshold', () => {
    expect(evaluateRankUp(base, 500)).toBe(0);
  });

  it('requires both net worth and Lübeck reputation for Guild', () => {
    const highNetWorthLowRep = { ...base, reputation: { ...base.reputation, lubeck: 10 } };
    expect(evaluateRankUp(highNetWorthLowRep, 5_000)).toBe(0);

    const highRepLowNetWorth = { ...base, reputation: { ...base.reputation, lubeck: 90 } };
    expect(evaluateRankUp(highRepLowNetWorth, 100)).toBe(0);
  });

  it('promotes to Guild once both thresholds are met', () => {
    const player = { ...base, reputation: { ...base.reputation, lubeck: 30 } };
    expect(evaluateRankUp(player, 1_500)).toBe(1);
  });

  it('jumps straight to the highest rank whose threshold is met', () => {
    const player = { ...base, reputation: { ...base.reputation, lubeck: 80 } };
    expect(evaluateRankUp(player, 20_000)).toBe(3);
  });

  it('never demotes below the current rank', () => {
    const mayor = { ...base, politicalRank: 3 as const, reputation: { ...base.reputation, lubeck: 0 } };
    expect(evaluateRankUp(mayor, 0)).toBe(3);
  });
});

describe('rankUpMessage', () => {
  it('mentions Mayor for rank 3', () => {
    expect(rankUpMessage(3)).toContain('Mayor');
  });

  it('is non-empty for every rank', () => {
    for (const rank of [0, 1, 2, 3] as const) {
      expect(rankUpMessage(rank).length).toBeGreaterThan(0);
    }
  });
});
