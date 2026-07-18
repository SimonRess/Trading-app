# ADR-015: Per-Route & Session Event Risk

**Date:** 2026-07-18  
**Status:** Accepted  
**Deciders:** Simon

## Context

Two design docs had specified route-level danger data that the implementation never consumed. `city-graph.md` defines a `stormRisk` table per route/season; `event-table.md` and `turn-resolution-order.md` both carried an explicit note that the event system used only a flat, season-weighted global roll (`selectEvent` in `event-system.ts`), identical regardless of which route(s) a player's ships were actually sailing. A ship on the calm Hamburg–Lübeck hop in Spring faced exactly the same storm/pirate odds as one crossing to Riga in Winter — the route data existed but did nothing.

Separately, `ship-stats.md` specified durability-threshold effects (Worn: +5% storm chance; Damaged: +10% storm chance and +1 turn travel time; Critical: cannot depart) that were also unimplemented — a ship at 1 durability could sail exactly like a fresh one.

The player asked for both to be implemented together, plus a mechanism for risk to *change during a session* — e.g. "pirate density in a specific area" fluctuating over the course of a game, not just as a static per-route constant.

Two implementation questions had to be answered:

1. **How exactly does per-route risk affect events**, given the existing "one event fires per turn at most, from a weighted pool" design (ADR-006, `event-table.md`)? The literal reading of `city-graph.md`'s original prose ("storm checks roll once per turn a ship spends in transit on that leg") describes independent per-leg-per-ship Bernoulli trials — a different, and incompatible, mechanic from the pool-based one already built and tuned.
2. **What does "session-adjustable" mean** without turning this into a player-facing settings screen, which was explicitly not requested?

## Decision

**Per-route/city risk is folded into the existing pool-weighting mechanism as a *relative danger factor*, not as an independent probability roll. Regional risk additionally drifts each turn via a bounded random walk, persisted for the session but never surfaced as player-configurable settings.**

Concretely:

- `routes.ts` gained a `pirateRisk` table (mirroring the existing `stormRisk`), so pirates are also route/season-sensitive, not just storms.
- A new `GameState.risk: RiskState` domain holds `routeModifiers` (per route pair) and `cityModifiers` (per city, currently just Danzig for the harvest event) — multipliers starting at 1.0.
- Each turn, `driftRiskState` nudges every modifier by a small random amount (±0.08, clamped to [0.5, 1.8]) — a bounded random walk. This is the "changes... in a session, like pirate density in specific areas" the player asked for: a route can become gradually more or less dangerous as the game progresses, with no player input and no persisted history beyond the current multiplier.
- `selectEvent`'s pool weight for storm/pirate is `SEASON_WEIGHT[season] * (routeRisk * modifier / networkAverageRisk)`, i.e. the raw route probability is normalised against the network-wide average for that event kind before multiplying into the existing 1–5 integer season-weight scale. A route at exactly the network average keeps the original tuned weight; a route twice as dangerous doubles it.
- Once storm is the selected event, **damage varies per ship** (not a uniform "everyone in transit takes 10"): `10 + routeBonus + durabilityBonus`, clamped to [6, 22].
- Once pirate raid is selected, **the target ship is chosen by weighted random** using each transiting ship's route pirate-risk, instead of picking uniformly at random.
- Durability thresholds (`ships.ts`): `canDepart` blocks Critical/Wrecked ships from receiving new orders; `durabilityTravelTimePenalty` adds +1 turn for Damaged ships; `durabilityStormChancePenalty` (0/0.05/0.10) folds into both the pool-weighting and the per-ship storm-damage formula above.

## Alternatives Considered

- **Literal per-leg-per-ship independent rolls** (the original `city-graph.md` prose) — each ship in transit independently rolls against its route's raw stormRisk/pirateRisk every turn, with no "one event per turn" cap. Rejected: this is a materially different, uncapped-frequency mechanic than the one already built, tuned, and tested (event-table.md's 25%-per-turn gate + weighted pool). Switching to it now would require re-tuning the entire event system's pacing from scratch and risks a much higher event rate than previously validated (~4 events/40-turn game).

- **Multiply route risk directly into the pool weight without normalisation** — tried first, and rejected after measurement: raw route-risk values (0.01–0.25) are two orders of magnitude smaller than the season-weight scale (1–5) used for `bumper_harvest`, so direct multiplication crushed storm/pirate weights to near-zero relative to harvest. A 200-trial simulation showed harvest events jumping to 4.65/game while storms fell — a badly skewed mix that was never intended. Normalising against the network average (relative danger factor centred on 1.0) fixed this while preserving route-sensitivity; re-measurement after the fix showed storms 3.13/game, pirates 2.63/game, harvests 2.72/game — comparable magnitudes, consistent with the original tuning.

- **Static (non-drifting) route risk** — simplest: just use the table values and a fixed session-start modifier. Rejected because the player specifically asked for probabilities that can change *during* a session, not just differ by route. A fixed modifier wouldn't distinguish "this route is always riskier" (already captured by the static table) from "this route has gotten riskier lately" (the requested behaviour).

- **Player-visible risk configuration (a settings/tuning panel)** — would let the player deliberately adjust pirate density, storm frequency, etc. Rejected: not requested (the ask was for the *game* to vary risk over a session, not for the player to control it), and it would need UI, validation, and persistence design disproportionate to the actual request.

- **Independent RNG-per-domain vs. centralised RNG** — considered keeping ship-targeting/damage randomness inside `fleet-system.ts` (where `applyStormDamage`/`applyPirateRaid` used to roll their own dice). Rejected in favour of moving all `Math.random()` calls into `event-system.ts` and having `fleet-system.ts` take pre-decided predicates/targets as parameters — keeps `fleet-system.ts`'s functions pure and trivially testable with deterministic inputs, and keeps all game-randomness in one auditable place.

## Consequences

✅ `city-graph.md`'s storm-risk table and the new `pirateRisk` table are both actually consumed — no more "documented but does nothing" data  
✅ Durability thresholds from `ship-stats.md` are fully implemented: cannot-depart-if-critical, +1 turn if Damaged, storm-chance/damage bonus if Worn/Damaged  
✅ Regional danger genuinely varies over a session without any player configuration, satisfying the "pirate density in specific areas can change" request  
✅ Original event-type balance (storm/pirate/harvest at comparable frequency) is preserved — verified via 200-trial simulation before and after the normalisation fix  
✅ All per-turn randomness for events lives in `event-system.ts`; `fleet-system.ts` stays pure (damage/target are function parameters, not dice rolls)  
✅ New pure functions (`durabilityStatus`, `durabilityStormChancePenalty`, `durabilityTravelTimePenalty`, `canDepart`, `averageShipRisk`, `stormDamageForShip`, `pickPirateTarget`, `driftRiskState`) are independently unit-tested  
⚠️ The event mix is now driven by an approximation (normalised relative-risk factors, damage/target formulas with hand-picked constants — `STORM_ROUTE_DAMAGE_SCALE`, clamp bounds, drift step size) rather than the literally-specified per-leg probability rolls in the original `city-graph.md` prose; that prose is now corrected in the doc, but the specific tuning constants are still estimates pending playtesting  
⚠️ `RiskState` adds a fifth domain to `GameState`, growing the save file slightly (small `Record<string, number>` maps) — no schema-version bump needed since it's additive, but `save-file-schema.md` needs updating to describe it  
🔒 Regional risk modifiers are session-only (start fresh at 1.0 on `NEW_GAME`/`LOAD_SAVE` calling `buildInitialRiskState`) — they are not currently persisted meaningfully across a save/reload in a way distinct from "reset to 1.0", since a loaded save's `risk` field is whatever was saved; this is fine for MVP but should be revisited if "a region has been dangerous for a while" needs to survive a save/reload boundary intentionally

## Links

- Supersedes: —  
- Superseded by: —  
- Related ADRs: ADR-006 (Turn-based — events fire once per turn at resolution step 7), ADR-004 (Architecture — pure functions, domain-sliced state; `risk` is a new domain), ADR-009 (Market price formula — the same "keep it simple, tune with constants" philosophy)  
- Related design docs: `docs/design/city-graph.md` (stormRisk/pirateRisk tables), `docs/design/event-table.md` (full weighting/damage/targeting formulas), `docs/design/ship-stats.md` (durability thresholds), `docs/design/turn-resolution-order.md` (risk drift as a resolution step)  
- Implementation: `src/game/systems/risk-system.ts`, `src/game/systems/event-system.ts`, `src/game/systems/fleet-system.ts`, `src/game/data/ships.ts` (durability helpers), `src/game/data/routes.ts` (`pirateRisk`, `routeKey`)
