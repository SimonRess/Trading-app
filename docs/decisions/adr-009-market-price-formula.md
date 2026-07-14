# ADR-009: Market Price Formula

**Date:** 2026-07-14  
**Status:** Accepted  
**Deciders:** Simon

## Context

The trade system is the core game loop. Every buy/sell decision the player makes is a price decision, so the formula that produces prices must be simple enough to feel intuitive, dynamic enough to reward route knowledge, and deterministic enough to be unit-tested. The formula must also produce stable equilibrium behaviour when the player is absent from a city — prices should not drift to extremes without player interaction.

## Decision

Use a **linear supply/demand curve** with a clamped price multiplier.

Each city tracks a `supply` value (0–100) per good. Price is calculated as:

```
price = base_price × clamp(2.0 − supply / 50, 0.2, 2.0)
```

- supply = 0 → 2.0× base price (extreme scarcity)
- supply = 50 → 1.0× base price (equilibrium)
- supply = 100 → 0.2× base price (surplus floor)

Supply changes each turn: `supply += production − consumption ± player_delta ± event_delta`, clamped to [0, 100].

Full production/consumption rates and base prices are specified in `docs/design/market-formula.md`.

## Alternatives Considered

- **Fixed prices per city** — simplest to implement; no surprises. Rejected because static prices eliminate the core strategic tension: there is no incentive to visit a city twice, and no emergent behaviour from player activity.

- **Randomised price variance (±N% each turn)** — adds noise without cause. Rejected because price swings feel arbitrary rather than meaningful; the player cannot learn anything useful about why prices changed.

- **Non-linear curve (exponential or sigmoid)** — steeper response near extremes (panic prices at near-zero supply, hard floor at high supply). Considered but deferred: a linear curve is easier to reason about during initial balancing. Can be revisited once the linear version has been playtested.

- **Full supply/demand simulation with multiple buyer agents** — more realistic; prices emerge from competing demand. Rejected as significant overengineering for a solo-merchant MVP. The per-city production/consumption rates achieve the same steady-state behaviour with far less complexity.

## Consequences

✅ Formula is a single line — easy to unit test and reason about  
✅ Equilibrium is predictable: a city with no player interaction stabilises near supply = 50  
✅ Player actions have visible, proportional price impact — buying 50 last moves supply meaningfully  
✅ Scarcity and surplus both have defined bounds (0.2×–2.0×) — no runaway prices  
⚠️  Linear curve may feel too smooth — extreme scarcity doesn't feel "panicky" enough  
⚠️  Price floor of 0.2× means goods never become worthless even at full surplus  
🔒  All price calculations must go through this formula — hardcoding prices in any system bypasses supply/demand and breaks game balance  

## Links

- Supersedes: —  
- Superseded by: —  
- Related ADRs: ADR-006 (Turn-based — supply updates fire once per turn), ADR-004 (Architecture — market state is a pure domain slice)  
- Related design docs: docs/design/market-formula.md (full rates, base prices, starting supply values)
