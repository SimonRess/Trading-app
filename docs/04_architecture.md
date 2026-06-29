# Decision 4: Game Architecture & State Management

## Why This Matters

A clear state architecture determines how easy it is to implement save/load, add new game systems, and debug unexpected behavior. It also determines whether the game logic is testable independently of the UI.

## Options

### Global Store (Zustand / Svelte stores / Pinia)
**Pros**
- Simple to reason about in a turn-based game
- Game state is one serializable object → save games are trivial (JSON.stringify)
- Easy to read and write from both UI components and game logic

**Cons**
- Can become a tangled mess if domain boundaries aren't enforced

### Entity-Component-System (ECS)
**Pros**
- Clean separation of data (components) and logic (systems)
- Scales well with many interacting entities

**Cons**
- Overkill for a turn-based trading sim — there are no thousands of simultaneous entities
- Adds significant complexity and boilerplate upfront

### Event-Driven / Message Bus
**Pros**
- Highly decoupled — systems don't know about each other
- Good for modeling "things happen in the world" (market price changes, storms, pirate attacks)

**Cons**
- Causality is harder to trace when debugging
- Can make turn sequencing tricky

## Decision

**→ Global store with clearly separated domain slices**

Split state into named domains (not one giant blob):

```
GameState
├── player        (name, money, age, family)
├── fleet         (ships, cargo, current position)
├── cities        (stores, prices, relations)
├── market        (price history, supply/demand)
├── calendar      (current year/season, events queue)
└── ui            (active screen, open dialogs — NOT persisted in save)
```

Each domain is a Svelte store. Game logic functions are pure functions that take state and return new state — easy to unit test. The entire `GameState` minus `ui` is one JSON blob for save files.

An optional lightweight event bus can be added later for cross-domain notifications (e.g., "city burned down" triggers market price change) without rewriting the architecture.
