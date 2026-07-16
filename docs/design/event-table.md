# Design: Event Probability Table

**Status:** Draft  
**Last updated:** 2026-07-14

## Purpose

Define every random event in the MVP: when it can fire, how likely it is, and exactly what state change it applies. Events fire in step 7 of turn resolution (see `docs/design/turn-resolution-order.md`).

---

## Event System Rules

- **One event per turn maximum** (MVP)
- **Base trigger probability:** 25% per turn that any event fires at all
- If an event fires, one is selected from the **active pool** — events that are currently eligible given game state and season
- Each event in the pool has a **weight**; selection is weighted random
- Events that have no eligible targets (e.g. a storm event when no ship is in transit) are excluded from the pool before selection

---

## MVP Event Pool

### Event 1 — Storm

| Field | Value |
|-------|-------|
| **ID** | `storm` |
| **Description** | A storm batters ships in the Baltic |
| **Seasons** | All; higher weight in Autumn and Winter |
| **Eligibility** | At least one player ship is currently in transit |
| **Weight** | Spring: 2 · Summer: 1 · Autumn: 3 · Winter: 5 |
| **Effect** | Each ship currently in transit takes **10 durability damage** |
| **Player message** | "A violent storm swept the Baltic. Your ships at sea took damage." |

Notes:
- If multiple ships are in transit, all are hit
- A ship reduced to 0 durability is wrecked: cargo lost, ship removed from fleet
- Storm on top of existing route-level storm risk (city-graph.md): the event is an *additional* storm, separate from the per-leg transit rolls

---

### Event 2 — Bumper Harvest

| Field | Value |
|-------|-------|
| **ID** | `bumper_harvest` |
| **Description** | An exceptional harvest floods Danzig with grain |
| **Seasons** | Summer, Autumn only |
| **Eligibility** | Always (no target required) |
| **Weight** | Summer: 2 · Autumn: 3 |
| **Effect** | Grain supply in Danzig: `+30` (clamped to 100) |
| **Player message** | "A bumper harvest in the east — grain prices in Danzig collapsed." |

Notes:
- Supply spike lasts only this turn's market update; subsequent turns return to normal production/consumption drift
- Effective price impact: Danzig grain moves from ~3 Mark/last toward the 2 Mark floor

---

### Event 3 — Pirate Raid

| Field | Value |
|-------|-------|
| **ID** | `pirate_raid` |
| **Description** | Pirates intercept one of the player's ships |
| **Seasons** | All; lower weight in Winter (pirates don't like storms either) |
| **Eligibility** | At least one player ship is currently in transit |
| **Weight** | Spring: 2 · Summer: 3 · Autumn: 2 · Winter: 1 |
| **Effect** | One random ship in transit loses **15% of its total cargo** (rounded down, per good proportionally) |
| **Player message** | "Pirates intercepted the [ship name]! Part of the cargo was seized." |

Notes:
- Target ship is chosen randomly if multiple ships are in transit
- Cargo loss is proportional across all goods in the hold (e.g. 20 last salt + 10 last grain → lose 3 salt + 1 grain)
- In MVP the player cannot fight back (combat is v2); pirate raid is always a partial loss

---

## Seasonal Weight Summary

| Event | Spring | Summer | Autumn | Winter |
|-------|--------|--------|--------|--------|
| Storm | 2 | 1 | 3 | 5 |
| Bumper harvest | — | 2 | 3 | — |
| Pirate raid | 2 | 3 | 2 | 1 |

Weights are relative within the eligible pool. In Winter, for example, if a ship is in transit, the pool is Storm (5) + Pirate raid (1) = 6 total weight → 83% chance of storm, 17% chance of raid if any event fires.

---

## Resolution Algorithm

```typescript
function selectEvent(state: GameState): EventId | null {
  const roll = Math.random();
  if (roll > 0.25) return null;  // no event this turn

  const season = state.calendar.season;
  const shipsInTransit = state.fleet.ships.filter(
    s => typeof s.position !== 'string',
  );

  const pool: Array<{ id: EventId; weight: number }> = [];

  if (shipsInTransit.length > 0) {
    pool.push({ id: 'storm',       weight: STORM_WEIGHTS[season] });
    pool.push({ id: 'pirate_raid', weight: PIRATE_WEIGHTS[season] });
  }

  if (season === 'summer' || season === 'autumn') {
    pool.push({ id: 'bumper_harvest', weight: HARVEST_WEIGHTS[season] });
  }

  if (pool.length === 0) return null;

  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let pick = Math.random() * total;
  for (const entry of pool) {
    pick -= entry.weight;
    if (pick <= 0) return entry.id;
  }

  return pool[pool.length - 1]?.id ?? null;
}
```

---

## Post-MVP Events (v1.1+)

Not implemented in MVP. Listed for reference so they do not surprise the architecture.

| Event | Effect |
|-------|--------|
| Plague in city | Trade suspended in one city for 1–3 turns |
| City fire | Player's store in that city damaged (repair cost) |
| War between cities | One route blocked for 2–4 turns |
| Guild dispute | Player forced to take a side; reputation effects |
| Rival merchant | NPC undercuts prices in one city for 1 turn |

---

## Open Questions

- Is 25% base event probability per turn the right rate? At this rate the player sees ~10 events in a 40-turn game — roughly every 4 turns. Higher feels chaotic; lower feels uneventful.
- Should the Storm event fire per-ship roll (each ship rolls independently) rather than one global storm hitting all ships? Per-ship feels fairer but requires multiple rolls.
- Should the player receive a preview of their odds before departing (e.g. "Winter voyage — high storm risk")?

## Related

- ADR-006 (Turn-based — events fire once per turn at resolution step 7)
- docs/design/turn-resolution-order.md (step 7: trigger event; step 8: apply effects)
- docs/design/ship-stats.md (storm deals 10 durability damage; pirate raid removes cargo)
- docs/design/mvp-scope.md (3 events in MVP)
- `src/game/systems/event-system.ts` (implementation target — does not exist yet)
