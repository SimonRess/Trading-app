# ADR-010: Combat Mechanic

**Date:** 2026-07-14  
**Status:** Proposed  
**Deciders:** Simon

## Context

Combat occurs when a ship is intercepted by pirates or a rival city's fleet. The original *Hanse – Die Expedition* featured a tactical mini-game where the player placed cannons on a grid representing the ship's deck, after which combat resolved automatically based on placement, crew count, and enemy strength.

Combat is explicitly out of scope for the MVP (v2 target, per `docs/design/mvp-scope.md`). This ADR is written now to record the design decision before implementation, so that v1 data structures (ship stats, cargo, crew) do not inadvertently block the v2 combat implementation.

The key design question is the degree of player interaction: from fully automatic (a dice roll) to a tactical puzzle (the original grid placement). The choice affects how much combat feels like a meaningful game system vs. a random tax on the player.

## Decision

> **Status: Proposed — awaiting Simon's approval before this becomes Accepted.**

Proposed: **Semi-tactical combat with a pre-battle preparation phase and automatic resolution.**

The player does not control combat turn-by-turn. Instead, before a voyage the player assigns **cannon slots** on their ship and chooses a **combat posture** (aggressive / defensive / flee). When combat is triggered, the outcome is resolved automatically from those pre-set choices plus ship stats and a random element.

### Flow
1. **Pre-battle:** Before departure, the player configures each ship:
   - Assign 0–N cannons to the ship (cannons take up cargo space: 1 cannon = 2 last)
   - Set posture: `aggressive` (higher damage, higher risk) · `defensive` (lower damage, lower risk) · `flee` (always attempts escape, loses some cargo on success)
2. **Trigger:** A combat encounter fires based on route danger rating (see event table)
3. **Resolution:** One automatic calculation:
   ```
   player_power = cannons × 10 + crew_bonus + posture_modifier
   enemy_power  = rand(20, 60)   // scales with route danger
   outcome      = compare(player_power, enemy_power) + rand(−10, +10)
   ```
4. **Outcome:**
   - Victory (player_power > enemy_power + threshold): capture enemy cargo (random goods, ~10 last)
   - Retreat (within threshold): escape; lose 10–20% of cargo
   - Defeat (player_power < enemy_power − threshold): ship loses 20–40 durability; lose 30–50% cargo
   - Sunk (durability reaches 0 after defeat): ship and all cargo lost

### Why not full grid placement (faithful to original)?
The original's grid placement is engaging but requires a dedicated UI screen with drag-and-drop or click-to-place interaction, animated combat, and a separate visual design system. That scope is a significant mini-game in its own right. The pre-battle configuration approach delivers meaningful player agency (cannon investment, posture choice, risk/reward) without a dedicated combat UI, and can be implemented as an extension of the existing port view.

## Alternatives Considered

- **Fully automatic (dice roll only)** — no player agency; combat feels like a random tax. Rejected because it removes all interesting decisions from an event that should feel consequential.

- **Full grid tactical combat (faithful to original)** — highest engagement; most faithful to the source. Deferred (not rejected): can replace the proposed system in v2.1 if the simpler version proves unsatisfying. The data structures required are compatible.

- **Flee-only (no combat option)** — player can only attempt to flee, never fight back. Rejected because it removes the pirate-hunting and reputation-gain mechanics that make some voyages offensively interesting.

- **Card-based combat** — draw combat cards, play one per round. Interesting but introduces a card system with its own balancing surface. Out of scope for v2.

## Consequences

✅ Player has meaningful pre-voyage decisions (cannon investment vs. cargo space, posture choice)  
✅ No dedicated combat UI screen required — configuration happens in the port view  
✅ Resolution is deterministic from pre-set choices + one random roll — easy to unit test  
✅ Ship and cargo types needed for combat (durability, cargo slots, crew) are already in the data model  
✅ Compatible with a future upgrade to full grid tactical combat without structural changes  
⚠️  Less viscerally engaging than a turn-by-turn tactical system  
⚠️  Player cannot react to combat in progress — posture and cannon count must be chosen correctly in advance  
🔒  Cannons consume cargo space (1 cannon = 2 last) — `Ship.cargo` must support a `cannon` entry alongside goods  
🔒  Ships need a `crew` count field for the crew bonus calculation — must be added to `Ship` in `types.ts` before v2  
🔒  Route danger ratings must be defined in the route data (`routes.ts`) before combat can be triggered correctly  

## Links

- Supersedes: —  
- Superseded by: —  
- Related ADRs: ADR-006 (Turn-based — combat triggers and resolves at turn boundaries), ADR-004 (Architecture — combat resolution is a pure function on GameState)  
- Related design docs: docs/design/mvp-scope.md (combat is v2), docs/design/ship-stats.md (when created — cannon capacity affects combat power), docs/10_game_mechanics.md (original combat design description)
