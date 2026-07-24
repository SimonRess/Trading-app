# ADR-022: Health-Based Mortality Replaces the Turn-Limit Lose Condition

**Date:** 2026-07-24
**Status:** Accepted
**Deciders:** Simon

## Context

`family-succession.md`'s original proposal triggered succession at a fixed age (60) and left the existing turn-limit lose condition (`calendar.turn >= calendar.maxTurns`, 40 turns) untouched. Per explicit direction, this is revised: mortality becomes a genuine per-turn risk (a tracked `health` stat that decays and can reach 0 at any point, not a scheduled age-60 event), and `maxTurns` is set high enough (999,999) to never realistically be reached — the turn counter stops being how a session ends.

This is a real shift in what "the game ending" means: previously, a session had a fixed length (40 turns) and ended in exactly one of two ways (win or run-out-of-turns/bankruptcy). Now a session has no fixed length; it ends via death (with or without an eligible heir) or a Mayor win (ADR-021), and can in principle continue indefinitely across generations.

## Decision

**`PlayerState.health` (0-100) decays every turn** by `age/10 + random(0,5) + eventModifier` (`eventModifier` reserved for future health-affecting events, always 0 for now), floored at 0. The same formula applies to every `Child` from birth, tracked independently.

**Death and succession replace the age-60 trigger:** when `player.health` reaches 0, the oldest child aged ≥10 with health > 0 becomes heir (fleet, cash, loan, and political rank carry over; reputation halves; the new player's age/gender/health/traits come from the heir). **With no eligible heir, the game is lost** — "without an heir, the trading house closes its doors."

**`maxTurns` is set to 999,999** in `starting-config.ts` — the turn-limit lose condition remains in the code (harmless, never realistically triggered) rather than being removed, avoiding a special-case deletion for a check that's now simply inert.

## Alternatives Considered

- **Keep the fixed age-60 trigger** (the original proposal) — rejected: it makes succession a scheduled, fully-predictable event rather than a genuine risk, and doesn't give a session a mortality stat with any other future hooks (illness events, combat, healing).
- **Keep the 40-turn limit alongside health-based mortality** — rejected: with mortality now a real, recurring risk across potentially several generations, a flat 40-turn cap would frequently cut a session short mid-family-line for no thematic reason. Removing the *practical* limit (not the code path) lets a session run as long as the family survives.
- **Explicit lose state for a dead child before heir-eligibility** — rejected: a child's death (tracked separately, health can also reach 0) is family attrition, not a session-ending event by itself; it only matters at the moment the *player* dies and eligible heirs are counted.

## Consequences

✅ Death is a real, unscheduled risk every turn, not a fixed deadline — more consistent with "family across generations" than a single predictable age gate
✅ No fixed session length — a game now runs until death (with or without succession) or a Mayor win
✅ `eventModifier` is already wired into the formula, so future health-affecting events (plague striking the player, storm injury) are additive, not a redesign
⚠️ Because young children decay by the same formula (age/10 term near zero, so effectively just the random(0,5) term), child mortality before reaching heir-eligible age (10) is a genuine, non-trivial risk — a family can lose all its children before any reaches heir age, at which point the *next* player death loses the game. This is accepted as an intentional part of the mortality theme, not a balance oversight, but is flagged here since it's the single biggest swing factor in whether a session continues across generations
⚠️ No healing mechanic exists yet — health only ever decreases; a future pass may add ways to slow or reverse decay (see `family-succession.md`)
🔒 Directly enables ADR-021 (Mayor-only win) making sense as a long-run goal rather than a race against a 40-turn clock

## Links

- Supersedes: the age-60 succession trigger and the 40-turn practical limit described in the original `family-succession.md` draft
- Related: ADR-021 (Mayor-only win condition)
- Related design docs: `docs/design/family-succession.md`
- Implementation: `src/game/systems/health-system.ts`, `src/game/systems/turn-system.ts` (`resolveTurn`'s health-decay and succession steps), `src/game/data/starting-config.ts` (`maxTurns: 999_999`)
