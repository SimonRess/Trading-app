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

- `DONATE_CHURCH { cityId, amount }` action (`game-client.ts`), handled by `donateChurch()` in `church-system.ts`, not shipyard-restricted — a church donation isn't a ship transaction and needs no ship present at all.
- `amount` Mark deducted from `player.cash` **immediately**, and reputation in that city is granted **immediately** via the *same* `gainReputation()` used for sales (`political-system.ts`), generalised to take an optional `amount` parameter — `+round(amount / REPUTATION_COST_PER_POINT)`, **implemented as 100** Mark per reputation point. Rejected (state returned unchanged) if `amount` isn't a positive finite number, exceeds current cash, or the city has no remaining capacity (already at 100%) — same validation shape as `executeBuy`/`executeSell`.
- **Completion itself does not move at donation time.** The donated amount (capped at the city's remaining capacity — `(100 - churchCompletion) * 50` Mark) is added to a new `CityState.churchPledged` pool instead. Pledged funds are converted into `churchCompletion` gradually during turn resolution — see "Throttled progress" below.

### Throttled progress (revised 2026-07-23)

- **Original first pass had donations apply instantly** (donate 100 Mark → completion moves the same turn, no delay). Player feedback after actually donating: *"I have donated 300 money to church in Lübeck but the church's progress didn't change. How long does it take to see the progress?"* — followed by an explicit request for a delay mechanic: completion should advance by at most 1% per turn, spreading a large donation over several turns instead of applying it all at once.
- Implemented as a two-step flow: `donateChurch()` moves cash/reputation immediately and adds to `churchPledged`; a new `advanceChurchProgress(cities)` in `church-system.ts` runs once per turn inside `resolveTurn` (Step 5b, before the political-rank check) and converts at most `PROGRESS_CAP_PER_TURN` (**1** percentage point = 50 Mark) of each city's pledged pool into `churchCompletion`, carrying any remainder in `churchPledged` for the next turn.
- This directly answers the "how long" question: **progress becomes visible starting from the next turn the player ends, not at the moment of donation, by design.** A 300 Mark donation (6 percentage points) takes 6 turns to fully land.
- When a city's pledged conversion pushes `churchCompletion` to 100 for the first time, `advanceChurchProgress` reports it in `completedCities`, and `resolveTurn` appends a `TurnSummary` event ("⛪ The Church of {city} was completed, thanks in part to your generosity.") — completion is now a genuine turn-summary event rather than the earlier UI-only banner (below).

### UI

- Donations happen through the City view's Church building (`docs/design/city-view.md`), not a Port-screen text section.
- The panel includes a city selector (donations aren't restricted to wherever a ship happens to be — the player can fund any city's church from the same panel) and a two-segment progress bar: a solid fill for `churchCompletion` and a hatched overlay for pledged-but-not-yet-converted funds, so the player can see both "done" and "in flight" at a glance.
- While a city has `churchPledged > 0`, the panel shows a note: "{N} Mark pledged, arriving at up to 1% per turn (~{turns} more turns)".
- **Superseded:** the original plan's inline "just completed" banner and its UI-only `churchJustCompleted` variable in `App.svelte` are removed — completion is now driven by the genuine `TurnSummary.events` mechanism (see above), so the panel just reflects `churchCompletion >= 100` directly instead of tracking a transient flag.

## Implementation Status (as of 2026-07-23)

- ✅ `CityState.churchCompletion` and `CityState.churchPledged`, seeded per city in `starting-config.ts` (Lübeck 60, Hamburg 25, Danzig 30, Riga 15, Malmö 20; `churchPledged` starts at 0 everywhere). Both additive save-file fields — no schema bump; `save-system.ts` defaults missing values (starting seed for `churchCompletion`, 0 for `churchPledged`) for older saves.
- ✅ `donateChurch()` and `advanceChurchProgress()` (`church-system.ts`), the `DONATE_CHURCH` action wired through `LocalGameClient`, and `advanceChurchProgress` called once per turn from `resolveTurn` (`turn-system.ts`).
- ✅ Church building in the City view: two-segment progress bar (complete + pledged), city selector, donate input, pledged-funds note, completion messaging via `TurnSummary`.
- ✅ Unit tests: `church-system.test.ts` covers `donateChurch` (cash deduction, pledging without immediate completion, per-city isolation, capacity capping, rejection at 100%, reputation gain, cash-limited donations, invalid-amount rejection, no-mutation) and `advanceChurchProgress` (no-op with nothing pledged, 1%/turn cap, multi-turn spreading, `completedCities` reported only on the turn 100% is first reached, no-mutation); `turn-system.test.ts` has an integration test confirming a turn resolves a pledge into completion and announces it.
- ✅ Verified live: donating 300 Mark to Lübeck's church (starting 60%) left completion at 60% immediately (cash correctly deducted) with a "300 Mark pledged... (~6 more turns)" note; after one End Turn, completion advanced to 61% and the note updated to "250 Mark pledged... (~5 more turns)", confirming the 50-Mark-per-turn throttle across a real turn-resolution cycle.

## Open Questions

- Donation-to-completion and donation-to-reputation rates (50 Mark/1%, 100 Mark/reputation point) are still first-pass numbers, not simulation-tuned — same caution flagged in every other system doc so far (ADR-015, `political-rank.md`).
- Should church completion be visible on the Map view (e.g. a small progress ring on each city icon), or only in the City view's Church building? Leaning City-view-only for now, consistent with the "at-a-glance building state" Open Question already flagged in `city-view.md`.
- Multiple players donating to the same church only matters once multiplayer exists (v3, ADR-007) — no design needed now, but worth a one-line note in ADR-007's future revision when that work starts.

## Related

- ADR-018 (Feature delivery sequencing — this mechanic ships with the Church building, gated on the city-view skeleton)
- `docs/design/political-rank.md` (the `reputation` mechanism this reuses)
- `src/game/state/types.ts` (`CityState`, `PlayerState.reputation`)
- `src/game/systems/political-system.ts` (`gainReputation`)
