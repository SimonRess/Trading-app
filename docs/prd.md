# Product Requirements Document — Hanse – Die Expedition

**Status:** Living document
**Last updated:** 2026-07-25

This file didn't exist until now, despite `00_project_structure.md` describing it as Layer 1 of the doc hierarchy since the project's start — the vision lived in `10_game_mechanics.md` and the cut-down scope in `design/mvp-scope.md` instead. This file formalizes both into one place.

Planned-but-unbuilt work is tracked in exactly one place, not here: `docs/design/roadmap-next-versions.md`. This file previously also carried a Feature Backlog section, which duplicated that roadmap and drifted out of sync with it; it was removed in favor of a single source of truth. This PRD stays scoped to what's genuinely slow-changing — vision, audience, shipped scope, and non-goals.

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

## Related

- `docs/design/roadmap-next-versions.md` — **the single source of truth for planned/unbuilt work**, sequenced by target version
- `docs/00_project_structure.md` §4b — the ordered, dated log of what's *already shipped* (with the roadmap doc picking up where it leaves off)
- `docs/10_game_mechanics.md` — full original vision (this PRD's Core Feature List is drawn from it; so is most of the roadmap's content)
- `docs/design/mvp-scope.md` — the MVP cut-down and its out-of-scope table
- ADR-005 (art style), ADR-007 (multiplayer), ADR-010 (combat)
