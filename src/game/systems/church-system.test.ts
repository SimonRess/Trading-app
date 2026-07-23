import { describe, it, expect } from 'vitest';
import { buildStartingState } from '../data/starting-config.ts';
import { donateChurch, advanceChurchProgress } from './church-system.ts';

describe('donateChurch', () => {
  it('deducts cash', () => {
    const state = buildStartingState('TestPlayer');
    const next = donateChurch(state, 'hamburg', 100);
    expect(next.player.cash).toBe(state.player.cash - 100);
  });

  it('pledges the amount without moving completion yet', () => {
    const state = buildStartingState('TestPlayer');
    const before = state.cities.hamburg.churchCompletion;
    const next = donateChurch(state, 'hamburg', 100);
    expect(next.cities.hamburg.churchCompletion).toBe(before);
    expect(next.cities.hamburg.churchPledged).toBe(100);
  });

  it('does not affect other cities', () => {
    const state = buildStartingState('TestPlayer');
    const before = state.cities.riga.churchPledged;
    const next = donateChurch(state, 'hamburg', 100);
    expect(next.cities.riga.churchPledged).toBe(before);
  });

  it('caps the accepted amount at the city\'s remaining capacity', () => {
    const state = buildStartingState('TestPlayer');
    const rich = { ...state, player: { ...state.player, cash: 100_000 } };
    // Hamburg starts at 25% -> 75 percentage points remaining = 3,750 Mark capacity.
    const next = donateChurch(rich, 'hamburg', 10_000);
    expect(next.cities.hamburg.churchPledged).toBe(3_750);
    expect(next.player.cash).toBe(rich.player.cash - 3_750);
  });

  it('rejects further donations once a city has no remaining capacity', () => {
    const state = buildStartingState('TestPlayer');
    const complete = { ...state, cities: { ...state.cities, hamburg: { ...state.cities.hamburg, churchCompletion: 100 } } };
    const next = donateChurch(complete, 'hamburg', 100);
    expect(next).toBe(complete);
  });

  it('increases reputation in the target city immediately (100 Mark per point)', () => {
    const state = buildStartingState('TestPlayer');
    const before = state.player.reputation.hamburg;
    const next = donateChurch(state, 'hamburg', 250);
    expect(next.player.reputation.hamburg).toBe(before + 3);
  });

  it('rejects a donation larger than current cash', () => {
    const state = buildStartingState('TestPlayer');
    const poor = { ...state, player: { ...state.player, cash: 10 } };
    const next = donateChurch(poor, 'hamburg', 100);
    expect(next.cities.hamburg.churchPledged).toBe(10);
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

describe('advanceChurchProgress', () => {
  it('does nothing for a city with no pledged funds', () => {
    const state = buildStartingState('TestPlayer');
    const { cities } = advanceChurchProgress(state.cities);
    expect(cities).toEqual(state.cities);
  });

  it('converts at most 50 Mark (1%) of pledged funds per turn', () => {
    const state = buildStartingState('TestPlayer');
    const pledged = { ...state.cities, hamburg: { ...state.cities.hamburg, churchPledged: 200 } };
    const { cities } = advanceChurchProgress(pledged);
    expect(cities.hamburg.churchCompletion).toBe(state.cities.hamburg.churchCompletion + 1);
    expect(cities.hamburg.churchPledged).toBe(150);
  });

  it('spreads a large pledge across multiple calls (turns)', () => {
    const state = buildStartingState('TestPlayer');
    let cities = { ...state.cities, hamburg: { ...state.cities.hamburg, churchPledged: 150 } };
    const startCompletion = cities.hamburg.churchCompletion;

    ({ cities } = advanceChurchProgress(cities));
    expect(cities.hamburg.churchCompletion).toBe(startCompletion + 1);
    ({ cities } = advanceChurchProgress(cities));
    expect(cities.hamburg.churchCompletion).toBe(startCompletion + 2);
    ({ cities } = advanceChurchProgress(cities));
    expect(cities.hamburg.churchCompletion).toBe(startCompletion + 3);
    expect(cities.hamburg.churchPledged).toBe(0);
  });

  it('reports a city as completed only on the turn it first reaches 100%', () => {
    const state = buildStartingState('TestPlayer');
    // 74% + 1% = 75%, not yet complete.
    let cities = { ...state.cities, hamburg: { ...state.cities.hamburg, churchCompletion: 74, churchPledged: 100 } };
    let result = advanceChurchProgress(cities);
    expect(result.completedCities).toEqual([]);

    cities = { ...result.cities, hamburg: { ...result.cities.hamburg, churchCompletion: 99, churchPledged: 50 } };
    result = advanceChurchProgress(cities);
    expect(result.cities.hamburg.churchCompletion).toBe(100);
    expect(result.completedCities).toEqual(['hamburg']);

    // Already complete, nothing pledged -> not reported again.
    result = advanceChurchProgress(result.cities);
    expect(result.completedCities).toEqual([]);
  });

  it('does not mutate the input', () => {
    const state = buildStartingState('TestPlayer');
    const pledged = { ...state.cities, hamburg: { ...state.cities.hamburg, churchPledged: 100 } };
    const before = JSON.parse(JSON.stringify(pledged)) as typeof pledged;
    advanceChurchProgress(pledged);
    expect(pledged).toEqual(before);
  });
});
