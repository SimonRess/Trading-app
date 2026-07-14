# ADR-012: Game Client Abstraction

**Date:** 2026-07-14  
**Status:** Accepted  
**Deciders:** Simon

## Context

In v1 all game logic runs as pure TypeScript functions in the browser (`src/game/systems/`). For online multiplayer (v3+) that logic must move to an authoritative backend server — likely Python — with the browser becoming a thin client that sends actions and receives new state. The question is whether any structural preparation is worth doing in v1, or whether the migration can be handled entirely later.

The risk of doing nothing: if UI components call game logic functions directly, every component becomes a migration touch-point. With dozens of UI components each importing from `src/game/`, the v3 refactor becomes a search-and-replace across the entire UI layer rather than a swap of one implementation.

The pure-function architecture (ADR-004) already separates game logic from UI concerns. One additional abstraction — a `GameClient` interface between the UI and game logic — eliminates the remaining coupling at negligible cost.

## Decision

Introduce a **`GameClient` interface** that all UI code must use to interact with game logic. The UI never imports from `src/game/systems/` directly.

```typescript
// src/game/client/game-client.ts
interface GameClient {
  getState(): GameState;
  sendAction(action: GameAction): Promise<GameState>;
}
```

Two implementations ship in v1:

**`LocalGameClient`** — calls the pure functions in the browser synchronously, wrapped in a resolved Promise to match the async interface:

```typescript
class LocalGameClient implements GameClient {
  private state: GameState;

  sendAction(action: GameAction): Promise<GameState> {
    this.state = applyAction(this.state, action);
    return Promise.resolve(this.state);
  }
}
```

**`RemoteGameClient`** (stub, v3) — calls a backend API:

```typescript
class RemoteGameClient implements GameClient {
  sendAction(action: GameAction): Promise<GameState> {
    return fetch('/api/turn', {
      method: 'POST',
      body: JSON.stringify(action),
    }).then(r => r.json());
  }
}
```

The active implementation is injected once at app startup (`main.ts`) and passed down or stored in a Svelte context. Swapping local for remote is a one-line change at the injection site.

## Alternatives Considered

- **Do nothing now; refactor at v3** — simplest in the short term. Rejected because the coupling cost grows with every UI component added. By v3 there will be dozens of components importing game logic directly; the refactor touches all of them. The abstraction costs one interface and two small classes upfront.

- **Use a Svelte store as the interface** — the UI reads state from stores and dispatches to a store-bound action handler. Partially equivalent, but stores are a Svelte-specific primitive. The `GameClient` interface is framework-agnostic and makes the seam explicit and testable independently of Svelte.

- **Event bus as the dispatch mechanism** — UI emits events, game logic listens and updates state. Rejected for the same reasons as in ADR-004: causality is hard to trace, turn sequencing is tricky, and it adds indirection without a clear benefit at this scale.

## Consequences

✅ UI components have zero direct imports from `src/game/systems/` — the seam is enforced by the interface  
✅ Swapping local execution for a remote API call is a one-line change at app startup  
✅ `GameClient` is independently testable with a mock implementation — no Svelte or PixiJS required  
✅ The async interface (`Promise<GameState>`) is correct for both local and remote from day one — no interface change needed at v3  
✅ A Python backend rewrite of `src/game/systems/` becomes a self-contained project — no UI changes required  
⚠️  All UI action dispatch must go through `sendAction` — direct calls to game logic functions are a convention violation that won't be caught at compile time without an ESLint import boundary rule  
⚠️  The local implementation wraps synchronous logic in Promises — negligible overhead but slightly less obvious to read  
🔒  `GameAction` must be a serialisable discriminated union from day one — no functions, class instances, or non-JSON values in actions, since they must be transmittable to a remote server at v3  

## Links

- Supersedes: —  
- Superseded by: —  
- Related ADRs: ADR-004 (Architecture — pure functions make the local implementation trivial; domain slices define `GameState`), ADR-007 (Multiplayer — online v3 is the primary motivation for this abstraction)  
- Related design docs: docs/design/tech-stack.md
