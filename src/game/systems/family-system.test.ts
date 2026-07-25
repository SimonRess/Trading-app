import { describe, it, expect, vi } from 'vitest';
import { buildStartingState } from '../data/starting-config.ts';
import { executeSeekMarriage, executeHireTutor, growChildren, attemptBirth, traitPurchasePriceFactor } from './family-system.ts';
import { HIRE_TUTOR_COST } from '../data/family.ts';
import type { Child } from '../state/types.ts';

describe('executeSeekMarriage', () => {
  it('marries the player to the Fisherman\'s Daughter and deducts the buyout', () => {
    const state = buildStartingState('TestPlayer');
    const before = state.player.cash;
    const next = executeSeekMarriage(state);
    expect(next.player.maritalStatus).toBe('married');
    expect(next.player.partner?.title).toBe("the Fisherman's Daughter");
    expect(next.player.cash).toBe(before - 300);
  });

  it('gifts herring to a ship docked in Lübeck', () => {
    const state = buildStartingState('TestPlayer');
    const next = executeSeekMarriage(state);
    expect(next.fleet.ships[0]!.cargo.herring).toBe(10);
  });

  it('rejects marrying while already married', () => {
    const state = executeSeekMarriage(buildStartingState('TestPlayer'));
    const next = executeSeekMarriage(state);
    expect(next).toBe(state);
  });

  it('rejects marrying below the minimum age', () => {
    const state = buildStartingState('TestPlayer');
    const young = { ...state, player: { ...state.player, age: 15 } };
    const next = executeSeekMarriage(young);
    expect(next).toBe(young);
  });

  it('rejects marrying without enough cash for the buyout', () => {
    const state = buildStartingState('TestPlayer');
    const poor = { ...state, player: { ...state.player, cash: 100 } };
    const next = executeSeekMarriage(poor);
    expect(next).toBe(poor);
  });
});

describe('executeHireTutor', () => {
  const childState = () => {
    const state = buildStartingState('TestPlayer');
    const child: Child = { id: 'child-1', name: 'Hans', age: 5, gender: 'male', health: 100, traits: [], tutoredThisYear: false };
    return { ...state, player: { ...state.player, children: [child] } };
  };

  it('deducts cost and marks the child tutored this year', () => {
    const state = childState();
    const before = state.player.cash;
    const next = executeHireTutor(state, 'child-1');
    expect(next.player.cash).toBe(before - HIRE_TUTOR_COST);
    expect(next.player.children[0]!.tutoredThisYear).toBe(true);
  });

  it('rejects hiring a tutor twice in the same year', () => {
    const state = childState();
    const once = executeHireTutor(state, 'child-1');
    const twice = executeHireTutor(once, 'child-1');
    expect(twice).toBe(once);
  });

  it('rejects hiring for a child at or above heir-eligible age', () => {
    const state = childState();
    const grown = {
      ...state,
      player: { ...state.player, children: [{ ...state.player.children[0]!, age: 10 }] },
    };
    const next = executeHireTutor(grown, 'child-1');
    expect(next).toBe(grown);
  });

  it('rejects hiring without enough cash', () => {
    const state = childState();
    const poor = { ...state, player: { ...state.player, cash: 0 } };
    const next = executeHireTutor(poor, 'child-1');
    expect(next).toBe(poor);
  });
});

describe('growChildren', () => {
  it('advances every child by one year and resets tutoredThisYear', () => {
    const children: Child[] = [{ id: 'a', name: 'Hans', age: 5, gender: 'male', health: 100, traits: [], tutoredThisYear: true }];
    const { children: next } = growChildren(children);
    expect(next[0]!.age).toBe(6);
    expect(next[0]!.tutoredThisYear).toBe(false);
  });

  it('can roll a trait with a tutored child (boosted odds)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // below CHILD_TUTORED_TRAIT_ROLL_CHANCE (0.25)
    const children: Child[] = [{ id: 'a', name: 'Hans', age: 5, gender: 'male', health: 100, traits: [], tutoredThisYear: true }];
    const { children: next, messages } = growChildren(children);
    expect(next[0]!.traits.length).toBe(1);
    expect(messages.length).toBe(1);
    vi.restoreAllMocks();
  });

  it('does not roll traits past the max of 2', () => {
    const children: Child[] = [{ id: 'a', name: 'Hans', age: 5, gender: 'male', health: 100, traits: ['charismatic', 'penny-pincher'], tutoredThisYear: true }];
    const { children: next } = growChildren(children);
    expect(next[0]!.traits.length).toBe(2);
  });

  it('does not roll traits once heir-eligible age is reached', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const children: Child[] = [{ id: 'a', name: 'Hans', age: 9, gender: 'male', health: 100, traits: [], tutoredThisYear: true }];
    const { children: next } = growChildren(children);
    expect(next[0]!.age).toBe(10);
    expect(next[0]!.traits.length).toBe(0);
    vi.restoreAllMocks();
  });
});

describe('attemptBirth', () => {
  it('does nothing when not married', () => {
    const state = buildStartingState('TestPlayer');
    const { children, message } = attemptBirth(state);
    expect(children).toBe(state.player.children);
    expect(message).toBeNull();
  });

  it('can add a child when married, within the birth chance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    const state = executeSeekMarriage(buildStartingState('TestPlayer'));
    const { children, message } = attemptBirth(state);
    expect(children.length).toBe(1);
    expect(message).not.toBeNull();
    vi.restoreAllMocks();
  });

  it('does not add a child outside the birth chance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const state = executeSeekMarriage(buildStartingState('TestPlayer'));
    const { children } = attemptBirth(state);
    expect(children.length).toBe(0);
    vi.restoreAllMocks();
  });
});

describe('traitPurchasePriceFactor', () => {
  it('is 1 with no traits', () => {
    expect(traitPurchasePriceFactor([])).toBe(1);
  });
  it('reduces price by 5% for penny-pincher', () => {
    expect(traitPurchasePriceFactor(['penny-pincher'])).toBeCloseTo(0.95);
  });
  it('increases price by 5% for simpleton', () => {
    expect(traitPurchasePriceFactor(['simpleton'])).toBeCloseTo(1.05);
  });
  it('cancels out when both are present', () => {
    expect(traitPurchasePriceFactor(['penny-pincher', 'simpleton'])).toBeCloseTo(1);
  });
});
