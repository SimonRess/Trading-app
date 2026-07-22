# Design: Church Building & Donations

**Status:** Implemented (first pass — thresholds not yet tuned)  
**Target version:** v1.1

## Purpose

Each of the 5 cities starts with a church under construction, at a different completion percentage. The player can donate cash toward a city's church; donations advance its completion proportionally and raise the player's standing (reputation) in that city. This gives cash a second sink beyond ship purchases/repairs, and gives `PlayerState.reputation` — already implemented and feeding political rank (`political-rank.md`) — a second, direct way to be earned besides trading, tying two systems together rather than adding an isolated one.

## Goals (first pass)

- A tangible, visible per-city project the player can choose to fund.
- Donating is a legible, proportional exchange: more Mark in → more completion % and more reputation out, no hidden curve.
- Reuses the existing `reputation` mechanism (`political-system.ts`) instead of introducing a second, parallel "popularity" stat — one number per city, multiple ways to move it.

## Non-Goals (this pass)

- No gameplay effect from a *finished* church beyond the reputation already earned getting there — no unlocked buildings, no city-wide bonus. A finished church is a milestone the reputation gain already paid for; keeping it inert avoids needing to design and balance a whole "city benefits" system for v1.1.
- No competitive/multiplayer angle (rival merchants funding the same church) — matches ADR-007 (multiplayer deferred to v3).
- No decay — a church's completion percentage only goes up, same one-way-progress spirit as political rank.

## Mechanic

### Starting state

- Each city gets a `churchCompletion: number` (0–100), seeded with a different starting value per city in `starting-config.ts` (proposed spread: Lübeck 60 — the political home base starts further along — others 15–35, varied so the player sees different funding opportunities across the map from turn 1).
- New `CityState` field: `CitiesState` (`types.ts`) already exists per-city (currently just `{ id: CityId }`); `churchCompletion` slots in there naturally.

### Donating

- `DONATE_CHURCH { cityId, amount }` action (`game-client.ts`), handled by `donateChurch()` in a new `church-system.ts`, not shipyard-restricted — a church donation isn't a ship transaction and needs no ship present at all.
- `amount` Mark deducted from `player.cash`. Rejected (state returned unchanged) if `amount` isn't a positive finite number or exceeds current cash — same validation shape as `executeBuy`/`executeSell`.
- Completion increases by `amount / DONATION_COST_PER_PERCENT` (**implemented as 50** Mark per 1%, so fully funding a church from 0% costs 5,000 Mark), clamped at 100.
- Reputation in that city increases via the *same* `gainReputation()` used for sales (`political-system.ts`), now generalised to take an optional `amount` parameter (defaulting to the flat per-sale gain) rather than a second function — `+round(amount / REPUTATION_COST_PER_POINT)`, **implemented as 100** Mark per reputation point.

### UI

- Donations happen through the City view's Church building (`docs/design/city-view.md`), not a Port-screen text section — this was written before the City view existed; the mechanic now ships with its own building per ADR-018, superseding the original "Port view gains a small section" plan.
- The panel includes a city selector (donations aren't restricted to wherever a ship happens to be — the player can fund any city's church from the same panel) and a progress bar, not just a numeric readout, matching the map's existing philosophy of surfacing state visually.
- **Deviation from the original plan:** donations are an immediate action (like buy/sell), not something resolved during `resolveTurn` — there is no `TurnSummary` to append a "crossing 100%" event to at the moment it happens. Implemented instead as an inline banner in the Church panel itself ("🎉 The Church of {city} was just completed!"), tracked by a small `churchJustCompleted` UI-only variable in `App.svelte` (never persisted, cleared on closing the panel or switching cities) rather than the `TurnSummary.events` mechanism.

## Implementation Status (as of 2026-07-22)

- ✅ `CityState.churchCompletion`, seeded per city in `starting-config.ts` (Lübeck 60, Hamburg 25, Danzig 30, Riga 15, Malmö 20). Additive save-file field — no schema bump; `save-system.ts` defaults missing values to the same starting seed for older saves.
- ✅ `donateChurch()` (`church-system.ts`) and the `DONATE_CHURCH` action, wired through `LocalGameClient`.
- ✅ Church building in the City view: progress bar, city selector, donate input, completion messaging.
- ✅ Unit tests (`church-system.test.ts`): cash deduction, proportional completion, per-city isolation, 100% clamping, reputation gain, invalid-amount/insufficient-cash rejection, no-mutation.
- ✅ Verified live: donating 100 Mark to Lübeck's church (starting 60%) advanced it to 62% and deducted cash; fully funding a church shows the completion banner and hides the donate form; switching cities in the panel shows each city's independent progress.

## Open Questions

- Donation-to-completion and donation-to-reputation rates (50 Mark/1%, 100 Mark/reputation point) are still first-pass numbers, not simulation-tuned — same caution flagged in every other system doc so far (ADR-015, `political-rank.md`).
- Should church completion be visible on the Map view (e.g. a small progress ring on each city icon), or only in the City view's Church building? Leaning City-view-only for now, consistent with the "at-a-glance building state" Open Question already flagged in `city-view.md`.
- Multiple players donating to the same church only matters once multiplayer exists (v3, ADR-007) — no design needed now, but worth a one-line note in ADR-007's future revision when that work starts.

## Related

- ADR-018 (Feature delivery sequencing — this mechanic ships with the Church building, gated on the city-view skeleton)
- `docs/design/political-rank.md` (the `reputation` mechanism this reuses)
- `src/game/state/types.ts` (`CityState`, `PlayerState.reputation`)
- `src/game/systems/political-system.ts` (`gainReputation`)
