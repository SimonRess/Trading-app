# Design: Turn Resolution Order

**Status:** Draft  
**Last updated:** 2026-07-14

## Purpose

Define the exact sequence of steps executed when the player ends a turn. Order matters for balance: a market update before fleet movement means ships sell into prices that already reflect this turn's production; the reverse means they sell into last turn's prices. This document locks the sequence so it cannot drift between implementation and future changes.

---

## Resolution Sequence

When the player clicks "End Turn", the following steps execute in order. All steps are pure functions on `GameState` — each step receives the state produced by the previous step.

```
1. Validate player orders
2. Advance calendar
3. Move fleet
4. Resolve arrivals
5. Update market (production & consumption)
6. Apply player trades
7. Trigger random event
8. Apply event effects
9. Check win / lose conditions
10. Emit turn summary
```

---

## Step Detail

### 1. Validate player orders
Check that all ship orders are legal (destination is reachable, cargo fits capacity). Reject illegal orders with an error shown to the player before resolution begins. Resolution does not start until all orders are valid.

*Implementation note:* Destination orders are chosen in port as **pending orders** — the ship stays docked and the player can change or cancel the order until they end the turn. `resolveTurn` applies the pending `orders.destinations` at this step (via `setDestination`), so the ship departs during resolution, not the moment the destination is clicked.

### 2. Advance calendar
`season → next season`, incrementing year when Winter rolls to Spring. Increment `turn` counter.

```
Spring → Summer → Autumn → Winter → Spring (year + 1)
```

The new season is used by all subsequent steps (storm risk, production rates).

### 3. Move fleet
For each ship with a destination order:
- Decrement `turnsRemaining` by 1
- If `turnsRemaining` reaches 0: ship arrives at destination (status changes to `in-port`)
- If `turnsRemaining > 0`: ship remains in transit

Ships already in port with no order remain idle.

### 4. Resolve arrivals
For each ship that arrived this step:
- Roll for storm damage during transit (per route, per season — see `design/city-graph.md`)
- Apply durability damage if storm occurred
- If durability reaches 0: ship is wrecked; cargo lost; player notified

Storm roll uses the season from step 2 (the new season). This means a ship arriving in Winter rolled against Winter risk — slightly punishing late-season departures.

### 5. Update market
For each city and each good:
```
supply = clamp(supply + production - consumption, 0, 100)
```
Production and consumption rates are from `design/market-formula.md`. This step runs before player trades are applied, so prices the player sees at the start of next turn already reflect this turn's natural drift.

### 6. Apply player trades
Any buy/sell orders the player placed this turn are applied now:
```
supply -= quantity_bought
supply += quantity_sold
```
Supply is clamped to [0, 100] after each trade. Player cash is adjusted accordingly at the prices from step 5.

*Note:* In MVP the player trades at the start of their turn (before ending it), so this step applies the supply delta from those trades to the market for next turn's price calculation. This means trading this turn affects prices next turn — not immediately.

### 7. Trigger random event
Roll once against the event table. A single event fires per turn at most (MVP). Probability is a flat 25% chance per turn that any event fires; if it fires, one event is selected from the active event pool.

### 8. Apply event effects
Execute the triggered event's state transformation (supply delta, ship damage, cargo loss). Events modify the state produced by steps 1–6. If no event fired in step 7, this step is a no-op.

### 9. Check win / lose conditions
Evaluate against the conditions defined in `design/mvp-scope.md`:
- **Win:** player net worth ≥ 10,000 Mark
- **Lose:** net worth ≤ 0, or `turn === maxTurns`

If a condition is met, set a `gameOver` flag in `CalendarState` and emit the result. No further turns are processed.

### 10. Emit turn summary
Collect a log of what happened this turn — ships that moved, arrived, or were damaged; event that triggered; market price changes above a threshold — and return it alongside the new state. The UI displays this as the end-of-turn summary screen.

---

## Implementation Shape

```typescript
function resolveTurn(state: GameState, orders: PlayerOrders): TurnResult {
  const s1 = validateOrders(state, orders);       // throws if invalid
  const s2 = advanceCalendar(s1);
  const s3 = moveFleet(s2, orders);
  const s4 = resolveArrivals(s3);
  const s5 = updateMarket(s4);
  const s6 = applyTrades(s5, orders);
  const [s7, event] = triggerEvent(s6);
  const s8 = applyEventEffects(s7, event);
  const [s9, outcome] = checkEndConditions(s8);
  const summary = buildTurnSummary(state, s9, event, outcome);

  return { state: s9, summary, outcome };
}
```

Each step function is independently unit-testable. `resolveTurn` is the single entry point called by `LocalGameClient.sendAction({ type: 'END_TURN', orders })`.

---

## Implementation Status (as of 2026-07-16)

The idealised 10-step sequence above is the target. The current `src/game/systems/turn-system.ts` implements a condensed version that preserves the **balance-critical ordering** (destinations → move → market → event → check) but differs in a few ways worth recording so the doc matches the code:

| Spec step | Actual behaviour |
|-----------|------------------|
| 1 Validate orders | Legality is enforced when the order is *placed* (`setDestination` returns the ship unchanged for an unreachable/occupied destination; buy/sell are validated in `executeBuy`/`executeSell`). There is no separate throwing `validateOrders` pass. |
| 3 + 4 Move fleet / arrivals | Combined in `advanceShips`, which decrements `turnsRemaining` and detects arrivals in one pass. |
| 4 Storm on arrival | **Not yet implemented as a per-route roll.** The per-route/season storm-risk table in `city-graph.md` is not consumed yet; storms currently come only from the random **event** (step 7/8), which damages all in-transit ships by 10 durability. Per-leg storm rolls are a follow-up. |
| 6 Apply player trades | **Trades are applied live, not at resolution.** The player buys/sells during their turn via `BUY_GOOD`/`SELL_GOOD` actions that update state (cash + local supply) immediately. The one-turn price-lag idea in step 6 is therefore not in effect — a trade moves the local price the same turn. |
| 7 + 8 Event / effects | Combined: `selectEvent` picks (or returns `null`), `applyEvent` applies the effect and produces player-facing messages. |
| 9 Check win/lose | `computeNetWorth` (cash + ship value + cargo-at-base-price, see **ADR-014**) compared against the thresholds. |
| 10 Emit summary | `TurnResult.summary` carries the event/arrival messages and the `outcome`. |

When any of these are brought in line with the spec (e.g. per-route storm rolls), update this table and remove the corresponding row.

---

## Key Design Choices

**Why market updates before player trades?**
Production and consumption represent the city's natural economy, independent of the player. Applying them first means the player's trades happen on top of an already-updated market — more realistic, and prevents the player from "racing" production by timing trades.

**Why storm rolls on arrival rather than departure?**
A ship that departs in Autumn and arrives in Winter should face Winter risk. Rolling on arrival with the current season captures this naturally without tracking per-leg weather history.

**Why one event per turn maximum?**
Multiple events per turn compound unpredictably and are hard to communicate clearly to the player. One event per turn keeps the summary screen readable and balance easier to tune.

---

## Open Questions

- Should storm damage roll per transit turn or once on arrival? Current proposal: once on arrival for simplicity. Per-transit-turn would be more realistic but harder to surface in the UI.
- Is 25% event probability per turn too high (nearly every turn has an event) or too low? Needs playtesting.
- Should step 6 (player trades) apply immediately to prices the same turn, or with a one-turn lag as proposed? The lag is more realistic but may confuse players.

## Related

- ADR-006 (Turn-based — all resolution happens at discrete turn boundaries)
- ADR-004 (Architecture — pure functions; resolveTurn is the canonical example)
- docs/design/market-formula.md (steps 5 & 6)
- docs/design/city-graph.md (storm risk table used in step 4)
- docs/design/mvp-scope.md (win/lose conditions used in step 9)
- `src/game/systems/turn-system.ts` (implementation target)
