# ADR-006: Turn-Based vs. Real-Time Gameplay

> Migrated from docs/06_turn_vs_realtime.md

**Date:** 2026-07-13  
**Status:** Accepted  
**Deciders:** Simon

## Context

The choice between turn-based and real-time gameplay is one of the most structurally consequential decisions in the project. It affects every simulation system: how the market updates, how ships travel, how events trigger, how combat resolves, and how save/load works. Real-time requires a continuous game loop, variable time-step simulation, and careful handling of save states mid-transit. Turn-based allows all resolution to happen at discrete, predictable boundaries.

The original *Hanse – Die Expedition* was fully turn-based: time advanced when the player ended a turn or completed a voyage, and all market events, family events, and combat were resolved at turn boundaries. The chosen architecture (pure functions on state, see ADR-004) is compatible with both models, but the implementation complexity differs by an order of magnitude.

## Decision

Use **turn-based gameplay for v1**. Each turn represents one season (Spring, Summer, Autumn, Winter). The player issues orders, ends the turn, and the game resolves all events in a deterministic sequence.

Real-time with speed control is explicitly deferred to v2 — the pure-function state architecture makes that transition feasible later without rewriting game logic.

## Alternatives Considered

- **Real-time with pause** — more immersive; ships visibly sail between ports; closer to Port Royale and Patrician. Rejected because it requires the simulation to run at variable rates, makes market dynamics significantly harder to balance, and makes save states during transit tricky to implement correctly. The immersion benefit does not justify the engineering cost at v1.

- **Real-time with speed control (×1 / ×2 / ×4)** — good UX compromise; standard in the genre (Anno, Port Royale, Patrician). Rejected for v1 because it adds meaningful complexity to every simulation system, and event timing becomes harder to reason about at variable speeds. The speed control layer also requires a game loop and a time-step model that turn-based avoids entirely. Kept as the preferred v2 upgrade path if the game gains traction.

## Consequences

✅ Dramatically simpler simulation engine — no game loop, no variable time-step, no mid-transit state  
✅ All market events, combat, and family aging resolve at a single deterministic turn boundary — easy to reason about, easy to test  
✅ Save/load is clean — saves always happen between turns, never mid-resolution  
✅ Works well on mobile and in short play sessions — the player can stop at any turn end  
✅ Game balance is easier to tune — one turn equals one season, all effects are discrete  
✅ Pure-function architecture (ADR-004) makes a future upgrade to real-time feasible without rewriting logic  
⚠️  Less immersive than real-time — sailing feels abstract without visible ship transit across the map  
⚠️  Can feel "board-gamey" to players accustomed to Port Royale / Anno / Patrician  
🔒  Turn resolution order must be defined and held stable — market update → event trigger → fleet movement → family aging. Changing this order is a balance change, not a refactor  
🔒  All simulation systems must be stateless between turns — no system may accumulate hidden state across turns outside the `GameState` slices  

## Links

- Supersedes: —  
- Superseded by: —  
- Related ADRs: ADR-004 (Architecture — pure functions on state make turn resolution clean and testable; also enables future real-time upgrade), ADR-007 (Multiplayer — turn-based model simplifies hotseat multiplayer significantly)  
- Related design docs: docs/design/game-mechanics.md (turn structure section), docs/design/turn-resolution-order.md (when created)
