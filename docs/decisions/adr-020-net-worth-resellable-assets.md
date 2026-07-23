# ADR-020: Net Worth Includes Cannon and Warehouse Resale Value

**Date:** 2026-07-23
**Status:** Accepted
**Deciders:** Simon

## Context

Two new asset classes shipped together: cannons (`docs/design/ship-stats.md` "Buying & Selling Cannons") and warehouses (`docs/design/warehouses.md`). Both are bought outright and can be sold back for a partial refund — a cannon refunds 60% of its purchase price, a warehouse 70%. Neither was folded into `computeNetWorth` (ADR-014) when first designed; `warehouses.md` explicitly flagged this as an open item ("warehouse value will need folding into `computeNetWorth` once implemented"), and `ship-stats.md`'s cannon proposal didn't address it at all.

Leaving them out entirely would make net worth understate real wealth — spending 1,000 Mark on a warehouse or 150 Mark on a cannon would look identical to burning the cash, even though the player still holds a resellable asset worth most of that. Since net worth is the single number that decides win/lose, that mismatch would make trading for these assets look like a pure loss right up until the numbers are checked by hand.

## Decision

**Net worth values both cannons and warehouses at their resale value, not their purchase price** — the same "what would liquidating this actually get you" principle ADR-019 already applied to loans (a liability at face value) and that `shipNetWorth` already applies to ships (purchase price scaled by durability, not a flat full price):

```
net_worth = cash
          + Σ ships     ( purchase_price × durability / 100 )
          + Σ cargo     ( base_price × quantity )
          + Σ cannons   ( CANNON_PRICE × CANNON_SELL_FRACTION )
          + Σ warehouses ( WAREHOUSE_PRICE × WAREHOUSE_SELL_FRACTION )
          - loan
```

Buying either asset therefore reduces net worth by the resale friction alone (a cannon costs 150, contributes 90 — a 60 Mark "cost of the trade"), rather than by the full purchase price. This keeps both purchases feeling like genuine trades (asset for cash, at a fair-but-not-free exchange rate) instead of either a pure loss (ignoring resale value) or free money (counting full price).

## Alternatives Considered

- **Exclude both from net worth** — simplest, but understates wealth and makes every cannon/warehouse purchase look like burning cash in the player's own win/lose-deciding number, which is actively misleading.
- **Count at full purchase price** — overstates wealth (a cannon or warehouse can never actually be turned back into its full purchase price), and is inconsistent with how ships are already valued (`shipNetWorth` never uses full price either).
- **Resale value (chosen)** — consistent with the existing ship-valuation precedent and with ADR-019's "value liabilities/assets at what they're actually worth" framing; the small amount of purchase friction is the same "no risk-free way to park cash" property `warehouses.md` explicitly designed for.

## Consequences

✅ Buying a cannon or warehouse is a real trade (small resale friction), not a headline-number-crushing loss nor free money
✅ Consistent with ADR-019 and the existing ship-valuation approach — one "liquidation value" principle applied uniformly across every asset class
✅ No new save-file schema version — `Ship.cannons` and `GameState.warehouses` are both additive fields
⚠️ A player who buys many warehouses/cannons purely to inflate net worth right before the win threshold could nudge across it slightly cheaper than pure cash accumulation would require — judged acceptable, same "small quirk, not an exploit" spirit as ADR-014's own note about buying cargo below base price

## Links

- Amends: ADR-014 (Net-worth valuation), alongside ADR-019 (loan liability) — together these are the full set of net-worth amendments once banking, cannons, and warehouses all exist
- Related: ADR-018 (Feature delivery sequencing)
- Related design docs: `docs/design/ship-stats.md` (cannons), `docs/design/warehouses.md`
- Implementation: `src/game/systems/turn-system.ts` (`computeNetWorth`)
