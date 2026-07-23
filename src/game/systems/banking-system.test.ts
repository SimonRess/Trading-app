import { describe, it, expect } from 'vitest';
import { buildStartingState } from '../data/starting-config.ts';
import { executeTakeLoan, executeRepayLoan, accrueLoanInterest, LOAN_CAP } from './banking-system.ts';

describe('executeTakeLoan', () => {
  it('adds the amount to cash and records the principal', () => {
    const state = buildStartingState('TestPlayer');
    const beforeCash = state.player.cash;
    const next = executeTakeLoan(state, 500);
    expect(next.player.cash).toBe(beforeCash + 500);
    expect(next.player.loan).toBe(500);
  });

  it('rejects a second loan while one is already active', () => {
    const state = buildStartingState('TestPlayer');
    const withLoan = executeTakeLoan(state, 500);
    const next = executeTakeLoan(withLoan, 200);
    expect(next).toBe(withLoan);
  });

  it('rejects borrowing beyond the loan cap', () => {
    const state = buildStartingState('TestPlayer');
    const next = executeTakeLoan(state, LOAN_CAP + 1);
    expect(next).toBe(state);
  });

  it('rejects a non-positive amount', () => {
    const state = buildStartingState('TestPlayer');
    expect(executeTakeLoan(state, 0)).toBe(state);
    expect(executeTakeLoan(state, -100)).toBe(state);
  });

  it('does not mutate the input state', () => {
    const state = buildStartingState('TestPlayer');
    const before = JSON.parse(JSON.stringify(state)) as typeof state;
    executeTakeLoan(state, 500);
    expect(state).toEqual(before);
  });
});

describe('executeRepayLoan', () => {
  it('reduces principal and deducts cash', () => {
    const state = executeTakeLoan(buildStartingState('TestPlayer'), 500);
    const beforeCash = state.player.cash;
    const next = executeRepayLoan(state, 200);
    expect(next.player.loan).toBe(300);
    expect(next.player.cash).toBe(beforeCash - 200);
  });

  it('clears the loan to 0 when repaid in full', () => {
    const state = executeTakeLoan(buildStartingState('TestPlayer'), 500);
    const next = executeRepayLoan(state, 500);
    expect(next.player.loan).toBe(0);
  });

  it('caps repayment at the outstanding principal', () => {
    const state = executeTakeLoan(buildStartingState('TestPlayer'), 500);
    const rich = { ...state, player: { ...state.player, cash: 10_000 } };
    const next = executeRepayLoan(rich, 2_000);
    expect(next.player.loan).toBe(0);
    expect(next.player.cash).toBe(10_000 - 500);
  });

  it('caps repayment at available cash', () => {
    const state = executeTakeLoan(buildStartingState('TestPlayer'), 500);
    const poor = { ...state, player: { ...state.player, cash: 50 } };
    const next = executeRepayLoan(poor, 500);
    expect(next.player.cash).toBe(0);
    expect(next.player.loan).toBe(450);
  });

  it('rejects repaying when there is no active loan', () => {
    const state = buildStartingState('TestPlayer');
    const next = executeRepayLoan(state, 100);
    expect(next).toBe(state);
  });

  it('rejects a non-positive amount', () => {
    const state = executeTakeLoan(buildStartingState('TestPlayer'), 500);
    expect(executeRepayLoan(state, 0)).toBe(state);
    expect(executeRepayLoan(state, -50)).toBe(state);
  });
});

describe('accrueLoanInterest', () => {
  it('does nothing without an active loan', () => {
    const state = buildStartingState('TestPlayer');
    const result = accrueLoanInterest(state.player);
    expect(result.player).toBe(state.player);
    expect(result.interestCharged).toBe(0);
  });

  it('compounds principal by 5% per turn', () => {
    const state = executeTakeLoan(buildStartingState('TestPlayer'), 1_000);
    const result = accrueLoanInterest(state.player);
    expect(result.interestCharged).toBe(50);
    expect(result.player.loan).toBe(1_050);
  });

  it('compounds across repeated calls', () => {
    const state = executeTakeLoan(buildStartingState('TestPlayer'), 1_000);
    let { player } = accrueLoanInterest(state.player);
    expect(player.loan).toBe(1_050);
    ({ player } = accrueLoanInterest(player));
    expect(player.loan).toBe(1_103); // 1050 * 1.05 = 1102.5, rounded
  });
});
