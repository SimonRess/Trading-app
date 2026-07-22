# Design: Family & Generational Succession

**Status:** Proposed — not implemented  
**Last updated:** 2026-07-20

## Purpose

The project pitch (`CLAUDE.md`) frames the game as "raises a family across generations," and `PlayerState.age` (starting at 22) has existed since the MVP without ever being read or written — nothing ages the player, and nothing happens when they get old. `PlayerState.maritalStatus` (`'single' | 'married' | 'widowed'`) was added recently for header flavor and is likewise never changed by any system. This doc scopes a first, minimal succession mechanic that gives `age` an actual endpoint and turns "generations" into something the player experiences at least once in a 40-turn game.

## Goals (first pass)

- Age visibly advances, and reaching old age has a real, player-facing consequence.
- A succession event feels like a milestone (similar treatment to the win screen from `political-rank.md` — a turn-summary overlay variant, not an abrupt mid-turn interruption), not a silent stat change.
- Some continuity across generations (net worth, ships) so the player doesn't feel punished for reaching the milestone, balanced against some cost so it isn't purely free.

## Non-Goals (this pass)

- No player-controlled marriage mechanic (proposing, choosing a spouse) — `maritalStatus` stays flavor-only in this pass, exactly as it is today. A later pass could make marriage a real, player-triggered action; not required for succession to function.
- No heir *traits* or stat variance in the succession event itself — that's now scoped as its own follow-on mechanic, see "Child Development & Traits" below, layered on top of (not required by) the base succession event.
- No player choice over *whether* to have an heir, or multiple heirs to choose between — succession is automatic and singular in v1, same spirit as political rank's "no branching politics" scope.
- No death mid-session from other causes (illness, storms) — aging is the only trigger.

## Mechanic

### Aging

- `player.age` increments by 1 once per in-game year (i.e. on the Spring→Spring calendar rollover — `advanceCalendar` already exposes exactly this transition via `calendar.year` incrementing when the season cycles back to `'spring'`).
- No UI change needed beyond what already exists — age is already shown in the header (`{name} · Age {age} · ...`).

### Succession trigger

- At age ≥ 60 (proposed — a Hanseatic merchant's working retirement age, comfortably reachable within a 40-turn/10-year game if the player starts at 22 and plays the full length, but not the *only* way to see it if a game runs long via "continue playing" after a win), the *next* turn resolution triggers succession instead of a normal turn.
- Mirrors the win-condition pattern from `political-rank.md`: a `GameState`-level flag (e.g. `pendingSuccession: boolean`, or simply detect `player.age >= 60` directly in `resolveTurn` each turn) so the check is a pure function of state, not a one-time side effect needing its own latch — unlike winning, succession *should* keep happening indefinitely (every subsequent generation eventually ages out too), so no "only once" flag is needed here.

### What carries over

Proposed inheritance rule, balancing continuity against real stakes:

| Carries over fully | Partial / reset |
|---|---|
| Fleet (all ships, cargo, durability) | Reputation per city — halved, rounded down (a new generation must re-earn full standing) |
| Cash | Age — reset to 22 (a young heir) |
| Political rank | Marital status — reset to `'single'` |

Political rank carrying over (not resetting) is the one asymmetric call worth flagging: it fits "family legacy" thematically (a Council seat is a family's standing in the city, not just one merchant's), but it does mean rank, once earned, can never meaningfully be lost — consistent with rank already being one-way (`evaluateRankUp` never demotes) but worth confirming deliberately rather than by default.

### Turn resolution integration

`resolveTurn` (`turn-system.ts`) gains a step, analogous to the political-rank step already there: check `player.age >= 60` after aging is applied; if true, replace the normal turn outcome with a succession event — new `PlayerState` (per the inheritance table above), a new heir name (reuse the existing `NEW_SHIP_NAMES`-style small fixed list pattern from `ships.ts`'s `nextShipName`, but for merchant names instead), and a `TurnSummary` message announcing it plainly ("Wulf von Lübeck has retired at 60. His heir, Hans von Lübeck, takes the helm.").

### UI

- Reuses the turn-summary overlay pattern once more (third variant alongside the normal quiet-turn summary and the win/Victory variant) — a "Generational Succession" card with the announcement and a single "Continue →" acknowledgement, no choice needed (succession isn't optional, matching the Non-Goals above).
- No new persistent UI surface needed — the header already shows name/age, which will simply reflect the new heir immediately after.

## Child Development & Traits (Proposed, v2 — layered on top of base succession)

A second-pass extension once the base succession event above exists: instead of the heir simply appearing fully-formed at age 22 the moment succession fires, the heir exists earlier as a *growing child*, and gains character traits during that growth period that carry into their playable generation.

### Goals

- Give the player a reason to engage with the family system *before* succession, not just experience it as a one-time event.
- Traits should meaningfully differentiate a generation's playstyle (e.g. a trade-focused trait vs. a sailing-focused trait) without being so strong they invalidate the base game's balance — an heir is a variation, not a difficulty toggle.
- The "hired teacher" hook makes trait quality a spendable-cash decision, consistent with every other economic sink in the game (ship repair, church donations, warehouses) rather than a pure random roll the player has no say in.

### Mechanic

- Once `maritalStatus === 'married'` (itself still gated on the marriage mechanic being real — currently flavor-only per this doc's own Non-Goals above, so this whole section is blocked on that landing first, whether here or as a separate small feature), a child entity begins "growing up" over a fixed number of turns (proposed: 8 turns, i.e. roughly the same order of magnitude as a ship's travel times, not a multi-generation wait).
- Each turn the child is growing, the player may optionally pay to hire a teacher for that turn (proposed: a flat per-turn cost, no long-term contract) — hiring improves the odds of gaining a *positive* trait roll that turn; not hiring still allows a trait roll, just at lower quality/probability, so skipping teachers is a valid (cheaper, riskier) strategy rather than a trap.
- Each growth turn has a chance to roll a trait from a small fixed pool (proposed starting set, mirroring the game's own economic axes: **Shrewd Trader** — better prices; **Bold Navigator** — reduced travel time or storm risk; **Popular** — faster reputation gain; **Frugal** — reduced ship repair/upkeep cost). A child can end up with 0–2 traits by the time growth completes; more than 2 kept out of scope to avoid stacking into an overpowered heir.
- When succession (the base mechanic above) actually fires, the *most recently grown* child becomes the heir and their traits apply to the new `PlayerState` for that generation. If growth hasn't completed by the time succession fires (a young child, old parent), the heir simply has fewer/no traits — no blocking of succession, traits are a bonus not a requirement.

### Non-Goals (this sub-feature)

- No multiple concurrent children / choosing between them — one child growing at a time, same "no branching" spirit as the base mechanic.
- No negative traits — this is meant to add variety and reward engagement, not introduce a way to end up with a strictly worse heir than doing nothing.
- No teacher *characters* (named NPCs, portraits) — "optionally hired teacher" is a cash-cost toggle in this pass, not a hiring/roster system.

## Open Questions

- Is age 60 the right threshold, or should it scale with `calendar.maxTurns` so succession reliably happens at least once in a standard game without needing the player to "continue playing" past a win first? Needs the same kind of simulation check ADR-015 and `political-rank.md` both flag before trusting a number.
- Should political rank really carry over unmodified, or partially reset (e.g. drop one rank) to give each generation a real climb? Flagged above as a deliberate but unconfirmed call.
- Multiple ongoing successions in one session (if the game runs long via "continue playing" after a win) — does the mechanic hold up cleanly across 2-3 generations, or does something (e.g. heir naming running out of the fixed name list) need attention?
- Child Development depends on marriage becoming a real, non-flavor mechanic first (see that section's own gating note) — sequencing question: is marriage its own small v1.1/v2 feature, or the first step of implementing this section?
- Trait pool, hire-teacher cost, and growth-turn count are all placeholder numbers pending simulation/tuning, same as every other numeric proposal in this project's docs.

## Related

- `docs/design/political-rank.md` (precedent for a milestone-as-turn-summary-overlay-variant, and for the "confirm win-condition semantics explicitly rather than assuming" lesson from that feature's own back-and-forth)
- `src/game/state/types.ts` (`PlayerState.age`, `MaritalStatus` — already defined, still not read by any system prior to this proposal)
- `src/game/systems/calendar-system.ts` (`advanceCalendar` — the year-rollover this hooks into)
- `src/game/data/ships.ts` (`nextShipName` — precedent pattern for a small fixed name list)
