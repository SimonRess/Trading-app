# Design: Banking & Loans

**Status:** Proposed — not implemented  
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

## Open Questions

- Does `computeNetWorth` (ADR-014) need to subtract outstanding loan principal? Almost certainly yes — otherwise a loan looks like free cash forever in the player's own net-worth readout, which defeats the point of it being a liability. This is a genuine change to an already-`Accepted` ADR's formula and should be captured as an ADR-014 amendment (or a new small ADR) when this feature is actually built, not silently folded in.
- Loan cap (2,000 Mark) and interest rate (5%/turn) are placeholder numbers needing simulation against the existing 500 Mark starting cash / 10,000 Mark win threshold — same caveat as every other numeric proposal.
- Should there be a maximum number of turns before a loan auto-defaults (some harsher consequence beyond "your net worth keeps dropping"), or is compounding interest alone sufficient pressure? Leaning toward "compounding alone is enough" for a first pass, to avoid a second failure-state mechanic on top of the existing bankruptcy check.

## Related

- ADR-014 (Net worth valuation — this doc proposes an amendment: net worth should subtract outstanding loan principal)
- `docs/design/mvp-scope.md` (banking & loans listed as v1.1 target)
- `docs/design/insurance.md` (sibling financial-mechanic proposal; consider whether the two share a UI section, e.g. a "Bank" panel with both loan and insurance controls, rather than two separate port-view sections)
