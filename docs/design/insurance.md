# Design: Insurance

**Status:** Proposed — not implemented  
**Target version:** v1.1

**Blocked on:** `docs/design/city-view.md`'s building skeleton (Harbor/Trading Post/Shipyard) per ADR-018 — this mechanic ships together with its own building's UI, not as a text-panel section.

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

## Open Questions

- Premium (20 Mark/turn) and payout percentage (50%) are placeholder numbers, unvalidated by simulation — same caveat as every other numeric proposal.
- Does insurance need to be purchased fresh every turn (as sketched above), or should it be a longer-term toggle ("insured until cancelled")? Leaning toward per-turn for simplicity of implementation and mental model (matches how the proposed crew wages/loan interest are also flat per-turn charges), but a persistent toggle would be less UI-clicking for the player across a long session — worth deciding before implementation.
- Should insurance cover a wrecked (0-durability) ship's *loss* at all, or only damage short of destruction? A full payout on total loss is a much bigger number than partial storm damage and needs its own explicit rate rather than assuming the same 50% applies uniformly.

## Related

- ADR-018 (Feature delivery sequencing — this mechanic ships with the Counting House building, gated on the city-view skeleton)
- ADR-015 (Per-route & session event risk — the storm/pirate mechanics this pays out against)
- `docs/design/ship-stats.md` (durability thresholds, repair-cost formula this reuses for payout conversion)
- `docs/design/banking-loans.md` (sibling financial-mechanic proposal; consider a shared "Bank" UI section)
