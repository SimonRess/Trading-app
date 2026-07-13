# ADR-004: Game Architecture & State Management

> Migrated from docs/04_architecture.md

**Date:** 2026-07-13  
**Status:** Accepted  
**Deciders:** Simon

## Context

The architecture choice determines three things that matter most for this project: (1) whether save/load can be implemented trivially, (2) whether game logic can be unit-tested without a browser or UI framework, and (3) whether new game systems can be added without causing cascading side effects. The game is turn-based with a bounded set of entity types (player, ships, cities, goods) — it does not have thousands of simultaneous interacting entities. The architecture must suit that scale, not over-engineer for it.

## Decision

Use a **global store with clearly separated domain slices**, implemented as Svelte stores.

State is split into named domains rather than one flat blob:

```
GameState
├── player     (name, money, age, family)
├── fleet      (ships, cargo, current position)
├── cities     (stores, prices, player relations)
├── market     (price history, supply/demand)
├── calendar   (current year/season, events queue)
└── ui         (active screen, open dialogs — NOT persisted to save files)
```

All game logic is implemented as **pure functions**: `(state, action) => newState`. State is never mutated in place. The entire `GameState` minus `ui` is serialised as a single JSON blob for save files.

A lightweight event bus may be added later for cross-domain notifications (e.g. "city burned down" → market price spike) without requiring an architectural rewrite.

## Alternatives Considered

- **Entity-Component-System (ECS)** — clean separation of data (components) from logic (systems); scales well with many interacting entities. Rejected because ECS is designed for games with thousands of simultaneous entities (shooters, simulations with particle systems). A turn-based trading sim has a small, fixed set of entity types. ECS would add significant complexity and boilerplate with no meaningful benefit at this scale.

- **Event-Driven / Message Bus (primary architecture)** — highly decoupled; systems don't know about each other; models "things happen in the world" naturally. Rejected as the *primary* architecture because it makes causality harder to trace during debugging and makes turn sequencing tricky — in a turn-based game the order of resolution (market update → event trigger → fleet movement → family aging) must be deterministic and auditable. An event bus can be layered on top later for cross-domain notifications without it being the structural backbone.

- **Global store (single flat blob)** — simplest possible approach; everything in one object. Considered but rejected in favour of domain slices because a flat blob has no enforced boundaries and becomes difficult to navigate as the game grows. Domain slices give the same serialisation benefit while keeping each area of state independently readable.

## Consequences

✅ Save/load is `JSON.stringify(gameState)` / `JSON.parse(...)` — trivially implementable  
✅ Pure functions `(state, action) => newState` are unit-testable without a browser, DOM, or Svelte runtime  
✅ Domain slices enforce boundaries — a system that touches `market` should not need to know about `fleet`  
✅ Svelte stores provide reactivity for free — UI components subscribe to only the slices they need  
✅ Turn resolution order is explicit and auditable — no hidden event chains  
✅ Event bus can be added later for cross-domain side effects without rewriting the core  
⚠️  Domain boundaries must be actively enforced by convention — there is no runtime guard preventing a system from reading across domains  
⚠️  Pure functions require passing state explicitly — slightly more verbose than reading from a shared mutable context  
🔒  Immutability requirement: all state updates must return new objects — in-place mutation is a bug, not a shortcut  
🔒  `ui` state must never be written to save files — this is a permanent structural rule, not a later concern  

## Links

- Supersedes: —  
- Superseded by: —  
- Related ADRs: ADR-002 (Language & Framework — establishes Svelte stores as the reactivity primitive), ADR-003 (Rendering — ui slice separates UI state from game state flowing into the PixiJS layer), ADR-011 (Save file format — directly depends on the serialisability guarantee made here)  
- Related design docs: docs/design/save-file-schema.md (when created)
