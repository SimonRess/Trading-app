import { describe, it, expect } from 'vitest';
import { buildStartingState } from '../data/starting-config.ts';
import { donateChurch } from './church-system.ts';

describe('donateChurch', () => {
  it('deducts cash', () => {
    const state = buildStartingState('TestPlayer');
    const next = donateChurch(state, 'hamburg', 100);
    expect(next.player.cash).toBe(state.player.cash - 100);
  });

  it('increases the target city completion proportionally (50 Mark per 1%)', () => {
    const state = buildStartingState('TestPlayer');
    const before = state.cities.hamburg.churchCompletion;
    const next = donateChurch(state, 'hamburg', 100);
    expect(next.cities.hamburg.churchCompletion).toBe(before + 2);
  });

  it('does not affect other cities', () => {
    const state = buildStartingState('TestPlayer');
    const before = state.cities.riga.churchCompletion;
    const next = donateChurch(state, 'hamburg', 100);
    expect(next.cities.riga.churchCompletion).toBe(before);
  });

  it('clamps completion at 100', () => {
    const state = buildStartingState('TestPlayer');
    const rich = { ...state, player: { ...state.player, cash: 100_000 } };
    const next = donateChurch(rich, 'hamburg', 10_000);
    expect(next.cities.hamburg.churchCompletion).toBe(100);
  });

  it('increases reputation in the target city (100 Mark per point)', () => {
    const state = buildStartingState('TestPlayer');
    const before = state.player.reputation.hamburg;
    const next = donateChurch(state, 'hamburg', 250);
    expect(next.player.reputation.hamburg).toBe(before + 3);
  });

  it('rejects a donation larger than current cash', () => {
    const state = buildStartingState('TestPlayer');
    const next = donateChurch(state, 'hamburg', state.player.cash + 1);
    expect(next).toBe(state);
  });

  it('rejects a non-positive amount', () => {
    const state = buildStartingState('TestPlayer');
    expect(donateChurch(state, 'hamburg', 0)).toBe(state);
    expect(donateChurch(state, 'hamburg', -50)).toBe(state);
  });

  it('does not mutate the input state', () => {
    const state = buildStartingState('TestPlayer');
    const before = JSON.parse(JSON.stringify(state)) as typeof state;
    donateChurch(state, 'hamburg', 100);
    expect(state).toEqual(before);
  });
});
