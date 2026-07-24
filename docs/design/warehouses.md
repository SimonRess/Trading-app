# Design: Warehouses

**Status:** Implemented (first pass — thresholds not yet tuned)  
**Target version:** v2

## Purpose

A passive-income real-estate layer: the player can buy a warehouse in a city and sell it back later; every owned warehouse generates a small amount of cash each turn, framed as "rented out" (no separate occupancy/vacancy mechanic in this pass — see Non-Goals). This gives the player a second income stream that isn't tied to actively sailing and trading, useful once a session has enough capital that trade-loop income alone stops being the interesting decision, and it's a natural fit for "generational" play (`family-succession.md`) — a warehouse, unlike a ship, has no durability to maintain and nothing to lose to a storm, so it's the kind of asset that plausibly survives a succession event cleanly.

## Goals (first pass)

- A genuinely passive income source — no per-turn management once bought (matches the "rented out" framing: the player isn't running the warehouse day to day).
- Meaningful but not run-dominating: warehouse income should supplement the trade loop, not replace the reason to sail.
- Symmetric buy/sell — a warehouse is a real asset with a resale value, not a one-way sink like the church-donation feature (`church-donations.md`).

## Non-Goals (this pass)

- No warehouse *storage* mechanic (using it to stash cargo, avoid market price impact, etc.) — despite the name, this is a pure income-generating asset in v2, not a cargo-management feature. A storage mechanic is a plausible v3+ extension once the reason for it (e.g. seasonal price arbitrage) is clearer.
- No per-warehouse vacancy/tenant simulation — "generate small passive income each round as they are all rented out for now" is explicit in the request; a single flat per-turn income figure, no occupancy variance.
- No warehouse upgrades/tiers — one type, one price, one income rate, matching the MVP's own "start minimal, extend later" philosophy (`mvp-scope.md`).
- No city-specific price/income variance in this first pass — see Open Questions for whether that's worth adding once the base mechanic exists.

## Mechanic

### Buying & selling

- Available from the Port view of any city (not shipyard-restricted, similar to the proposed church donations — a warehouse purchase isn't a ship transaction).
- Fixed purchase price (proposed: 1,000 Mark, needs tuning) deducted from `player.cash`; adds a warehouse entry to a new `GameState.warehouses` (or per-city list, e.g. `Record<CityId, number>` counting warehouses owned in that city, if multiple per city are allowed — see Open Questions).
- Selling returns a fraction of the purchase price (proposed: 70%, mirroring the kind of "you don't get full value back" friction `shipNetWorth`'s durability-scaling already applies to ships) rather than the full amount, so buy/sell isn't a risk-free way to park cash between trades.

### Passive income

- Each turn, `resolveTurn` adds `warehouseCount × INCOME_PER_WAREHOUSE_PER_TURN` (proposed: 15 Mark/turn per warehouse, needs tuning against the 500 Mark starting cash and 10,000 Mark win threshold) to `player.cash`, alongside the existing net-worth computation — a new step in `turn-system.ts`, same pattern as the political-rank and market-update steps already there.
- No message in the turn summary for routine income (would be noisy every single turn) — visible only via the cash figure changing, same as market price drift.

### UI

- Port view gains a small "Warehouses" section (same card pattern as Shipyard/proposed Church) — current count in this city, Buy/Sell buttons, and the per-turn income rate shown for context.

## Implementation Status (as of 2026-07-23)

- ✅ `GameState.warehouses: Partial<Record<CityId, number>>` (additive save-file field, no schema bump — defaults to `{}` for older saves).
- ✅ `executeBuyWarehouse`/`executeSellWarehouse` (`warehouse-system.ts`) and the `BUY_WAREHOUSE`/`SELL_WAREHOUSE` actions, available from any city (not shipyard-restricted). Purchase price 1,000 Mark; resale value 70% (`warehouseSellValue()`), as proposed.
- ✅ **Resolved open question:** capped at `MAX_WAREHOUSES_PER_CITY` = 3 — a deliberate cap added specifically to prevent unbounded passive income from becoming the dominant strategy, the risk this doc's own Open Questions flagged.
- ✅ `accrueWarehouseIncome` adds 15 Mark/turn per owned warehouse in `resolveTurn`. **Revised:** originally shipped silent (no turn-summary message, to avoid a noisy event every turn — matching market-price drift); a player reported that warehouse income wasn't visible anywhere, so it now reports a "Earned N Mark in warehouse income" turn-summary line whenever income was actually earned, same as every other per-turn financial effect.
- ✅ Warehouse District building: a per-city selector, owned count vs. cap, and Buy/Sell controls.
- ✅ **Resolved open question:** warehouse resale value is now folded into `computeNetWorth` — see ADR-020 (amending ADR-014 alongside ADR-019's loan-liability amendment).
- ✅ Unit tests (`warehouse-system.test.ts`, plus `turn-system.test.ts` integration tests): buy/sell cash and count accounting, per-city cap rejection, insufficient-cash rejection, income summed across cities, net-worth inclusion.
- ✅ Verified live: the Warehouse District panel correctly shows 0/3 owned per city and gates the Buy button on available cash.

## Open Questions

- Purchase price, resale fraction, and income rate (1,000 / 70% / 15 Mark/turn) are still placeholder numbers — same tuning caveat as every other economic addition so far (ADR-015, `political-rank.md`, `church-donations.md`).
- Should income vary by city (e.g. Lübeck's warehouse income higher, reflecting it being the political/economic home base) — ties into whether city-level economic identity should extend beyond just "which goods it produces."
- Does a warehouse in a city ever become unavailable (e.g. destroyed by an event, similar to a storm damaging ships)? Currently no — warehouses are the one asset class immune to the event system. Worth a deliberate call rather than an oversight once combat/events expand (ADR-010).

## Related

- ADR-018 (Feature delivery sequencing — this mechanic ships with the Warehouse District building, gated on the city-view skeleton)
- ADR-020 (Net worth includes cannon and warehouse resale value — amends ADR-014)
- `docs/design/mvp-scope.md` (out-of-scope table — target v2)
- `docs/design/family-succession.md` (warehouses as an asset class that plausibly carries cleanly across a succession event, unlike ships)
- `docs/design/church-donations.md` (sibling v1.1/v2 economic-sink/source feature, same "small new building section" UI pattern)
