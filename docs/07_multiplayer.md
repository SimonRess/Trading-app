# Decision 7: Multiplayer Scope

## Why This Matters

Multiplayer fundamentally changes the technical infrastructure required. Online multiplayer in particular introduces servers, synchronization, conflict resolution, and ongoing hosting costs.

## The Original

Hanse – Die Expedition supported **hotseat multiplayer** — multiple players on the same computer, taking turns. No networking required.

## Options

### Single-Player Only
**Pros**
- Simplest to build and test
- No infrastructure costs
- No synchronization problems

**Cons**
- Limits long-term replayability and community engagement

### Hotseat Multiplayer
**Pros**
- Faithful to the original
- No server or network code needed
- Local co-op/competitive play
- Relatively simple to implement: UI hides one player's state while another takes their turn

**Cons**
- Requires all players to be at the same machine (or share screen)

### Online Multiplayer (async or real-time)
**Pros**
- Most engaging long-term; enables a persistent game world

**Cons**
- Requires a backend server and persistent database
- State synchronization and conflict resolution are complex
- Ongoing hosting costs
- Massive scope increase — essentially a second project

## Decision

**→ Single-player for v1; hotseat as v2**

Single-player establishes all core mechanics. Hotseat multiplayer is a natural, low-effort v2 that requires no infrastructure and is faithful to the original. Online multiplayer is out of scope until the core game is proven.
