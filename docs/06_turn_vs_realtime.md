# Decision 6: Turn-Based vs. Real-Time Gameplay

## Why This Matters

This choice fundamentally shapes how the game simulation runs, how complex the engine needs to be, and how the player experiences trading and sailing.

## The Original

Hanse – Die Expedition was turn-based. Time advanced when the player ended a turn or completed a voyage. All market events, family events, and combat were resolved at turn boundaries.

## Options

### Turn-Based (faithful to original)
**Pros**
- Dramatically simpler to implement — no game loop pressure
- Market simulation, event triggers, and combat resolve cleanly at turn end
- Works well on mobile and in short play sessions
- Easier to implement save/load correctly

**Cons**
- Less immersive; can feel "board-gamey"
- Sailing feels less atmospheric without visual transit

### Real-Time with Pause
**Pros**
- More immersive; ships visibly sail between ports
- Closer to games like Port Royale or Patrician

**Cons**
- Significantly more complex: simulation must run at variable rates
- Harder to balance market dynamics
- Save states during transit are tricky

### Real-Time with Speed Control (×1 / ×2 / ×4)
**Pros**
- Good UX compromise — pause when thinking, fast-forward when waiting
- Standard in the genre (Anno, Port Royale)

**Cons**
- Adds meaningful complexity to every simulation system
- Event timing becomes harder to reason about

## Decision

**→ Turn-based for v1**

Faithful to the original, dramatically reduces engine complexity, and is correct for a first version. The turn model also makes it easier to reason about game balance and to write tests for game logic.

Real-time with speed control can be considered for a v2 if the game gains traction — the state architecture chosen (pure functions on state) makes this transition possible without rewriting game logic.
