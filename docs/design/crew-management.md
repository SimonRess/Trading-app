# Design: Crew Management

**Status:** Proposed — not implemented  
**Target version:** v1.1

**Blocked on:** `docs/design/city-view.md`'s building skeleton (Harbor/Trading Post/Shipyard) per ADR-018 — this mechanic ships together with its own building's UI, not as a text-panel section.

## Purpose

Ships currently sail with cargo capacity and durability only — no crew of any kind (`mvp-scope.md`: "crew and speed modifiers are post-MVP"). Crew gives ships an ongoing cash cost beyond one-off repairs, and is the field ADR-010 (Combat) already anticipates needing (`crew_bonus` in the combat-power formula) before ship-to-ship combat can be implemented — so this is also unblocking work for that ADR, not just its own standalone feature.

## Goals (first pass)

- Crew is a real, ongoing decision: hire more for a benefit, pay wages every turn for the privilege.
- Under-crewing has a visible downside (matching how under-repaired ships already have `durabilityStormChancePenalty`/`durabilityTravelTimePenalty` — crew should slot into the same kind of "a neglected ship performs worse" pattern, not a wholly new one).
- Lay the groundwork ADR-010 needs (a `crew` count on `Ship`) without implementing combat itself.

## Non-Goals (this pass)

- No individual named crew members, portraits, or loyalty/morale per-sailor tracking — a flat headcount per ship, same "one number, not a roster" spirit as warehouses' flat income.
- No crew death/injury from events in this pass — storms/pirates still only affect durability and cargo, exactly as today; crew casualties are a natural v2 combat extension (ADR-010), not required for v1.1's crew-as-upkeep mechanic to land.
- No crew skill differentiation (a "master navigator" vs. a "deckhand") — that overlaps with the child-traits proposal's own trait pool (`family-succession.md`) and would duplicate design surface; if crew ever need individual quality, it should reuse that trait system rather than inventing a second one.

## Mechanic

- `Ship` gains a `crew: number` field (0 to a per-type max, proposed: Kogge 8, Hulk 12, Schnigge 5 — roughly proportional to cargo capacity). New ships start at a sensible default crew (proposed: half of max) rather than 0, so a freshly-bought ship isn't immediately under-crewed by default.
- Hiring/releasing crew happens at a shipyard city (same restriction as buy/repair — `SHIPYARD_CITIES`), a small "Crew" control next to Buy/Repair in the Shipyard section: +1/-1 buttons, each hire costing a flat fee (proposed: 20 Mark), release refunding nothing (severance isn't compensated — a one-way cost, matching how selling a warehouse already has resale friction rather than full refunds).
- Each turn, `resolveTurn` deducts `crew × WAGE_PER_SAILOR_PER_TURN` (proposed: 2 Mark) from `player.cash`, across the whole fleet — a new step, same pattern as the political-rank and (once built) warehouse-income steps.
- Under-crewed ships (below some fraction of their type's max, proposed: below half) get a travel-time penalty (+1 turn, reusing the exact mechanism `durabilityTravelTimePenalty` already provides for Damaged ships) — being short-handed slows a ship down, mechanically identical in shape to being damaged.

## Open Questions

- Hire cost, wage rate, and the under-crewed threshold/penalty are placeholder numbers, unvalidated — same caveat as every other numeric proposal in this doc set.
- Should crew be lost (not just refused reinforcement) when a ship is sold or wrecked, i.e. does crew have any value reflected in `computeNetWorth`? Proposed: no — crew is an upkeep cost, not an asset, so it stays out of net worth entirely (unlike ships and cargo). Worth confirming since ADR-014's net worth formula is a stated, deliberate list, not "everything the player owns."
- Interaction with ADR-010's `cannons` field: cannons already use cargo space (2 last per cannon); does crew also consume cargo space, or is it a separate capacity? Leaning separate (crew live on the ship, not in the hold) — but this needs to be settled before both features exist simultaneously, since they'll otherwise be designed against slightly different assumptions about what "capacity" means for a ship.

## Related

- ADR-018 (Feature delivery sequencing — this mechanic ships with a Shipyard building, gated on the city-view skeleton)
- ADR-010 (Combat — `crew` field and `crew_bonus` combat-power term this doc's field addition unblocks)
- `docs/design/ship-stats.md` (durability-threshold penalty pattern this reuses; `Ship` data model)
- `docs/design/warehouses.md` (sibling "flat per-turn cash effect" mechanic, opposite sign)
