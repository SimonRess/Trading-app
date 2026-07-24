# ADR-021: Win Condition Is Reaching Mayor of Lübeck Only

**Date:** 2026-07-24
**Status:** Accepted
**Deciders:** Simon

## Context

Since ADR-016, the win condition has been `net worth >= 10,000 OR political rank === Mayor`. `political-rank.md` itself flagged that these two conditions almost always coincide in practice — the Mayor threshold's own net-worth bar is 10,000, so reaching Mayor rank already requires clearing the flat net-worth win independently, and net worth alone (without the 75-reputation-in-Lübeck requirement) could win the game without ever having engaged with the political-rank system at all.

Per explicit direction: the win condition should be becoming Mayor of Lübeck specifically — the game's own stated aim (`CLAUDE.md`: "aims to become Mayor of Lübeck") — not net worth as an independent, parallel path.

## Decision

**The win condition is `politicalRank === 3` (Mayor) only.** The `netWorth >= 10,000` OR-branch is removed from `resolveTurn`'s win check. The Mayor rank's own thresholds (10,000 net worth AND 75 Lübeck reputation — `political-rank.md`) are unchanged, so reaching 10,000 Mark alone no longer wins by itself; the player must also have earned real standing in Lübeck.

```typescript
// Before (ADR-016):
const qualifiesForWin = netWorth >= 10_000 || player.politicalRank === 3;

// After (ADR-021):
const qualifiesForWin = player.politicalRank === 3;
```

The rest of ADR-016's framing is unchanged: winning still doesn't end the session (`hasWon` latches once, the player can continue playing), and losing conditions are independent and still apply after a win.

## Alternatives Considered

- **Leave both conditions** — rejected: it's the exact redundancy `political-rank.md` already flagged as a problem, and lets net worth alone stand in for "becoming Mayor" when the game's own framing says otherwise.
- **Lower the Mayor net-worth threshold below 10,000** so it's reachable via a genuinely different path than the flat win — considered as part of the original proposal, but explicitly rejected: the threshold stays at 10,000 (unchanged number), and the OR-condition is removed instead. Simpler, and keeps the numbers players have already seen consistent.

## Consequences

✅ The win condition now matches the game's own stated goal exactly — becoming Mayor, not just accumulating wealth
✅ No new state or schema changes — purely a comparison change in `resolveTurn`
⚠️ A player who only trades and never engages with reputation/political-rank mechanics can no longer win, even at very high net worth — this is the deliberate intent of the change, not a side effect
🔒 Interacts with ADR-022 (mortality & succession, docs/design/family-succession.md) — with `maxTurns` now effectively unbounded, Mayor and death (with or without an heir) are the primary ways a session now concludes, rather than a turn counter

## Links

- Supersedes: the win-condition OR-clause from ADR-016 (Political rank mechanic & continuable win condition) — ADR-016's other decisions (continuable win, `hasWon` latch) are unchanged and remain in force
- Related: `docs/design/political-rank.md` (rank thresholds, unchanged)
- Related: ADR-022 (Health-based mortality & succession — `docs/design/family-succession.md`)
- Implementation: `src/game/systems/turn-system.ts` (`resolveTurn`'s win/lose check)
