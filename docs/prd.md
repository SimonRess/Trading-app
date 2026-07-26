# Product Requirements Document — Hanse: Die Expedition

**Status:** Living document
**Last updated:** 2026-07-25

This file didn't exist until now, despite `00_project_structure.md` describing it as Layer 1 of the doc hierarchy since the project's start — the vision lived in `10_game_mechanics.md` and the cut-down scope in `design/mvp-scope.md` instead. This file formalizes both into one place and adds the **Feature Backlog / Roadmap** section that's been missing: a single list of everything scoped but not yet built, gathered from `10_game_mechanics.md`, `mvp-scope.md`'s out-of-scope table, ADR-005 (art), ADR-007 (multiplayer), and player feedback across the shipped releases.

## Vision

A turn-based medieval trading simulation inspired by *Hanse – Die Expedition* (1994, Ascon). The player starts as a small merchant in Lübeck with one ship and limited funds, builds a trade network across Hanseatic northern Europe, manages a fleet, raises a family across generations, and aims to become Mayor of Lübeck.

## Target Audience

Players who enjoyed the original *Hanse* or similar economic/trading sims (Patrician, Port Royale), and players who want a slower, turn-based strategy game they can play in short sessions.

## Core Feature List (shipped)

- Trading loop: 5 goods, 5 cities, supply/demand-driven prices, bulk-order price pressure
- Fleet: 3 ship types, buying/repairing/renaming/auctioning, crew, cannons, insurance
- Sailing: turn-based travel, storms, pirate combat (posture-based), route-danger visualization on the map
- Economy: church donations, banking/loans, warehouses
- Politics: reputation per city, political rank progression, Mayor win condition
- Family: marriage, children, traits, tutoring, health-based mortality, generational succession
- Random events: 9 events (storm, pirate raid, bumper harvest, market boom, guild festival, shipwreck salvage, city plague, diplomatic embargo, reputation scandal)
- Save/load (localStorage auto-save + JSON export/import)
- In-app version display and changelog viewer
- Settings menu with English/German localization of all static UI (`docs/design/localization.md`)

## Non-Goals (confirmed decisions, not just "not done yet")

- Online multiplayer (ADR-007) — rejected indefinitely, server/infra cost not justified until the core game has a proven audience
- Full grid-tactical combat (ADR-010) — the simpler posture/power-roll system was chosen deliberately; a full tactical grid is a possible *future* upgrade, not a rejected idea, but is not committed to

## Win/Lose Conditions

- **Win:** reach Mayor of Lübeck (political rank + reputation threshold)
- **Lose:** bankruptcy (net worth ≤ 0), or death with no eligible heir
- `maxTurns` is effectively uncapped (999,999) — a session runs until death or a Mayor win, not a turn counter

---

## Feature Backlog / Roadmap

Organized by category. Nothing here has a committed version number — this is the pool to pull from, prioritized loosely within each category (top = likely more valuable/urgent).

### Gameplay depth

1. **Combat loot realism** — victory loot is a fixed random-goods pool, not a simulated enemy fleet with its own cargo/routes/ships/weapons. (ADR-010 Open Questions)
2. **Ability to initiate combat** — pirate encounters are always pirate-triggered; no way to hunt pirates for loot/reputation.
3. **Stores & agents in cities** — permanent inventory per city, managed by a hired agent with a loyalty/skill rating affecting unsupervised performance. (Original vision, `10_game_mechanics.md` §3; targeted v1.1, never built.)
4. **Expeditions & city discovery** — send a child as an "Explorer" on a multi-turn expedition with a success chance based on stats/supplies; success adds a new city to the map. (Original vision §6; targeted v2, never built.)
5. **Full grid-tactical combat** — the original's cannon-placement mini-game, as an optional upgrade over the current posture-based system. (ADR-010, deferred not rejected.)
6. **Ransoming captured pirates / handing them to city authorities** for reputation gain. (Original vision §5.)
7. **Fixed-term loans with real consequences for default** (reputation damage, asset seizure) — current loans are simpler: no term, no penalty beyond compounding interest. (Original vision §8.)
8. **More random events**: city fire (damages a store — depends on #3), war between cities (blocks routes), rival merchant NPC (undercuts prices in a city), guild disputes (forced to pick a side). (Original vision §9.)
9. **Second (and further) marriage partner types** — only the Fisherman's Daughter exists today.
10. **Per-city warehouse income/price variance** — flat 15 Mark/turn everywhere currently.
11. **End-of-game scoring** — a summary score (wealth, cities with stores, reputation, generations played, discoveries) shown at game end, beyond the current binary win/lose screens. (Original vision §10.)

### Graphics & audio

12. **Real pixel-art sprite sheets**, replacing the current procedurally-generated placeholder graphics (`drawPixelSprite`). (ADR-005 — committed direction, no artist pipeline yet; needs a new `design/asset-pipeline.md`.)
13. **Illustrated key scenes** — city arrivals, NPC portrait dialogs, story events — for high-impact emotional moments, per ADR-005's two-tier art plan. Currently nothing illustrated exists.
14. **NPC portrait dialogs** for trade negotiation, marriage, and events — currently all text/button-driven. (Targeted v1.1, never built.)
15. **Audio / music** — currently silent. (Targeted v1.1, never built.)

### Multiplayer

16. **Hotseat multiplayer** (ADR-007, targeted v2) — pass-and-play, no server. Not started.
17. **`GameState.player` singleton → `players[]` array migration** — a prerequisite ADR-007 called for from day one specifically so hotseat wouldn't need a later rewrite; the actual code never did this, so hotseat now needs a state-shape migration first, more work than originally planned. Should happen *before* hotseat work starts, not during.

### Balance & polish

18. **Balance/threshold tuning pass** — nearly every system shipped so far (events, political rank, family/succession, church, warehouses, crew, banking, insurance, combat, market pricing) is still first-pass numbers, not validated by simulation or extended playtesting.

---

## Related

- `docs/10_game_mechanics.md` — full original vision (this PRD's Core Feature List and most of the Backlog above are drawn from it)
- `docs/design/mvp-scope.md` — the MVP cut-down and its out-of-scope table
- `docs/00_project_structure.md` §4b — the *ordered, in-progress* implementation plan (ADR-018's city-view rollout and beyond); this PRD's backlog is the larger, unordered pool that plan draws from
- ADR-005 (art style), ADR-007 (multiplayer), ADR-010 (combat)
