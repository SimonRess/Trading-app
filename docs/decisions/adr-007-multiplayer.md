# ADR-007: Multiplayer Scope

> Migrated from docs/07_multiplayer.md

**Date:** 2026-07-13  
**Status:** Accepted  
**Deciders:** Simon

## Context

Multiplayer is a scope decision that must be made before v1 development starts because it affects state design, UI architecture, and testing strategy — even for the single-player case. Online multiplayer would require a backend server, persistent database, state synchronisation, and conflict resolution: effectively a second project running in parallel. Hotseat multiplayer requires none of that but does require the UI to hide one player's state while another takes a turn.

The original *Hanse – Die Expedition* supported hotseat multiplayer — multiple players on the same machine, taking turns in sequence. No networking was required. The current state architecture (domain-sliced stores, pure functions on state, see ADR-004) is compatible with all three options, but the implementation cost scales dramatically.

## Decision

**Single-player only for v1. Hotseat multiplayer targeted for v2.**

Single-player establishes all core mechanics cleanly. Hotseat is a natural, low-infrastructure v2 extension: no server, no network code, just a UI layer that hides one player's state while the other takes a turn. Online multiplayer is explicitly out of scope until the core game is proven.

## Alternatives Considered

- **Hotseat multiplayer in v1** — faithful to the original, no server or network code needed, local co-op/competitive play; relatively simple since the UI hides one player's state while another takes their turn. Rejected for v1 because adding multi-player state management before the single-player core is proven increases complexity and testing surface area unnecessarily. Reserved as the v2 target.

- **Online multiplayer (async or real-time)** — most engaging long-term; enables a persistent shared game world. Rejected for all near-term versions because it requires a backend server and persistent database, state synchronisation and conflict resolution are complex, ongoing hosting costs create a financial obligation, and the scope increase is comparable to building a second project. Not reconsidered until the core game has a proven audience.

## Consequences

✅ Simplest build and test path for v1 — no synchronisation problems, no infrastructure costs  
✅ All core game mechanics can be designed and validated without multiplayer concerns  
✅ The pure-function state architecture (ADR-004) makes hotseat v2 a low-effort extension — each player's state slice can be hidden and revealed by the UI layer without touching game logic  
✅ Turn-based model (ADR-006) makes hotseat natural — each turn handoff is an existing concept  
⚠️  Single-player limits long-term replayability and community engagement compared to online play  
⚠️  Hotseat requires all players to be at the same machine or share a screen — limits reach  
🔒  The `GameState` structure must support multiple player slices cleanly for hotseat to be feasible in v2 — the `player` domain slice should be designed as one entry in a potential `players[]` array, not as a singleton, even in v1  
🔒  Online multiplayer is deferred indefinitely — any v1 or v2 code that assumes single shared state will need rethinking if online is ever pursued  

## Links

- Supersedes: —  
- Superseded by: —  
- Related ADRs: ADR-004 (Architecture — pure-function state makes hotseat feasible without rewriting logic), ADR-006 (Turn-based model — turn boundaries are natural hotseat handoff points), ADR-008 (Distribution — single-player open-source release is the right first distribution step before multiplayer adds complexity)  
- Related design docs: docs/design/game-mechanics.md
