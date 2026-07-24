# ADR-019: Net Worth Subtracts Outstanding Loan Principal

**Date:** 2026-07-23
**Status:** Accepted
**Deciders:** Simon

## Context

ADR-014 defined net worth as `cash + ship value + cargo value`, with no notion of debt — there was no way to owe money at the time. Banking & loans (`docs/design/banking-loans.md`) introduces exactly that: a player can borrow up to 2,000 Mark, added directly to `player.cash`.

If net worth were left as ADR-014 defined it, taking a loan would look identical to earning cash through trade — the headline wealth number the player is judged by (win at 10,000+, lose at ≤0) would go *up* the moment a loan is taken, with no accounting for the fact that it must eventually be repaid with compounding interest. That defeats the entire point of a loan being a risk/reward lever rather than free money, and directly contradicts `banking-loans.md`'s stated goal: "a genuine trade-off: faster capital now, guaranteed cost later."

## Decision

**Net worth subtracts outstanding loan principal:**

```
net_worth = cash
          + Σ ships   ( purchase_price × durability / 100 )
          + Σ cargo   ( base_price × quantity )
          - loan
```

This amends ADR-014's formula with one additional term; the cash/ship/cargo valuation ADR-014 decided is unchanged. A player who borrows the full 2,000 Mark cap sees no immediate change in net worth (cash goes up by exactly what the liability goes up by) — the loan only becomes a real cost once interest starts compounding (`accrueLoanInterest`, `banking-system.ts`), which erodes net worth turn over turn until repaid. This is also what drives an unpaid, snowballing loan into the existing bankruptcy lose condition (net worth ≤ 0), rather than requiring a separate "foreclosure" failure state.

## Alternatives Considered

- **Leave net worth as cash + ship + cargo only, don't touch it** — rejected: a loan would read as free money in the player's own wealth readout, undermining the "guaranteed cost later" design goal from the very first turn.
- **Track loan as a separate UI stat, not folded into net worth at all** — rejected: net worth is the single number the player is judged by (win/lose conditions); a debt that doesn't appear in the number that decides those outcomes could be exploited to sit right under the loss threshold while looking richer than reality.

## Consequences

✅ A loan is a real liability from the moment it's taken, not just once interest starts compounding
✅ An unpaid, compounding loan naturally drives net worth toward (and below) zero, reusing the existing bankruptcy check instead of a new failure state
✅ No new save-file schema version — `PlayerState.loan` is an additive field (see `save-file-schema.md`)
⚠️ A player watching only the net-worth number won't see *why* it's lower without also checking the Counting House — the UI surfaces outstanding loan and its interest rate directly in that building to mitigate this

## Links

- Amends: ADR-014 (Net-worth valuation) — adds a loan-liability term to its formula; ADR-014's cash/ship/cargo valuation decision itself is unchanged and remains in force
- Related: ADR-018 (Feature delivery sequencing — banking & loans ships with the Counting House building)
- Related design docs: `docs/design/banking-loans.md`, `docs/design/save-file-schema.md`
- Implementation: `src/game/systems/turn-system.ts` (`computeNetWorth`), `src/game/systems/banking-system.ts`
