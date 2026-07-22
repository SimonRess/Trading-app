# Design: Market Formula

**Status:** Draft  
**Last updated:** 2026-07-20

## Purpose

Define how good prices are calculated each turn. The market is the heart of the game — it must produce prices that feel plausible, reward route knowledge, and create meaningful buy-low/sell-high decisions without requiring complex economic modelling.

---

## Core Model

Each city tracks a **supply level** for each good. Supply is a number between 0 and 100. Price is derived from supply via a curve: high supply → low price, low supply → high price.

### Supply dynamics

Each turn, supply changes via three forces:

1. **Production:** cities that produce a good gain supply passively each turn
2. **Consumption:** cities consume goods each turn (supply decreases passively)
3. **Player trade:** buying removes supply; selling adds supply

```
supply_next = supply_current + production - consumption + player_delta + event_delta
supply_next = clamp(supply_next, 0, 100)
```

### Price formula

```
price = base_price × price_factor(supply)

price_factor(supply) = 2.0 - (supply / 50)
```

This gives:
- supply = 0 → price_factor = 2.0 → price = 2× base price (scarcity)
- supply = 50 → price_factor = 1.0 → price = base price (equilibrium)
- supply = 100 → price_factor = 0.0 → price → 0 (surplus)

To avoid absurdly low prices, clamp the price factor:

```
price_factor = clamp(2.0 - (supply / 50), 0.2, 2.0)
```

This means even a fully saturated market pays at least 20% of base price, and a completely empty market charges at most 200%.

---

## Base Prices

| Good | Base price (Mark/last) |
|------|------------------------|
| Salt | 8 |
| Grain | 6 |
| Timber | 10 |
| Furs | 20 |
| Herring | 7 |

Furs are the highest-value good — the long Riga run is the high-risk/high-reward route.

---

## Production & Consumption Rates

Values are in **supply units per turn**.

| Good | City | Production | Consumption | Notes |
|------|------|-----------|-------------|-------|
| Salt | Lübeck | +15 | −3 | Major salt producer |
| Salt | Hamburg | +10 | −3 | Secondary producer |
| Salt | Danzig | 0 | −5 | Net consumer |
| Salt | Riga | 0 | −5 | Net consumer |
| Salt | Malmö | 0 | −4 | Net consumer |
| Grain | Danzig | +18 | −4 | Breadbasket |
| Grain | Lübeck | 0 | −5 | Net consumer |
| Grain | Hamburg | 0 | −5 | Net consumer |
| Grain | Malmö | 0 | −4 | Net consumer |
| Grain | Riga | 0 | −3 | Net consumer |
| Timber | Danzig | +10 | −2 | Co-producer with Riga |
| Timber | Riga | +12 | −2 | Primary producer |
| Timber | Lübeck | 0 | −6 | Shipbuilding demand |
| Timber | Hamburg | 0 | −5 | Construction demand |
| Timber | Malmö | 0 | −3 | Net consumer |
| Furs | Riga | +10 | −1 | Only source |
| Furs | Danzig | 0 | −2 | Transit hub demand |
| Furs | Lübeck | 0 | −4 | Wealthy merchant demand |
| Furs | Hamburg | 0 | −3 | Net consumer |
| Furs | Malmö | 0 | −2 | Net consumer |
| Herring | Malmö | +18 | −3 | Dominates supply |
| Herring | Lübeck | 0 | −5 | Net consumer |
| Herring | Hamburg | 0 | −5 | Net consumer |
| Herring | Danzig | 0 | −4 | Net consumer |
| Herring | Riga | 0 | −3 | Net consumer |

### Net flow check
Each good should reach equilibrium (supply stable at ~50) in a city with no player activity. Production cities will accumulate excess and push prices down without a trader draining them — this is intentional and creates the core incentive to run routes.

---

## Starting Supply Values

Initial supply at game start. Set to approximate equilibrium so prices are not extreme at turn 1.

| Good | Lübeck | Hamburg | Danzig | Riga | Malmö |
|------|--------|---------|--------|------|-------|
| Salt | 70 | 65 | 40 | 35 | 40 |
| Grain | 40 | 35 | 75 | 45 | 45 |
| Timber | 35 | 40 | 60 | 70 | 45 |
| Furs | 50 | 45 | 45 | 75 | 50 |
| Herring | 40 | 40 | 45 | 40 | 75 |

---

## Player Trade Effect

Buying N last of a good from a city: `supply -= N`  
Selling N last of a good to a city: `supply += N`

A Kogge holds 50 last. Buying a full load of Herring from Malmö (supply 75) drops supply to 25, pushing the price factor from 0.5× to 1.5× — a significant price swing. This means a second ship buying at Malmö the same turn faces much higher prices, creating a natural capacity limit on any single route.

---

## Event Modifiers

Random events apply a one-turn delta to supply:

| Event | Effect |
|-------|--------|
| Bumper harvest | Grain supply in Danzig +30 this turn |
| Storm | No supply effect (ship damage only) |
| Pirate raid | Cargo lost from ship (supply in destination city not delivered) |

---

## Price Display

Prices shown to the player are rounded to the nearest whole Mark. The internal calculation uses floating point; rounding happens only at display time.

Show the player a trend indicator alongside the price:
- ↑ if supply dropped more than 5 units last turn (price rising)
- ↓ if supply rose more than 5 units last turn (price falling)
- — otherwise (stable)

This gives the player enough information to anticipate price movements without exposing the raw supply number.

---

## Data Model

```typescript
interface GoodMarket {
  supply: number;          // 0–100
  basePrice: number;       // Mark per last
  production: number;      // supply units added per turn
  consumption: number;     // supply units removed per turn
}

type CityMarket = Record<GoodId, GoodMarket>;

function currentPrice(market: GoodMarket): number {
  const factor = Math.max(0.2, Math.min(2.0, 2.0 - market.supply / 50));
  return Math.round(market.basePrice * factor);
}

function resolveTrade(market: GoodMarket, delta: number): GoodMarket {
  return {
    ...market,
    supply: Math.max(0, Math.min(100, market.supply - delta)),
  };
}

function resolveTurn(market: GoodMarket): GoodMarket {
  const next = market.supply + market.production - market.consumption;
  return { ...market, supply: Math.max(0, Math.min(100, next)) };
}
```

Lives in `src/game/systems/market-system.ts`. Pure functions — no side effects.

---

## Bulk-Purchase Price Pressure (Proposed, v1.1)

**Status:** Proposed — not implemented, target v1.1 (`mvp-scope.md`'s out-of-scope table)

Currently `executeBuy`/`executeSell` (`turn-system.ts`) compute one price via `currentPrice(market)` and multiply by the full quantity — a 20-unit purchase costs exactly 20× the 1-unit price, with no within-order price movement. This is the explicitly-scoped-out MVP behavior ("no bulk-purchase price bumps — direct buy/sell only"). This section proposes the v1.1 version.

### Mechanic

- Instead of one flat price for the whole order, walk `resolveTrade`'s existing supply-delta logic **unit by unit** within a single buy/sell call: each unit bought nudges supply down (raising the price-per-unit for the *next* unit in the same order, per the existing `price_factor(supply)` curve), and each unit sold nudges supply up (lowering it for the next unit). The total cost/revenue is the sum of each unit's price at its own point in that walk, not `unit_price × quantity`.
- This requires no new formula — `price_factor(supply)` and `resolveTrade`'s supply-clamping already fully describe the curve; bulk pressure is purely a change in *when* the existing curve is sampled (once per unit within an order, instead of once per order).
- Net effect: large orders get progressively worse pricing as they proceed (buying 50 units of Furs costs meaningfully more than 50× the 1-unit price), which is the entire point — it makes order *sizing* a real decision, not just a multiplier on an already-decided trade.

### Open Questions (this section)

- Performance: looping per-unit for very large orders (is there a practical quantity cap, or does the existing `cargoSpace`-bounded order size make this a non-issue in practice — likely yes, since cargo capacity is 20–100 last per ship, not thousands)?
- Should the UI show a projected total cost that reflects the walked price (not just `displayed_unit_price × quantity`) before the player commits to a large order? Almost certainly yes — showing a misleadingly-cheap flat estimate for what will actually cost more once bulk pressure applies would be a discoverability trap, not a fun surprise.

## Open Questions

- Should production/consumption rates vary by season? (e.g. Grain production only in Summer/Autumn — adds realism but more complexity)
- Is the linear price curve the right shape, or should it be steeper near 0 (panic prices at scarcity) and flatter near 100 (price floor effect)?
- The 0.2 price floor and 2.0 ceiling need playtesting to validate — are the extremes reachable in normal play, and are they fun when they happen?
- Should the player see the supply level directly, or only the trend indicator?

## Related

- ADR-004 (Architecture — pure functions on state; market state lives in the `market` domain slice)
- ADR-006 (Turn-based — supply updates fire once per turn at resolution time)
- docs/design/mvp-scope.md (5 goods, 5 cities, 3 random events)
- docs/design/city-graph.md (cities and routes that define which markets are reachable)
- `src/game/systems/market-system.ts` (implementation target)
- `src/game/data/goods.ts` (base prices, good definitions)
