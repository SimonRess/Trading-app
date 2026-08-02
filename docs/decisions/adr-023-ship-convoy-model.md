# ADR-023: Ship Convoy Data Model and Ship-Addressing Change

**Date:** 2026-08-02
**Status:** Proposed
**Deciders:** Simon

## Context

`docs/design/ship-convoys.md` specifies grouping several ships into a convoy that travels, fights, and trades as one unit while still allowing per-ship repair/crew/cannon actions. Every existing player action in this codebase — `SET_DESTINATION`, `BUY_GOOD`/`SELL_GOOD`, combat targeting, the fleet panel's UI — is written to address exactly one `Ship` by id (`shipId` on nearly every `GameAction` variant; `App.svelte`'s `selectedShipId`/`activeShip` reactive pair driving almost the entire Port/Harbor screen). Convoys need some ship groupings to be addressable as a single unit (destination, combat, goods trade) while individual ships inside a group remain addressable for other actions (repair, crew, cannons) — a genuine architectural fork in "what does an action apply to," not just a new feature bolted onto the existing shape.

This decision needs to happen before implementation starts, per `00_project_structure.md` §5 rule 2 ("New architectural choice? → Write an ADR before writing code"), since the choice made here determines how every one of `fleet-system.ts`'s `Ship[]`-addressed functions, and `App.svelte`'s ship-selection UI, needs to change.

## Decision

**`Ship` itself is unchanged.** No `convoyId` field is added to it, and every existing `Ship`-addressed action (`REPAIR_SHIP`, `HIRE_CREW`, `BUY_CANNON`, `RENAME_SHIP`, `TOGGLE_INSURANCE`, `SET_POSTURE` when unconvoyed, `AUCTION_SHIP`) continues to work exactly as today, unmodified.

**`FleetState` gains a parallel `convoys: Convoy[]` list:**

```typescript
interface Convoy {
  id: string;
  name: string;
  shipIds: string[];   // membership — the only place convoy membership is recorded
  posture: Ship['posture'];
}

interface FleetState {
  ships: Ship[];        // unchanged
  convoys: Convoy[];     // additive
}
```

A ship's convoy membership is looked up by scanning `convoys` for a `shipIds` match — there is no back-reference on `Ship`. This mirrors the existing pattern this codebase already uses for every other grouping relationship (`CityEffect[]` referencing cities/goods by id, `PendingSuccession.candidates` referencing children by id) rather than introducing the first normalized foreign-key-style reference in the state shape.

**Three new, convoy-addressed actions are added alongside the existing ship-addressed ones**, not replacing them:
- `SET_CONVOY_DESTINATION { convoyId, destination }` — parallels `SET_DESTINATION`, applies to every member ship
- `SET_CONVOY_POSTURE { convoyId, posture }` — parallels `SET_POSTURE`
- `CONVOY_BUY_GOOD` / `CONVOY_SELL_GOOD { convoyId, goodId, quantity }` — parallel `BUY_GOOD`/`SELL_GOOD`, resolving as one `resolveTradeStepped` call then distributing via `ship-convoys.md`'s `ConvoyDistributionStrategy`

Plus convoy lifecycle actions: `CREATE_CONVOY`, `ADD_SHIP_TO_CONVOY`, `REMOVE_SHIP_FROM_CONVOY`, `DISSOLVE_CONVOY` (all specified in `ship-convoys.md`).

**Enforcement that a ship is in at most one convoy lives in the action handlers**, not the type system: `executeAddShipToConvoy` removes the ship from any other convoy's `shipIds` before adding it to the target convoy. The type system does not prevent a malformed state with a ship listed in two convoys' `shipIds` simultaneously — this is treated the same way `pendingSuccession`'s internal consistency is today (enforced by the functions that produce it, not by the type), consistent with this codebase's existing style of keeping `GameState` a plain data shape and putting invariants in the pure functions that transition it.

**UI addressing**: `App.svelte` gains a parallel `selectedConvoyId`/`activeConvoy` alongside the existing `selectedShipId`/`activeShip` — selecting a convoy in the fleet panel routes destination/posture/goods actions through the convoy-addressed actions above; drilling into a convoy's ship list and selecting one routes back through the existing ship-addressed actions unchanged. This is a UI-layer decision, expanded on when the UI-design pass for convoys happens (flagged as still-needed in `ship-convoys.md`) — noted here only to confirm it doesn't require changing how `Ship`-addressed actions work underneath.

## Alternatives Considered

- **Add `convoyId?: string` directly to `Ship`** — a normalized back-reference, arguably more conventional in a typical relational sense (`Ship` "knows" its convoy without a scan). Rejected: it's the first back-reference of its kind in this state shape, requires keeping two locations (`Ship.convoyId` and `Convoy.shipIds`) consistent on every membership change instead of one, and the scan cost (`convoys.find(c => c.shipIds.includes(shipId))`) is trivial at this game's scale (a handful of ships, a handful of convoys) — there's no performance case for the normalized form here, only a hypothetical purity one.
- **Replace `Ship[]` with a nested `Ship[] | Convoy[]` union in `FleetState`** (ships live *inside* their convoy once grouped, not in a flat list) — rejected outright: this would force every existing `state.fleet.ships` reader (there are dozens, across `fleet-system.ts`, `combat-system.ts`, `event-system.ts`, `turn-system.ts`, and most of `App.svelte`) to learn to flatten convoys back out first, for a data-shape change whose only benefit is saving one array scan. The flat-`ships` + `shipIds`-membership shape above gets the same grouping capability without touching a single existing reader.
- **Make convoy membership a property of the action, not of state** (e.g. no `Convoy` record at all — a "convoy" is just an ad hoc set of `shipId`s passed into a `SET_DESTINATION_MULTI { shipIds, destination }`-style action each time) — rejected: this doesn't satisfy the actual request, which is a fleet-panel UI showing one persistent collapsed row per convoy across turns, not a one-off multi-select action. Convoys need to persist as named, addressable groupings between turns.
- **A single combined action type parameterized by `target: { kind: 'ship'; shipId: string } | { kind: 'convoy'; convoyId: string }`** instead of separate action variants (e.g. one `SET_DESTINATION` handling both) — rejected: `GameAction` is a flat discriminated union everywhere else in this codebase (see `game-client.ts`), and every existing handler in `LocalGameClient.sendAction`'s `switch` is a flat one-action-one-case mapping; nesting a second discriminated union inside one case breaks that uniformity for no benefit, since the convoy-addressed and ship-addressed versions have almost entirely different logic bodies anyway (one applies to N ships via a loop/distribution, one applies to exactly one).

## Consequences

✅ Every existing `Ship`-addressed action, test, and UI code path is untouched — convoys are additive, not a breaking change to the single-ship model that's been stable since the project's start
✅ `Convoy.shipIds` reuses the exact id-array grouping pattern already established elsewhere in `GameState` (`CityEffect`, `PendingSuccession`), so a future contributor reading this code already knows the shape from precedent
✅ The convoy-addressed actions are new, isolated `GameAction` variants — implementing them (and their handlers) can proceed independently of touching any existing action, minimizing regression risk to the shipped v1.0-v1.3 systems
⚠️ Two-location consistency risk is deliberately accepted (a ship listed in two convoys' `shipIds` is a possible malformed state, prevented only by handler discipline, not the type system) — same trade-off this codebase already accepts elsewhere (e.g. `PendingSuccession.candidates` referencing children that could theoretically no longer exist), not a new category of risk, but worth a unit test specifically asserting `executeAddShipToConvoy` can't produce dual membership once implemented
⚠️ `App.svelte`'s reactive ship-selection pattern (`selectedShipId`/`activeShip`, used pervasively across the Port/Harbor/Trading Post/Shipyard panels) now needs a parallel convoy-selection pattern living alongside it — real UI complexity this ADR defers to the not-yet-written UI-design pass, not zero-cost
🔒 Locks in that `Ship` stays a flat, ungrouped record — any future feature wanting a *different* kind of ship grouping (e.g. a hypothetical "trade guild" or "escort assignment") would follow this same id-array-elsewhere pattern rather than needing its own bespoke mechanism, since this ADR establishes it as the house style for ship groupings

## Links

- Supersedes: —
- Superseded by: —
- Related ADRs: ADR-010 (combat mechanic — the per-ship power formula `ship-convoys.md` sums across a convoy), ADR-012 (game client abstraction — `GameAction` stays a flat discriminated union, reaffirmed here)
- Related design docs: `docs/design/ship-convoys.md` (full game-logic spec this ADR's data model serves), `docs/design/save-file-schema.md` (needs a new `convoys` row once implemented — additive field, no schema bump)
