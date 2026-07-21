# Design: Church Building & Donations

**Status:** Proposed — not implemented  
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

- New action, e.g. `DONATE_CHURCH { cityId, amount }`, available from the port view of any city (not shipyard-restricted — a church donation isn't a ship transaction).
- `amount` Mark deducted from `player.cash`.
- Completion increases by `amount / DONATION_COST_PER_PERCENT` (proposed constant, needs tuning — e.g. 50 Mark per 1%, so fully funding a church from 0% costs 5,000 Mark, a significant but not run-dominating sink relative to the 10,000 Mark win threshold), clamped at 100.
- Reputation in that city increases via the *same* `gainReputation()` used for sales (`political-system.ts`), proportional to the amount donated rather than the flat +1 per sale — e.g. `+round(amount / REPUTATION_COST_PER_POINT)`, a separate, larger-amount-appropriate rate from the flat per-sale gain.

### UI

- Port view gains a small "Church of {city}" section (alongside the existing Shipyard section, following the same card/pattern) showing current completion % and a donate input + button.
- Crossing 100% triggers a one-line turn-summary event ("⛪ The Church of {city} was completed, thanks in part to your generosity.") — reuses the existing `TurnSummary.events` mechanism, no new UI surface needed.

## Open Questions

- Donation-to-completion and donation-to-reputation rates are placeholder numbers, not tuned — same caution flagged in every other system doc so far (ADR-015, `political-rank.md`).
- Should church completion be visible on the Map view (e.g. a small progress ring on each city icon), or only in the Port view? Leaning Port-view-only for v1.1 to avoid another map-rendering feature; revisit if it turns out invisible/easy to forget.
- Multiple players donating to the same church only matters once multiplayer exists (v3, ADR-007) — no design needed now, but worth a one-line note in ADR-007's future revision when that work starts.

## Related

- `docs/design/political-rank.md` (the `reputation` mechanism this reuses)
- `src/game/state/types.ts` (`CityState`, `PlayerState.reputation`)
- `src/game/systems/political-system.ts` (`gainReputation`)
