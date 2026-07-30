# Design: Family & Generational Succession

**Status:** Implemented (first pass — thresholds not yet tuned; see "Implementation Status" below for what changed from the original draft)  
**Last updated:** 2026-07-24

## Implementation Status (as of 2026-07-24)

Implemented with substantial revisions from the original draft below (kept for historical context — read this section first, since several numbers/mechanisms it describes were superseded before implementation):

- ✅ **Mortality is health-based, not a fixed age-60 trigger** (ADR-022). `PlayerState.health` (0-100) decays every turn by `age/40 + random(0,0.5) + eventModifier` (`eventModifier` always 0 for now, reserved for future health-affecting events; rate reduced 2026-07-25 from `age/10 + random(0,5)` — the original rate made child mortality before heir-eligible age near-certain). The same formula applies to every `Child`, tracked from birth. Death happens the turn health reaches 0, not at a scheduled age.
- ✅ **The player chooses the heir when more than one child is eligible** (revised 2026-07-24, resolving what was initially shipped as an auto-pick-the-oldest simplification): with exactly one eligible child (age ≥10, health > 0), succession still resolves automatically — there's no real decision to make. With two or more, `resolveTurn` pauses instead of picking (`GameState.pendingSuccession`, holding the eligible candidates and a snapshot of halved reputation), the session stops resolving further turns until a new `CHOOSE_HEIR { childId }` action picks one, and the game continues from there. The pause/resume shape mirrors how `TAKE_LOAN`/`DONATE_CHURCH` etc. are player actions distinct from `END_TURN`, rather than adding a second kind of "turn."
- ✅ **No eligible heir loses the game** — resolves what was an open design gap in the original draft (which didn't address a "no heir" case at all, since a scheduled age-60 trigger with automatic inheritance never needed to).
- ✅ **Marriage and children are now required for succession to function at all**, not a deferred v2 extension as originally scoped — see "Marriage" and "Child Development & Traits" below, both substantially rewritten from the original draft.
- ✅ **`maxTurns` set to 999,999`** (ADR-022) — the fixed-length-game assumption in this doc's own Purpose section ("at least once in a 40-turn game") no longer holds; a session now runs until death or a Mayor win (ADR-021).
- ✅ Inheritance carryover (fleet/cash/loan/political rank carry over; reputation halves; marital status resets to single, partner cleared) matches the original draft's table, with children *not* carried to the new generation (documented simplification — surviving siblings aren't tracked as the new player's own children).
- ✅ Turn-summary reporting: a death-with-heir message, a death-without-heir lose message, a per-child death message, and per-child trait-gained/birth messages — all as plain `TurnSummary` events rather than a distinct overlay variant (a scope simplification from the original "third turn-summary overlay variant" idea).

## Dynasty Chronicle (Implemented, v1.3 — new since the Implementation Status above)

The game's own pitch is "raise a family across generations," but until v1.3 there was no way to look back at that history — succession events were reported once in the turn summary (`TurnResult.summary.events`) and then discarded on the next turn. `GameState.chronicle: string[]` is a persistent, append-only log holding a subset of those events:

- Seeded with one founding entry at `NEW_GAME` (`buildStartingState`): "🏛️ {playerName} begins trading in Lübeck, Spring 1320."
- A new entry is appended at every point succession actually resolves: the single-eligible-heir auto-succession path, the multi-candidate `executeChooseHeir` resolution, and the no-eligible-heir game-over path (`resolveTurn`, `turn-system.ts`) — reusing the exact message text already generated for the turn summary rather than a separate string, so there's only one place that wording is written.
- Surfaced read-only in the Merchant's House building panel, most-recent-first, below the existing marriage/children sections — the natural home given it's the player's own household history, not a city service.
- **Save schema**: additive field, no `SCHEMA_VERSION` bump — an older save simply starts with an empty chronicle on load rather than backfilling a founding entry that didn't happen (`save-system.ts`'s `parseSaveFile`, same defaulting pattern as `hasWon`/`warehouses`/etc.).
- **Deliberately not included** (kept for a possible future pass, not because there wasn't room): rank-up announcements, random-event messages, birth/marriage messages. Scoped to succession specifically per the original feature-brainstorm ask, since that's the "generations" through-line the pitch is actually about — the other message types would make the log noisy without adding much to "look back at your dynasty's history."

## Marriage (Implemented — revised from "Non-Goal" in the original draft below)

The original draft explicitly kept marriage flavor-only, deferring it as blocking future work. It's now a real mechanic, required for children/succession to function:

- A "Seek Marriage" action at the Merchant's House building, available once `maritalStatus === 'single'` and `age >= 16` (a floor not in the original spec, added to avoid a freshly-succeeded 10-year-old heir marrying immediately).
- **One partner type exists so far**: "the Fisherman's Daughter" (age 22, female, 300 Mark buyout paid to her father, no ships/status of her own, gifts 10 herring — standing in for the originally-requested "fish", which isn't a good in this economy — to a ship docked in Lübeck if one is present at the time; the gift is simply skipped if none is). `PARTNER_TYPES` (`data/family.ts`) is a registry (matching the `SHIP_TYPES`/`GOODS` pattern) so future partner types slot in without restructuring.
- **Marriage success is 100% for now** (`MARRIAGE_SUCCESS_CHANCE`), structured so a future pass with multiple partner types can make it genuinely probabilistic without a redesign.
- `PlayerState.gender` was added specifically to make the birth-chance formula ("whichever of player/partner is female") resolve correctly regardless of which side is which in a future mixed-gender partner roster; the player defaults to `'male'` at New Game (no gender-selection UI yet, since only one — female — partner type exists).

## Children & Birth Chance (Implemented — revised from the original draft's proposal below)

- While married, each Spring rollover has a chance of a new child: `30% − (femaleAge − 20) × 1%`, clamped to `[0%, 30%]` (`birthChance()`, `data/family.ts`) — flatter at the low end than the original unclamped formula would have produced (which went above 30% below age 20 and negative above age 50).
- **No cap on the number of children** — the original draft's "cap at 3, to bound state" concern was explicitly waived.
- Each child ages a year on the same Spring rollover and, while under `HEIR_MIN_AGE` (10) with fewer than 2 traits, has a chance to roll a trait: 5% passively, or 25% if a "Hire Tutor" action (Merchant's House, 30 Mark, once per child per year) was used that year — a simplified two-tier version of the original draft's "hired teacher improves odds" idea.

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

### Mechanic (Implemented — revised)

- No fixed "growth period" of turns — a child simply exists (`PlayerState.children`) from birth and ages a year on each Spring rollover, same as the player.
- **Trait pool, revised**: not the originally-proposed Shrewd Trader/Bold Navigator/Popular/Frugal set. The four implemented traits are **Penny-pincher** (purchase prices -5%), **Simpleton** (purchase prices +5%), **Charismatic** (reputation gains +10%, losses -10%), **Hot-tempered** (reputation losses +10%, gains unaffected) — chosen to give the new Reputation Scandal event (`event-table.md`) and the existing price system something concrete to modify, rather than the original set's broader (travel time, storm risk, upkeep) scope. Contradictory pairs (Penny-pincher + Simpleton, Charismatic + Hot-tempered) can coexist on the same child and mathematically cancel — no special-casing to prevent it.
- Each year a child is under `HEIR_MIN_AGE` (10) with fewer than 2 traits: a 5% base chance to roll a trait, or 25% if "Hire Tutor" (Merchant's House, 30 Mark, once per child per year) was used that year — the "optional paid boost, skipping is valid but riskier" shape from the original proposal, simplified to a two-tier roll rather than a continuous quality curve.
  - **Bug investigated (2026-07-25):** a player reported a hired tutor "disappears randomly" and has to be re-hired. Root cause: `tutoredThisYear` is consumed (reset to `false`) by the very next Spring rollover regardless of whether the boosted roll actually produced a trait — which it usually doesn't (75% of the time, even with the boost). The "Hire Tutor" button silently reverting to its unhired state with no visible cause read as random. `growChildren` (`family-system.ts`) now pushes an explicit turn-summary message — `"{name}'s tutoring this year didn't produce a new trait — hire again to try next year."` — whenever a tutored roll fails, so the outcome is visible instead of silent. The underlying one-roll-per-hire mechanic is unchanged (working as designed); this fixes the missing feedback, not the odds.
- Whichever child is chosen as heir at succession (oldest eligible, see "Implementation Status" above) brings their traits into the new `PlayerState.traits`.

### Non-Goals (this sub-feature)

- No negative-only traits — Penny-pincher/Charismatic are strict upsides, Simpleton/Hot-tempered are strict downsides; a child can still end up net-negative if unlucky, unlike the original draft's "no strictly worse heir" goal — traded off in favor of a smaller, more legible trait pool.
- No teacher *characters* (named NPCs, portraits) — "Hire Tutor" is a per-child, per-year cash-cost action, not a hiring/roster system.

## Open Questions

- Should political rank really carry over unmodified, or partially reset (e.g. drop one rank) to give each generation a real climb? Flagged above as a deliberate but unconfirmed call.
- Multiple ongoing successions in one session (if the game runs long via "continue playing" after a win, or across several deaths) — does the mechanic hold up cleanly across many generations, or does something (e.g. heir naming running out of the fixed name list) need attention?
- Trait pool, hire-teacher cost, birth-chance curve, and the health-decay formula's coefficients are all placeholder numbers pending simulation/tuning, same as every other numeric proposal in this project's docs. Child mortality before reaching heir-eligible age is a genuine, non-trivial risk under the current formula — see ADR-022's Consequences.
- No healing mechanic exists yet — health only ever decreases. A later pass may add ways to slow or reverse decay.

## Related

- ADR-021 (Win condition is Mayor of Lübeck only)
- ADR-022 (Health-based mortality replaces the turn-limit lose condition)
- `docs/design/political-rank.md` (Reputation Scandal, this doc's Charismatic/Hot-tempered traits' reputation-loss dependency)
- `docs/design/event-table.md` (Reputation Scandal event)
- `src/game/state/types.ts` (`PlayerState.age`/`gender`/`health`/`partner`/`children`/`traits`, `Partner`, `Child`, `TraitId`)
- `src/game/systems/health-system.ts` (`rollHealthDecay`, `applyHealthDecay`)
- `src/game/systems/family-system.ts` (`executeSeekMarriage`, `executeHireTutor`, `growChildren`, `attemptBirth`, `traitPurchasePriceFactor`)
- `src/game/data/family.ts` (`PARTNER_TYPES`, `TRAITS`, birth-chance and child-name helpers)
- `src/game/systems/calendar-system.ts` (`advanceCalendar` — the year-rollover this hooks into)
