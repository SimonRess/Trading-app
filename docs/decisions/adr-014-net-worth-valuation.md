# ADR-014: Net-Worth Valuation

**Date:** 2026-07-16  
**Status:** Accepted  
**Deciders:** Simon

## Context

Net worth is the single number the game judges the player by: the win condition is a net-worth threshold (10,000 Mark) and the lose condition is net worth reaching zero (see `docs/design/mvp-scope.md`). It is displayed every turn next to cash as "Net".

Net worth is the sum of three things: cash, the value of every ship, and the value of all cargo currently held. Ship value was already defined (`purchase_price × durability / 100`, ADR/`ship-stats.md`). Cargo value was not pinned down, and the first implementation valued cargo at the **current local market price** of the port the ship was sitting in (mark-to-market).

That choice produced a surprising, undesirable behaviour reported during playtesting: net worth drifted upward every turn while merely **holding** cargo, without any trade. The cause is the market simulation — a city that consumes a good but does not produce it depletes its local supply each turn, which raises that good's local price, which inflated the paper value of the held cargo. Holding 10 furs in Lübeck moved net worth from ~1,020 to ~1,090 over 8 turns with cash frozen.

Two problems follow from this:
1. **Confusing:** the headline wealth number changes when the player did nothing.
2. **Exploitable:** the win condition could be reached by hoarding cargo in a hungry city rather than by trading — directly contradicting the MVP's core loop of "buy low, sail, sell high" (`mvp-scope.md`).

## Decision

**Value held cargo at each good's fixed base price** (`GOODS[goodId].basePrice`) when computing net worth, not at the fluctuating local market price.

```
net_worth = cash
          + Σ ships   ( purchase_price × durability / 100 )
          + Σ cargo   ( base_price × quantity )
```

Consequently, net worth only changes on events that represent a real change in wealth: a completed trade (cash moves), ship damage (ship value drops), or cargo lost to pirates/wrecks (cargo drops). Simply holding goods across turns leaves net worth unchanged.

## Alternatives Considered

- **Mark-to-market at local price** (the original implementation) — most "realistic" in that it reflects what the cargo could be sold for right now. Rejected: it makes the headline number drift while idle and lets the player win by hoarding, both of which undermine the trade loop and confuse the player.

- **Cost-basis valuation** (value cargo at what the player actually paid) — arguably the most economically honest ("unrealised P&L is zero until you sell"). Rejected for MVP because it requires tracking a purchase price per cargo lot in the save schema, adding state and complexity that the MVP does not need.

- **Exclude cargo from net worth entirely** (`cash + ship value` only, matching the literal wording of the `mvp-scope.md` lose condition) — simplest, and removes drift completely. Rejected because a hold full of valuable goods would count as zero wealth, which is its own kind of confusing and makes the number feel disconnected from what the player owns.

- **Base-price valuation** (chosen) — cargo counts toward wealth at a stable, understandable reference value; no per-turn drift; no hoarding exploit; no extra save state. A minor quirk remains (buying below/above base nudges net worth at the moment of purchase), judged acceptable for MVP.

## Consequences

✅ Net worth is stable while idle — it only moves on realised trades, ship damage, or cargo loss  
✅ The win condition can no longer be reached by hoarding; it rewards actual trading  
✅ No new state in the save file — base price is static data (`goods.ts`)  
✅ Deterministic and trivially unit-testable (a "no drift while holding" test guards it)  
⚠️  Net worth no longer reflects the *realisable* value of cargo at the current port — a hold of furs bound for a high-price market is valued at base, not at the price it will fetch  
⚠️  Buying a good below or above its base price shifts net worth slightly at the moment of purchase  
🔒  Net worth includes cargo (at base price); this supersedes the narrower "cash + ship value" wording in `mvp-scope.md`, which is updated to match

## Links

- Supersedes: —  
- Amended by: ADR-019 (Net worth subtracts outstanding loan principal) — the cash/ship/cargo formula decided here is unchanged; ADR-019 adds a `- loan` term once banking & loans shipped  
- Superseded by: —  
- Related ADRs: ADR-009 (Market price formula — the supply/price mechanic that caused the drift), ADR-004 (Architecture — `computeNetWorth` is a pure function on `GameState`)  
- Related design docs: docs/design/mvp-scope.md (win/lose conditions), docs/design/ship-stats.md (ship value component), docs/design/market-formula.md (base prices)  
- Implementation: `src/game/systems/turn-system.ts` (`computeNetWorth`); test in `src/game/systems/turn-system.test.ts`
