# Design: Banking & Loans

**Status:** Implemented (first pass — thresholds not yet tuned)  
**Target version:** v1.1

## Purpose

Currently the only way to get cash is trading (and soon, per other proposals, church donations only ever cost cash, never provide it). A loan gives the player a deliberate risk lever — borrow to buy a second ship earlier than organic trade profit would allow, at the cost of ongoing interest — which is a classic trading-game tension the MVP doesn't have at all yet.

## Goals (first pass)

- A genuine trade-off: faster capital now, guaranteed cost later. Not a free source of cash.
- Simple enough to explain in one sentence and one number (principal, interest rate) — no amortization schedules or credit-score-style mechanics.
- Interacts sensibly with the existing lose condition (bankruptcy at net worth ≤ 0) rather than needing its own separate failure state.

## Non-Goals (this pass)

- No multiple concurrent loans, no loan shopping between different lenders/cities with different rates — one loan facility, available everywhere (Lübeck being the political/economic home base is already reflected in reputation seeding; it doesn't need to also gate banking).
- No credit rating / political-rank-gated loan size in this pass — keeping the systems decoupled for now; a later pass could tie loan limits to `politicalRank` once both systems exist and the interaction can be considered deliberately, not accidentally.
- No loan forgiveness/negotiation mechanic — a loan is repaid on schedule or the player defaults; no player-facing negotiation UI.

## Mechanic

- New `PlayerState.loan: { principal: number; interestRate: number } | null` (or a single `Record`-shaped field; null/absent = no active loan).
- Taking a loan is an action available from any port (not shipyard-restricted): borrow a fixed amount (proposed: up to 2,000 Mark, one active loan at a time — no stacking), added directly to `player.cash`.
- Each turn, `resolveTurn` adds `principal × interestRate` (proposed rate: 5% per turn — deliberately steep relative to real-world banking, since a turn represents a season, and steep interest is what makes the loan a real risk/reward lever rather than free money) to the outstanding principal, compounding — a new step in turn resolution, same pattern as every other per-turn financial effect already added (political rank, and the proposed warehouse income/crew wages).
- Repayment: any amount up to the outstanding balance, from any port, reducing principal directly; paying to exactly zero clears `player.loan` back to `null`.
- **Interaction with bankruptcy:** the existing lose condition (`netWorth <= 0`) already accounts for cash — if `computeNetWorth` includes the loan as a negative liability (see Open Questions), an unpaid, compounding loan is what actually drives a player into the existing lose condition, rather than needing a new "loan foreclosure" failure state of its own.

## Implementation Status (as of 2026-07-23)

- ✅ `PlayerState.loan: number` (0 = no active loan; additive save-file field, no schema bump — `save-system.ts` defaults missing values to 0). Simpler than the originally proposed `{ principal, interestRate } | null` shape since only one flat rate exists — no need to store the rate per loan.
- ✅ `executeTakeLoan`/`executeRepayLoan` (`banking-system.ts`) and the `TAKE_LOAN`/`REPAY_LOAN` actions, available from any port (not shipyard-restricted) via the Counting House building. Borrowing caps at 2,000 Mark, one active loan at a time (a second `TAKE_LOAN` while one is outstanding is rejected). Repayment caps at both the outstanding balance and current cash.
- ✅ `accrueLoanInterest` (`banking-system.ts`), called once per turn from `resolveTurn`: 5% compounding interest on the outstanding principal, reported in the turn summary ("N Mark in loan interest accrued").
- ✅ `computeNetWorth` subtracts outstanding loan principal — see ADR-019, which amends ADR-014's formula.
- ✅ Counting House building panel: outstanding balance + interest rate readout and a Repay control when a loan is active, or a Borrow control and the loan cap/rate when not.
- ✅ Unit tests (`banking-system.test.ts`, plus `turn-system.test.ts`/`ships.test.ts` additions): take/repay cash and principal accounting, one-loan-at-a-time and cap rejections, repayment capped at balance/cash, compounding interest across repeated turns, `computeNetWorth`'s loan subtraction.
- ✅ Verified live: borrowing 500 Mark added it to cash immediately; ending a turn compounded it to 525 Mark with the turn summary reporting "25 Mark in loan interest accrued"; repaying 300 Mark reduced the balance to 225 and deducted cash correctly.

## Open Questions

- Loan cap (2,000 Mark) and interest rate (5%/turn) are still placeholder numbers, not simulation-tuned against the 500 Mark starting cash / 10,000 Mark win threshold — same caveat as every other numeric proposal in this doc set.
- Should there be a maximum number of turns before a loan auto-defaults (some harsher consequence beyond "your net worth keeps dropping"), or is compounding interest alone sufficient pressure? Still leaning toward "compounding alone is enough" — no second failure-state mechanic has been added on top of the existing bankruptcy check.

## Related

- ADR-018 (Feature delivery sequencing — this mechanic ships with the Counting House building, gated on the city-view skeleton)
- ADR-019 (Net worth subtracts outstanding loan principal — amends ADR-014)
- `docs/design/mvp-scope.md` (banking & loans listed as v1.1 target)
- `docs/design/insurance.md` (sibling financial-mechanic proposal; still worth considering whether the two eventually share a UI section within the Counting House)
