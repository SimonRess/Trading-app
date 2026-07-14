# Design: Starting Scenario

**Status:** Draft (values subject to change after first playtesting)  
**Last updated:** 2026-07-14

## Purpose

Define the exact game state at the start of a new game. This is the seed passed to `newGame()` in `src/game/systems/game-system.ts`. Every value here is a tuning parameter — they will be adjusted after playtesting.

---

## Player

| Field | Value |
|-------|-------|
| Name | Entered by player at new game screen |
| Starting city | Lübeck |
| Cash | 500 Mark |
| Age | 22 |
| Reputation (Lübeck) | 20 / 100 |
| Reputation (all other cities) | 10 / 100 |
| Political rank | Citizen (rank 0) |

---

## Fleet

One ship at game start.

| Field | Value |
|-------|-------|
| Type | Kogge |
| Name | Player-chosen or default "Wulf von Lübeck" |
| Cargo capacity | 50 last |
| Durability | 100 / 100 |
| Position | Lübeck (in port) |
| Status | Idle |

### Starting cargo

| Good | Amount |
|------|--------|
| Salt | 20 last |

Salt is the starting cargo because it is produced in Lübeck — the player's home city — and consumed everywhere else. It gives the player an immediately actionable first move: sail to Hamburg, Danzig, or Malmö and sell.

Market value of starting cargo: ~160 Mark (20 last × 8 Mark base price at near-equilibrium supply).

Total starting net worth: 500 + 160 = ~660 Mark.

---

## Calendar

| Field | Value |
|-------|-------|
| Year | 1320 |
| Season | Spring |
| Turn number | 1 |
| Turns remaining | 40 |

Year 1320 is historically within the Hanseatic League's peak period and gives the game a concrete setting without requiring explanation.

---

## Market — Starting Supply Levels

Taken from `design/market-formula.md`. Set near equilibrium so prices are not extreme at turn 1.

| Good | Lübeck | Hamburg | Danzig | Riga | Malmö |
|------|--------|---------|--------|------|-------|
| Salt | 70 | 65 | 40 | 35 | 40 |
| Grain | 40 | 35 | 75 | 45 | 45 |
| Timber | 35 | 40 | 60 | 70 | 45 |
| Furs | 50 | 45 | 45 | 75 | 50 |
| Herring | 40 | 40 | 45 | 40 | 75 |

### Implied starting prices (Mark per last)

Using `price = base × clamp(2.0 − supply/50, 0.2, 2.0)`:

| Good | Base | Lübeck | Hamburg | Danzig | Riga | Malmö |
|------|------|--------|---------|--------|------|-------|
| Salt | 8 | 5 | 6 | 10 | 10 | 10 |
| Grain | 6 | 8 | 8 | 3 | 7 | 7 |
| Timber | 10 | 13 | 12 | 8 | 6 | 11 |
| Furs | 20 | 20 | 22 | 22 | 10 | 20 |
| Herring | 7 | 9 | 9 | 8 | 9 | 4 |

Profitable opening moves visible from these prices:
- Salt: buy in Lübeck (5 Mark) → sell in Danzig or Riga (10 Mark) — 2× margin
- Herring: buy in Malmö (4 Mark) → sell anywhere else (8–9 Mark) — 2× margin
- Furs: buy in Riga (10 Mark) → sell in Hamburg or Danzig (22 Mark) — but Riga is 5 turns away

---

## Win / Lose Conditions

| Condition | Value |
|-----------|-------|
| Win threshold | 10,000 Mark net worth |
| Turn limit | 40 turns |
| Lose condition | Net worth ≤ 0 at any turn end, or turn limit reached without winning |

Net worth = cash + (ship count × 400 Mark Kogge base value) + cargo value at current market prices.

---

## TypeScript Interface

```typescript
// src/game/data/starting-config.ts

export const STARTING_CONFIG = {
  calendar: {
    year: 1320,
    season: 'spring' as Season,
    turn: 1,
    maxTurns: 40,
  },
  player: {
    cash: 500,
    age: 22,
    politicalRank: 0,
    reputation: {
      lubeck: 20,
      hamburg: 10,
      danzig: 10,
      riga: 10,
      malmo: 10,
    },
  },
  fleet: [
    {
      type: 'kogge',
      durability: 100,
      position: 'lubeck',
      cargo: { salt: 20 },
    },
  ],
  winThreshold: 10_000,
} as const;
```

---

## Open Questions

- Is 500 Mark starting cash too tight or too generous? (Needs playtesting)
- Should starting reputation in Lübeck be higher — the player is from here?
- Is 40 turns (10 years) the right game length, or does it feel too short/long?
- Should the player name their ship, or is a default name sufficient?

## Related

- docs/design/mvp-scope.md (win condition, city list, ship types)
- docs/design/market-formula.md (price formula used for implied prices above)
- docs/design/city-graph.md (travel times that determine first-turn route options)
- `src/game/data/starting-config.ts` (implementation target)
