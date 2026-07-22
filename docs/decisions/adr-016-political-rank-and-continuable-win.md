# ADR-016: Political Rank Mechanic & Continuable Win Condition

**Date:** 2026-07-20  
**Status:** Accepted  
**Deciders:** Simon

## Context

`PlayerState.politicalRank` and `PlayerState.reputation` had existed in the state shape, unused, since early in the project — no system read or wrote either field, despite the project's own pitch (`CLAUDE.md`) describing the goal as becoming "Mayor of Lübeck." Implementing the mechanic required deciding two coupled questions:

1. **What actually promotes the player**, given two existing-but-idle numbers (net worth, already computed every turn via `computeNetWorth`; and per-city reputation)?
2. **What happens when the player reaches the top rank (Mayor)?** This interacts directly with the MVP's existing win condition (`mvp-scope.md`: net worth ≥ 10,000 within 40 turns → win), which already ends the session outright via a `game-over` screen.

Question 2 was answered twice, in opposite directions, within the same short span of work — worth recording precisely because of that reversal, not despite it. The first pass (implemented in PR #14) deliberately decided reaching Mayor would **not** be a win condition, reasoning that a milestone shouldn't force a screen the player didn't ask for. The very next session, the user explicitly reversed this: Mayor **should** be a win condition, but the player must be able to keep playing afterward — which is a meaningfully different requirement from the MVP's original all-or-nothing win/lose design, since "you won, but you can also keep going" isn't a state the existing `screen === 'game-over'` branch was built to express.

## Decision

**Reputation and net worth are both required for rank-up (never demotes); reaching the Mayor rank is one of two ways to satisfy the game's win condition; and winning no longer ends the session — it fires once, then the player continues.**

### Rank-up mechanic

- `evaluateRankUp(player, netWorth)` (`political-system.ts`) requires **both** net worth and Lübeck reputation to clear a rank's threshold (1,500/30 → Guild, 4,000/50 → Council, 10,000/75 → Mayor). Never demotes once achieved.
- Reputation gains +1 per sale in that city (`gainReputation`, wired into `executeSell`), capped at 100. No decay in this pass.

### Win condition, revised

- `resolveTurn` treats `netWorth >= 10_000` and `politicalRank === 3` (Mayor) as two paths to the same `'win'` outcome — either is sufficient, not additive.
- `GameState.hasWon: boolean` latches permanently the first time either path fires. Once true, `resolveTurn` never emits `'win'` again for that save, even though the qualifying condition (high net worth, Mayor rank) typically remains true on every subsequent turn. Losing conditions (bankruptcy, out of turns) are unaffected and still apply even after a prior win — winning doesn't grant immunity to going bankrupt afterward.
- The one-time win is presented as a "Victory!" variant of the persistent turn-summary overlay (not the separate `game-over` screen), with two choices: **Continue Playing** (returns to the still-mounted port/map view, exactly like dismissing a normal turn summary) or **Retire & Play Again** (starts a new game). `game-over` is now reserved exclusively for losses.

## Alternatives Considered

- **Reputation alone gates rank-up.** Rejected: a player could rank up via many trivial trades with no real capital behind them, which reads as gaming the reputation counter rather than earning standing.
- **Net worth alone gates rank-up.** Rejected: a player could "buy" the mayoralty by hoarding cargo/cash without ever meaningfully trading in Lübeck specifically, which severs the rank from the city it's supposed to represent.
- **Mayor rank as a pure milestone, no win-condition interaction at all** (the first-pass decision, PR #14). Reversed at explicit user direction. Recorded here rather than silently overwritten because it's a legitimate design position (a milestone doesn't have to be an ending) — the reversal is a preference call, not a bug being fixed.
- **Keep winning as session-ending, add a "New Game+" instead.** Considered as an alternative way to let good play continue past a win. Rejected: New Game+ implies carrying something forward into a *fresh* game (a bigger feature, and one that would collide with the family-succession proposal's own "what carries over" question — see `docs/design/family-succession.md`); "continue this same game" is simpler and was what was actually requested.
- **A separate "you won" screen with its own Continue button**, distinct from the turn-summary overlay. Rejected: would have reintroduced the exact bug the turn-summary-as-overlay fix solved (routing through a separate `{:else if}` screen branch unmounts `<MapView>`, destroying `MapScene` and breaking the ship-movement animation for that turn — see ADR-017). Reusing the existing overlay avoids a second, parallel "screen that isn't really game-over" code path.
- **No `hasWon` latch — just let `'win'` fire every turn the condition holds.** Rejected: would re-show the Victory overlay every single turn after the first win for as long as net worth stays high, which is a real regression in feel, not just a cosmetic annoyance (dismissing the same "you won" screen every turn while trying to keep playing).

## Consequences

✅ Net worth and reputation both matter for rank-up — no single-stat gaming of the mechanic  
✅ Winning is now something a long session can survive and build past, matching "continue playing" as an explicit request rather than the MVP's original hard win/lose binary  
✅ Losing is unaffected and still final — asymmetric on purpose (a win is a celebration to build on; a loss is still a loss)  
✅ Reuses the turn-summary overlay pattern instead of adding a second, parallel screen-unmount code path  
⚠️ The Mayor rank's own net-worth bar (10,000) currently equals the flat net-worth win threshold exactly, so in practice there is no play sequence where Mayor is reached *without* net worth alone already qualifying — the two win paths aren't currently distinguishable in play. Flagged in `docs/design/political-rank.md`'s Open Questions as something to revisit once thresholds are tuned; not fixed here to avoid changing balance numbers inside an ADR about mechanic shape.  
🔒 `GameState.hasWon` is a new field — additive to the save schema, no version bump (`save-file-schema.md`), consistent with how `maritalStatus` was added earlier.  
🔒 Any future win-condition-adjacent feature (e.g. family succession's own eventual interaction with a multi-generation win) should check `hasWon` semantics rather than re-deriving "has the player already won" from raw net worth/rank each time.

## Links

- Supersedes: the first-pass decision in PR #14 ("Mayor rank does not end the game") — not a separate ADR, since that decision was never itself recorded as one; recorded here instead as the "Alternatives Considered" entry it now is.
- Related ADRs: ADR-014 (Net worth valuation — the other half of the win condition), ADR-017 (Ship-animation lifecycle — the overlay-vs-screen pattern this decision reuses)
- Related design docs: docs/design/political-rank.md (full mechanic detail, thresholds, Open Questions), docs/design/mvp-scope.md (original win/lose condition definition), docs/design/save-file-schema.md (`hasWon` additive field)
