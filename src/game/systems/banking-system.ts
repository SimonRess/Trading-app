import type { GameState, PlayerState } from '../state/types.ts';

export const LOAN_CAP = 2_000;
export const LOAN_INTEREST_RATE = 0.05;

export function executeTakeLoan(state: GameState, amount: number): GameState {
  if (!Number.isFinite(amount) || amount <= 0) return state;
  if (state.player.loan > 0) return state; // one active loan at a time — no stacking
  if (amount > LOAN_CAP) return state;

  return {
    ...state,
    player: { ...state.player, cash: state.player.cash + amount, loan: amount },
  };
}

export function executeRepayLoan(state: GameState, amount: number): GameState {
  if (!Number.isFinite(amount) || amount <= 0) return state;
  if (state.player.loan <= 0) return state;

  const effectiveAmount = Math.min(amount, state.player.loan, state.player.cash);
  if (effectiveAmount <= 0) return state;

  return {
    ...state,
    player: {
      ...state.player,
      cash: state.player.cash - effectiveAmount,
      loan: state.player.loan - effectiveAmount,
    },
  };
}

export interface LoanInterestResult {
  player: PlayerState;
  interestCharged: number;
}

// Compounding interest, applied once per turn (see resolveTurn) — the
// existing bankruptcy check (net worth <= 0) is what actually punishes an
// unpaid, compounding loan, rather than a separate "foreclosure" mechanic.
export function accrueLoanInterest(player: PlayerState): LoanInterestResult {
  if (player.loan <= 0) return { player, interestCharged: 0 };

  const interest = Math.round(player.loan * LOAN_INTEREST_RATE);
  return { player: { ...player, loan: player.loan + interest }, interestCharged: interest };
}
