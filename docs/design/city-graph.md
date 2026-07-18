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

Base storm-damage likelihood per route and season. Risk is higher on longer routes and in Winter.

| Route | Spring | Summer | Autumn | Winter |
|-------|--------|--------|--------|--------|
| Hamburg–Lübeck | 3% | 2% | 5% | 12% |
| Lübeck–Malmö | 5% | 3% | 8% | 18% |
| Lübeck–Danzig | 5% | 3% | 8% | 18% |
| Malmö–Riga | 8% | 5% | 12% | 25% |
| Danzig–Riga | 8% | 5% | 12% | 25% |

## Pirate Risk by Route & Season

Added alongside `stormRisk` so pirate raids are also route/season-sensitive (ADR-015). Pirates favour calmer seasons and longer, more remote routes — roughly the opposite seasonal curve from storms.

| Route | Spring | Summer | Autumn | Winter |
|-------|--------|--------|--------|--------|
| Hamburg–Lübeck | 2% | 4% | 3% | 1% |
| Lübeck–Malmö | 4% | 6% | 5% | 2% |
| Lübeck–Danzig | 4% | 6% | 5% | 2% |
| Malmö–Riga | 7% | 10% | 8% | 3% |
| Danzig–Riga | 7% | 10% | 8% | 3% |

Both tables feed `selectEvent`'s per-turn weighting (which event fires) and, for storms, per-ship damage magnitude, and for pirates, which ship in transit is targeted — see ADR-015 and `event-table.md` "Per-Route & Session Risk".

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
  stormRisk: {    // base storm weighting/damage input per transit turn
    spring: number;
    summer: number;
    autumn: number;
    winter: number;
  };
  pirateRisk: {   // base pirate weighting/targeting input per transit turn
    spring: number;
    summer: number;
    autumn: number;
    winter: number;
  };
}
```

Static data lives in `src/game/data/cities.ts` and `src/game/data/routes.ts`.

---

## Implementation Status (as of 2026-07-18)

- ✅ `route.turns` is used as-is for travel time. **Fixed bug:** the first implementation multiplied `route.turns` by `SHIP_TYPES[type].turnsPerLeg` in `fleet-system.ts`'s `setDestination`, silently doubling every voyage (e.g. Malmö→Riga took 6 turns in-game instead of the documented 3). Since `route.turns` already "assumes a Kogge at standard speed" (per this doc), that multiplication double-counted the Kogge's speed. Fixed by using `route.turns` directly; `turnsPerLeg` remains defined on `ShipTypeDefinition` for when a second ship type (Hulk/Schnigge) is added, but is not applied to the MVP's Kogge-only routes.
- ✅ **Both risk tables are now consumed.** `route.stormRisk` and the new `route.pirateRisk` feed `selectEvent`'s per-turn event-type weighting and the storm-damage/pirate-target math in `event-system.ts`. See ADR-015 for the full mechanism, including the session-persistent regional modifiers layered on top of these static tables.
- ⚠️ The mechanism is **not** "roll each transit turn independently against the raw percentage in the table above", as the phrase "Storm checks roll once per turn a ship spends in transit" in earlier drafts of this doc implied. Instead, the tables are used as *relative danger factors* (normalised against the network-wide average) that bias which event fires out of the existing 25%-per-turn/weighted-pool selection, and separately scale per-ship storm damage and pirate targeting odds. This preserves the original event-type balance (storm vs. pirate vs. harvest roughly comparable in frequency) while still making dangerous routes meaningfully more dangerous. See ADR-015 "Alternatives Considered" for why the literal per-leg-per-ship independent-roll design was not used.

## Open Questions

- Should Malmö–Danzig be a direct route (saves the Lübeck detour)? Would add a ~3-turn cross-Baltic option but reduces Lübeck's hub dominance.
- Are 2-turn coastal hops too fast — should the Hamburg–Lübeck leg be 1 turn to make short western routes feel snappier?
- Storm and pirate probability values need playtesting — they are estimates, not validated numbers.

## Related

- ADR-006 (Turn-based — sailing is measured in discrete turns, not real time)
- ADR-015 (Per-route & session event risk — how these tables are actually used)
- docs/design/mvp-scope.md (5-city scope; Kogge travel speed; storm event definition)
- docs/design/market-formula.md (city supply/demand influences prices; routes determine which cities the player can reach)
- docs/design/event-table.md (event selection, damage, and targeting formulas)
- `src/game/data/cities.ts`, `src/game/data/routes.ts` (implementation)
