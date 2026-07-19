# Design: Political Rank & Reputation Progression

**Status:** Implemented (first pass — thresholds not yet simulation-tuned, see "Open Questions")  
**Last updated:** 2026-07-18

## Purpose

The state shape already carries `PlayerState.politicalRank` (`0 | 1 | 2 | 3`, Citizen/Guild/Council/Mayor) and `PlayerState.reputation` (per-city, 0–100, seeded in `starting-config.ts`), and the game's own framing ("aims to become Mayor of Lübeck" — `CLAUDE.md` Project section) implies a milestone track toward rank 3. Neither field is read or written anywhere outside the starting config: no system advances `politicalRank`, nothing moves `reputation`, and no UI shows either. This doc scopes what a first, minimal implementation looks like.

## Goals (first pass)

- Give the player a visible, legible sense of progress toward Mayor — a number going up isn't enough; they should see *what* moves it.
- Make `reputation` a real, earned resource instead of a static starting value.
- Keep the mechanic simple enough to tune in one pass: fixed thresholds, no branching politics, no NPC rivals — that's explicitly out of scope for v1.

## Non-Goals (this pass)

- No political rivals, elections, or failure states (losing rank).
- No rank-gated gameplay unlocks (e.g. "Council members get X") — pure progress/flavor for v1, mechanical hooks are a follow-up once the base loop exists.
- No per-city political structure beyond the existing per-city `reputation` scalar.

## Mechanic

### Reputation

- Every profitable trade (sell price > this session's average buy price for that good, or simpler: every `Sell` action) nudges `reputation[cityId]` up by a small fixed amount (proposed: +1, cap 100).
- Every turn a ship in that city's port sits idle with no trade could optionally decay reputation slightly — **deferred**; adds complexity (idle-turn tracking) without a clear payoff for v1. Reputation only goes up in the first pass.
- Reputation is per-city and does not aggregate into a single "fame" score — Lübeck reputation is what actually gates the Mayor rank (see below), other cities' reputation is currently flavor/display-only, matching the starting-config's asymmetric seed (Lübeck starts at 20, others at 10).

### Rank-up thresholds

Evaluated once per turn in `turn-system.ts` (alongside the existing net-worth/calendar checks), a pure function:

```typescript
function evaluateRankUp(player: PlayerState, netWorth: number): PoliticalRank
```

Proposed thresholds (net worth is already computed every turn via `computeNetWorth` — ADR-014):

| Rank | Net worth | Lübeck reputation | Label |
|------|-----------|--------------------|-------|
| 0 → 1 | ≥ 1,500 Mark | ≥ 30 | Guild Member |
| 1 → 2 | ≥ 4,000 Mark | ≥ 50 | Council Member |
| 2 → 3 | ≥ 10,000 Mark | ≥ 75 | Mayor of Lübeck |

Both conditions must hold — net worth alone would let a player "buy" the mayoralty by hoarding cargo without ever trading meaningfully in Lübeck; reputation alone would let a low-net-worth player rank up by trading small volumes repeatedly. Numbers are a starting proposal, not tuned — needs the same kind of simulation pass ADR-015's risk normalisation got before shipping.

`evaluateRankUp` only ever returns the *current or higher* rank — no demotion path in v1 (Non-Goals).

### Turn resolution integration

`executeEndTurn` (or wherever `computeNetWorth` is already called per turn) additionally calls `evaluateRankUp` and, if the result is higher than `player.politicalRank`, updates it and adds a `TurnResult.summary` line ("You have been inducted into the Merchants' Guild!" / "...elected to the Council!" / "...elected Mayor of Lübeck!") so the milestone surfaces through the existing turn-summary overlay (see `map-view.md` "Persistent mount" for why that's now an overlay, not a full screen swap) rather than needing new UI plumbing.

### UI

- A small rank badge/label already fits next to the existing header player-info span (`{name} · Age {age} · {maritalStatus}` — see `CHANGELOG.md` "Player name, age, and marital status in the header"): extend to `{name} · Age {age} · {maritalStatus} · {rankLabel}`.
- A progress indicator (e.g. "2,340 / 4,000 Mark · 42 / 50 reputation to Council") could live in a new collapsible panel, following the same disclosure pattern already used for `showSeasonInfo`/`showSaveMenu` — deferred to implementation, not a blocker for the mechanic itself.

## Implementation Status (as of 2026-07-18)

- ✅ Reputation gain — `gainReputation()` in `political-system.ts`, wired into `executeSell` (+1 per sale in that city, capped at 100).
- ✅ Rank-up thresholds and evaluation — `evaluateRankUp()`, called once per turn in `resolveTurn` (`turn-system.ts`) alongside the existing net-worth calculation. Never demotes; both net worth and Lübeck reputation must clear a threshold.
- ✅ Turn-summary announcement — `rankUpMessage()` appended to `TurnResult.summary.events`, surfaced through the existing turn-summary overlay.
- ✅ Header badge — `{name} · Age {age} · {maritalStatus} · {rankLabel}` in `App.svelte`, using `RANK_LABELS`.
- ✅ **Reaching Mayor (or 10,000+ net worth) is a win condition, but does not end the session** — per explicit player direction, revising the earlier decision. `GameState.hasWon` latches permanently the first time either win condition fires, so the win screen appears exactly once; the player then chooses "Continue Playing →" (returns to the persistent port/map view, same as a normal turn-summary dismissal) or "Retire & Play Again" (starts a new game). Losing (bankruptcy, out of turns) is unaffected and still ends the session normally, even after a prior win.
- Note: the Mayor rank threshold's own net-worth bar (10,000) currently coincides exactly with the flat net-worth win condition, so in practice there is no scenario where Mayor is reached without net worth alone already qualifying for the win — the two conditions aren't currently distinguishable in play. Worth revisiting once thresholds are tuned (see below): either the Mayor net-worth bar should sit below 10,000 (so Mayor can be a genuinely earlier/different path to victory), or the "OR" should be simplified to just the net-worth check with Mayor left as a pure rank milestone.
- ❌ Progress indicator (partial progress toward the next rank) — deferred, not implemented; the header only shows the current rank, not how close the player is to the next one.
- ❌ Threshold numbers are a first pass, not yet simulation-tuned (see below).

## Open Questions

- Exact reputation-gain amount and rank thresholds need playtesting/simulation, not just gut numbers — same caution as ADR-015's risk-weighting bug (a plausible-looking formula produced a badly skewed real distribution until measured).
- Should a progress indicator be added, and if so where — collapsible panel (matching `showSeasonInfo`/`showSaveMenu`) vs. inline in the fleet/shipyard area?

## Related

- ADR-014 (Net worth valuation — `computeNetWorth` reused here)
- ADR-015 (Per-route & session event risk — precedent for "simulate before tuning thresholds")
- `src/game/state/types.ts` (`PoliticalRank`, `PlayerState.reputation`)
- `src/game/systems/political-system.ts` (`gainReputation`, `evaluateRankUp`, `rankUpMessage`, `RANK_LABELS`)
- `src/game/systems/turn-system.ts` (`executeSell`, `resolveTurn`)
