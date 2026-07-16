# Design: City Graph & Routes

**Status:** Draft  
**Last updated:** 2026-07-13

## Purpose

Define the five MVP cities, their geographic positions on the map, and the travel time in turns between each connected pair. This is the static data that drives the sailing system — every ship movement, route decision, and seasonal storm risk derives from this graph.

---

## Cities

| ID | Name | Region | Role in trade |
|----|------|--------|---------------|
| `lubeck` | Lübeck | Western Baltic | Starting city; salt; political home base |
| `hamburg` | Hamburg | North Sea coast | Wine, salt; western gateway |
| `danzig` | Danzig | Eastern Baltic | Grain, timber; eastern gateway |
| `riga` | Riga | Gulf of Riga | Furs; far north-east; high-value destination |
| `malmo` | Malmö | Øresund strait | Herring; controls the strait |

---

## Route Graph

Travel time is measured in **turns** (1 turn = 1 season). Times assume a Kogge at standard speed with minimum crew. All routes are bidirectional and symmetric.

```
Hamburg ──2── Lübeck ──2── Malmö
                │               │
               2│              3│
                │               │
              Danzig ────3──── Riga
```

### Route table

| From | To | Turns | Notes |
|------|----|-------|-------|
| Hamburg | Lübeck | 2 | Coastal hop; core western route |
| Lübeck | Malmö | 2 | Through the Belt; common herring run |
| Lübeck | Danzig | 2 | Main Baltic trunk route |
| Malmö | Riga | 3 | Long northern passage; higher storm risk |
| Danzig | Riga | 3 | Eastern Baltic run |

### Non-direct routes (no direct connection)
Players must route through intermediate cities:

| From | To | Shortest path | Total turns |
|------|----|---------------|-------------|
| Hamburg | Danzig | Hamburg → Lübeck → Danzig | 4 |
| Hamburg | Malmö | Hamburg → Lübeck → Malmö | 4 |
| Hamburg | Riga | Hamburg → Lübeck → Danzig → Riga | 7 |
| Malmö | Danzig | Malmö → Lübeck → Danzig | 4 |

Lübeck is the natural hub — the player's home city is also the geographic centre of the network. This creates a meaningful early decision: stay close to home for fast turns, or commit to longer eastern routes for higher-margin goods.

---

## Map Coordinates

Normalised to a 1000×700 canvas (origin top-left, x increases east, y increases south). These are approximate geographic positions scaled for gameplay readability — not historically precise.

| City | x | y |
|------|---|---|
| Hamburg | 180 | 340 |
| Lübeck | 320 | 310 |
| Malmö | 390 | 200 |
| Danzig | 580 | 280 |
| Riga | 720 | 180 |

---

## Storm Risk by Route & Season

Storm damage (5 durability per event, see design/mvp-scope.md) has a base probability per leg per turn. Risk is higher on longer routes and in Winter.

| Route | Spring | Summer | Autumn | Winter |
|-------|--------|--------|--------|--------|
| Hamburg–Lübeck | 3% | 2% | 5% | 12% |
| Lübeck–Malmö | 5% | 3% | 8% | 18% |
| Lübeck–Danzig | 5% | 3% | 8% | 18% |
| Malmö–Riga | 8% | 5% | 12% | 25% |
| Danzig–Riga | 8% | 5% | 12% | 25% |

Storm checks roll once per turn a ship spends in transit on that leg. A Kogge travelling Danzig→Riga in Winter has a 25% chance of taking 5 durability damage on each of its 3 transit turns.

---

## Data Model

```typescript
interface City {
  id: string;
  name: string;
  position: { x: number; y: number };
}

interface Route {
  from: string;   // city id
  to: string;     // city id
  turns: number;  // travel time in turns (bidirectional)
  stormRisk: {    // probability of storm damage per transit turn
    spring: number;
    summer: number;
    autumn: number;
    winter: number;
  };
}
```

Static data lives in `src/game/data/cities.ts` and `src/game/data/routes.ts`.

---

## Open Questions

- Should Malmö–Danzig be a direct route (saves the Lübeck detour)? Would add a ~3-turn cross-Baltic option but reduces Lübeck's hub dominance.
- Are 2-turn coastal hops too fast — should the Hamburg–Lübeck leg be 1 turn to make short western routes feel snappier?
- Storm probability values need playtesting — they are estimates, not validated numbers.

## Related

- ADR-006 (Turn-based — sailing is measured in discrete turns, not real time)
- docs/design/mvp-scope.md (5-city scope; Kogge travel speed; storm event definition)
- docs/design/market-formula.md (city supply/demand influences prices; routes determine which cities the player can reach)
- `src/game/data/cities.ts` (implementation target)
- `src/game/data/routes.ts` (implementation target)
