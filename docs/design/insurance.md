# Design: Insurance

**Status:** Implemented (first pass — thresholds not yet tuned)  
**Target version:** v1.1

## Purpose

Storms and pirate raids (ADR-015) already impose real, sometimes severe losses (a wrecked ship, 15% cargo loss) with no way for the player to hedge against them beyond keeping ships repaired. Insurance gives the player a cash-for-risk-reduction trade that's orthogonal to repair (repair reduces the *chance*/severity of damage per the durability thresholds; insurance instead pays out *after* a loss occurs), giving two different flavors of risk management rather than one.

## Goals (first pass)

- A clear, opt-in cost (a premium) for a clear, guaranteed benefit (partial payout on a covered loss) — no ambiguity about what's covered.
- Meaningfully reduces the sting of a bad storm/pirate roll without eliminating risk entirely (that would remove the reason storms/pirates exist as a system at all).
- Reuses the existing event-message pipeline (`TurnSummary.events`) for payout notifications — no new UI surface needed beyond the purchase control itself.

## Non-Goals (this pass)

- No per-good or per-route insurance products — one flat policy per ship, covering both storm damage and pirate cargo loss identically. Splitting into separate storm/pirate/cargo-value policies is a plausible v2 refinement once the base mechanic is validated, not needed to land the core idea.
- No insurance fraud/claims-adjustment mechanic (the player can't stage a loss) — payouts are purely a function of actual event outcomes already computed by `event-system.ts`, not a separate claims process the player interacts with.
- No insurance company reputation/relationship — a single, always-available policy, not a market of competing insurers.

## Mechanic

- Available per-ship, from any port (not shipyard-restricted — insurance is a financial product, not a physical repair): pay a premium (proposed: a flat 20 Mark per turn while active, deducted alongside crew wages/loan interest in the same new turn-resolution step) to mark a ship `insured: boolean` for that turn.
- When `applyEvent` resolves a storm or pirate raid against an insured ship, it additionally computes a payout: proposed 50% of the durability damage's Mark-equivalent (using the existing `shipNetWorth`/repair-cost formulas to convert durability points to Mark) for storm, or 50% of the lost cargo's base-price value for a pirate raid — added to `player.cash`, with an additional turn-summary line ("🛡️ Insurance paid out 340 Mark toward Wulf von Lübeck's storm damage.").
- Insurance does not prevent a Critical/Wrecked ship's existing `canDepart` restriction, nor does it prevent a wreck outright — it only ever pays cash after the fact, never changes what happens to the ship itself. This keeps the feature purely financial, not a second damage-mitigation system competing with durability/repair.

## Implementation Status (as of 2026-07-23)

- ✅ `Ship.insured: boolean` (additive save-file field, no schema bump — defaults to `false` for older saves).
- ✅ `executeToggleInsurance` (`insurance-system.ts`) and the `TOGGLE_INSURANCE` action — available anytime, on any ship, regardless of location (not shipyard- or port-restricted).
- ✅ **Resolved open question:** implemented as a persistent toggle ("insured until cancelled"), not purchased fresh every turn — fewer clicks across a session, same mental model as the flat per-turn crew-wage/loan-interest charges it sits alongside.
- ✅ `accrueInsurancePremiums` deducts a flat 20 Mark/turn per insured ship in `resolveTurn`, reported in the turn summary ("Paid N Mark in insurance premiums").
- ✅ `computeInsurancePayouts` diffs each ship's state immediately before vs. after that turn's event resolution: an insured ship that lost durability (storm) or cargo (pirate raid) gets 50% of the Mark-equivalent value back, added to cash, each with its own turn-summary line.
- ✅ **Resolved open question:** a wrecked (fully lost) ship is not covered — it no longer appears in the post-event fleet, so it isn't matched by the diff and receives no payout. Only damage/loss short of total destruction is covered in this pass.
- ✅ Counting House building lists the whole fleet with per-ship Insure/Cancel controls.
- ✅ Unit tests (`insurance-system.test.ts`, plus a `turn-system.test.ts` integration test): toggle on/off, premium accrual, storm/cargo payout calculation, no payout for uninsured or wrecked ships, no-mutation.
- ✅ Verified live: insuring a ship and ending a turn correctly charged the 20 Mark premium, reported in the turn summary.

## Open Questions

- Premium (20 Mark/turn) and payout percentage (50%) are still placeholder numbers, unvalidated by simulation — same caveat as every other numeric proposal.

## Related

- ADR-018 (Feature delivery sequencing — this mechanic ships with the Counting House building, gated on the city-view skeleton)
- ADR-015 (Per-route & session event risk — the storm/pirate mechanics this pays out against)
- `docs/design/ship-stats.md` (durability thresholds, repair-cost formula this reuses for payout conversion)
- `docs/design/banking-loans.md` (sibling financial-mechanic; both live in the Counting House building)
