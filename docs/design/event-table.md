# Design: Event Probability Table

**Status:** Draft  
**Last updated:** 2026-07-18

## Purpose

Define every random event in the MVP: when it can fire, how likely it is, and exactly what state change it applies. Events fire in step 7 of turn resolution (see `docs/design/turn-resolution-order.md`).

---

## Event System Rules

- **One event per turn maximum** (MVP)
- **Base trigger probability:** 25% per turn that any event fires at all
- If an event fires, one is selected from the **active pool** — events that are currently eligible given game state and season
- Each event in the pool has a **weight**; selection is weighted random
- Events that have no eligible targets (e.g. a storm event when no ship is in transit) are excluded from the pool before selection
- As of ADR-015, pool weights, storm damage, and pirate targeting are also shaped by **per-route/city risk** — see "Per-Route & Session Risk" below

---

## MVP Event Pool

### Event 1 — Storm

| Field | Value |
|-------|-------|
| **ID** | `storm` |
| **Description** | A storm batters ships in the Baltic |
| **Seasons** | All; higher weight in Autumn and Winter |
| **Eligibility** | At least one player ship is currently in transit |
| **Base weight** | Spring: 2 · Summer: 1 · Autumn: 3 · Winter: 5 (scaled by route risk — see below) |
| **Effect** | Each ship currently in transit takes **6–22 durability damage**, varying by that ship's own route risk and durability status (not a flat 10 to everyone) |
| **Player message** | "⛈️ A violent storm swept the Baltic. Your ships at sea took damage." (or, if a ship is wrecked: "⛈️ A violent storm swept the Baltic. [ship name(s)] sank with all cargo.") |

Notes:
- All ships currently in transit take damage when a storm fires; the *amount* differs per ship (see the damage formula below), not just an on/off hit
- A ship reduced to 0 durability is wrecked: cargo lost, ship removed from fleet
- A Worn or Damaged ship (ship-stats.md durability thresholds) takes extra damage in a storm on top of its route risk

---

### Event 2 — Bumper Harvest

| Field | Value |
|-------|-------|
| **ID** | `bumper_harvest` |
| **Description** | An exceptional harvest floods Danzig with grain |
| **Seasons** | Summer, Autumn only |
| **Eligibility** | Always (no target required) |
| **Base weight** | Summer: 2 · Autumn: 3 (scaled by Danzig's city risk modifier) |
| **Effect** | Grain supply in Danzig: `+round(30 × cityRiskModifier(danzig))` (clamped to 100) |
| **Player message** | "🌾 A bumper harvest in the east — grain prices in Danzig collapsed." |

Notes:
- Supply spike lasts only this turn's market update; subsequent turns return to normal production/consumption drift
- Effective price impact: Danzig grain moves from ~3 Mark/last toward the 2 Mark floor
- The bonus size (not just the trigger chance) scales with Danzig's current city risk modifier — a particularly good season yields more than +30

---

### Event 3 — Pirate Raid

| Field | Value |
|-------|-------|
| **ID** | `pirate_raid` |
| **Description** | Pirates intercept one of the player's ships |
| **Seasons** | All; lower weight in Winter (pirates don't like storms either) |
| **Eligibility** | At least one player ship is currently in transit |
| **Base weight** | Spring: 2 · Summer: 3 · Autumn: 2 · Winter: 1 (scaled by route risk — see below) |
| **Effect** | The targeted ship loses **15% of its total cargo** (rounded down, per good proportionally) |
| **Player message** | "🏴‍☠️ Pirates intercepted the [ship name]! Part of the cargo was seized." |

Notes:
- Target ship is chosen by **weighted random** among ships in transit, weighted by each ship's route pirate-risk (`route.pirateRisk[season] × routeRiskModifier`) — a ship on a dangerous route is more likely to be the one targeted, not picked uniformly
- Cargo loss is proportional across all goods in the hold (e.g. 20 last salt + 10 last grain → lose 3 salt + 1 grain)
- In MVP the player cannot fight back (combat is v2); pirate raid is always a partial loss

---

## Message Icons

Every player-facing message (event messages here, plus the ship-arrival message emitted by `turn-system.ts`) starts with an icon identifying what happened, so a player scanning the turn summary can tell events apart at a glance:

| Message | Icon |
|---------|------|
| Ship arrival (not an event — emitted every turn a ship arrives) | ⚓ |
| Storm | ⛈️ |
| Bumper harvest | 🌾 |
| Pirate raid | 🏴‍☠️ |

The icon is baked into the message string itself (not added by the UI), so it survives regardless of which surface renders `TurnSummary.events`.

---

## Per-Route & Session Risk (ADR-015)

Two additions on top of the base seasonal weights above:

**1. Route/city risk data.** `routes.ts` defines `stormRisk` and `pirateRisk` per route per season (see `city-graph.md`); Danzig has an implicit "harvest risk" via its city modifier. These represent how dangerous *that specific route or city* currently is.

**2. Session-persistent regional modifiers.** `GameState.risk` (`RiskState`) holds a multiplier (starting at 1.0) per route and per harvest-eligible city. Each turn, `driftRiskState` nudges every modifier by a small random amount (±0.08, clamped to [0.5, 1.8]) — a bounded random walk representing "this area has gotten more/less dangerous lately," entirely automatic, with no player configuration.

**How they combine into the pool weight** (`selectEvent` in `event-system.ts`):

```
routeFactor = clamp((route.stormRisk[season] × routeRiskModifier) / networkAverageStormRisk, 0.3, 3.0)
durabilityBump = durabilityStormChancePenalty(ship.durability) × 2   // 0, 0.1, or 0.2

stormPoolWeight   = STORM_WEIGHTS[season]   × average(routeFactor + durabilityBump, over ships in transit)
pirateWeight      = PIRATE_WEIGHTS[season]  × average(pirateRouteFactor, over ships in transit)
harvestPoolWeight = HARVEST_WEIGHTS[season] × cityRiskModifier(danzig)
```

Dividing by the network-wide average (`networkAverageStormRisk` / `networkAveragePirateRisk` — the mean of every route's risk value across all seasons) turns the raw route probability into a *relative danger factor centred on 1.0*: an average route/season keeps the original tuned weight from the table above; a route twice as risky as average doubles it. This was a deliberate fix — multiplying the raw 0.01–0.25 probabilities directly into the 1–5 integer weight scale was tried first and badly skewed the event mix toward harvest (measured: harvest jumped to 4.65 events/40-turn game while storms fell). See ADR-015 "Alternatives Considered" for the full story.

**Storm damage formula** (`stormDamageForShip`, applied once storm is the selected event, per ship in transit):

```
routeBonus      = round(route.stormRisk[season] × routeRiskModifier × 25)
durabilityBonus = round(durabilityStormChancePenalty(ship.durability) × 100)   // 0, 5, or 10
damage          = clamp(10 + routeBonus + durabilityBonus, 6, 22)
```

**Pirate targeting** (`pickPirateTarget`, applied once pirate raid is the selected event): weighted-random choice among ships in transit, weight = `max(0.01, route.pirateRisk[season] × routeRiskModifier)`.

---

## Resolution Algorithm

```typescript
function selectEvent(state: GameState): EventId | null {
  if (Math.random() > 0.25) return null;  // no event this turn

  const season = state.calendar.season;
  const shipsInTransit = state.fleet.ships.filter(isInTransit);

  const pool: Array<{ id: EventId; weight: number }> = [];

  if (shipsInTransit.length > 0) {
    pool.push({
      id: 'storm',
      weight: STORM_WEIGHTS[season] * averageShipRisk(state.fleet.ships, state.risk, season, 'storm'),
    });
    pool.push({
      id: 'pirate_raid',
      weight: PIRATE_WEIGHTS[season] * averageShipRisk(state.fleet.ships, state.risk, season, 'pirate'),
    });
  }

  if (season === 'summer' || season === 'autumn') {
    pool.push({
      id: 'bumper_harvest',
      weight: HARVEST_WEIGHTS[season] * cityRiskModifier(state.risk, 'danzig'),
    });
  }

  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) return null;

  let pick = Math.random() * total;
  for (const entry of pool) {
    pick -= entry.weight;
    if (pick <= 0) return entry.id;
  }

  return pool[pool.length - 1]?.id ?? null;
}
```

Once an event type is selected, `applyEvent` computes the concrete effect (per-ship storm damage, weighted pirate target, harvest bonus size) using the formulas above.

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
- ~~Should the Storm event fire per-ship roll (each ship rolls independently) rather than one global storm hitting all ships?~~ Resolved by ADR-015: storm damage is now per-ship (varies by route/durability), though it is still gated by the single "storm was the selected event this turn" roll rather than fully independent per-ship trials — see ADR-015 for why the literal independent-roll design was rejected.
- Should the player receive a preview of their odds before departing (e.g. "Winter voyage — high storm risk")? Still open — the map view (`map-view.md`) could show route risk color-coding as a future pass.
- The route/pirate risk tables and the `driftRiskState` tuning constants (drift step, clamp bounds) are estimates pending playtesting.

## Related

- ADR-006 (Turn-based — events fire once per turn at resolution step 7)
- ADR-015 (Per-route & session event risk — the mechanism described above)
- docs/design/turn-resolution-order.md (step 7: trigger event; step 8: apply effects; risk drift as step 4b)
- docs/design/ship-stats.md (durability thresholds feeding the storm-damage bonus)
- docs/design/city-graph.md (stormRisk/pirateRisk source tables)
- docs/design/mvp-scope.md (3 events in MVP)
- `src/game/systems/event-system.ts`, `src/game/systems/risk-system.ts` (implementation)
