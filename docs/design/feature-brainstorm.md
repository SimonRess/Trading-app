# Design: Feature Brainstorm — UX & Long-Term Fun

**Status:** Proposal (nothing here implemented yet)
**Last updated:** 2026-07-25

Produced from an extensive playtest session (300+ simulated turns via Playwright: buying/selling at bulk quantities, sailing multi-leg routes, cannon/crew/posture changes, loans, map/city/port navigation) plus a design review of the current UI. No crashes or console errors turned up in the playtest itself — the findings here are UX/fun gaps, not bugs. This is a first pass, then revised down to what's worth building; see "Cut" at the end for what didn't survive review.

---

## Playtesting Findings (small, concrete UX fixes)

These were visible defects/friction spotted in the actual running app, not speculative — cheap to fix, worth doing before the bigger ideas below.

1. **Header shows "Turn 1/999999"** — `maxTurns` was deliberately set to 999,999 (ADR-022) so a session runs until death or a Mayor win, not a turn counter, but the header still shows the raw denominator. Reads as a bug, not a design choice. Should show just "Turn N" (or "Year N"), with the /max form only if a real cap is ever reintroduced.
2. **Ship markers and city markers use the same icon on the map**, differing only in size/label — genuinely easy to confuse at a glance, worse the more ships are in the fleet.
3. **Buy/Sell buttons show a redundant total for quantity 1** — `Buy 1 (5 M)` duplicates the adjacent Price column when qty is 1; the parenthetical total is only useful once bulk pricing (qty > 1) makes it diverge from the spot price.
4. **All 8 City-view buildings use one generic silhouette**, distinguished only by a color tint and label — confirmed visually in the playtest screenshots. This is the practical, current-day symptom of the ADR-005 real-art-assets gap already tracked in the PRD; noted here because it's the single biggest "doesn't look like a real game yet" impression a new player gets.

---

## Brainstormed Features (kept after review)

Ranked roughly by impact-for-effort, not strict priority.

### 1. Dynasty Chronicle — a family history screen
The game's own pitch is "raise a family across generations," but there is currently no way to look back at that history: past heirs, how they died, notable events, how many generations have passed. A simple, mostly-free feature: log succession events (already generated as turn-summary strings) into a persistent `GameState.chronicle: string[]` and surface it as a new read-only panel (Merchant's House or Town Hall). This is the single highest-leverage "long-term fun" feature relative to effort — it directly serves the game's stated core loop instead of adding a new mechanic.

### 2. Saved/repeating trade routes
The most repetitive part of a long session (confirmed directly in the 60+ turn playtest) is manually re-clicking buy → set destination → (wait) → sell → buy → set destination, turn after turn, once a profitable loop is found. A "repeat last order" button, or a saved "trade route" (buy good X at city A, sail to city B, sell, sail back) that auto-fills the next turn's orders until cancelled, would materially reduce click fatigue in exactly the situation where a player has already made the interesting decision (which route is profitable) and is now just re-executing it. This is a quality-of-life feature, not a new mechanic — no new game rules, just automating an already-decided action.

### 3. Price history / trend graph per good
Currently a good's price trend is a single ↑/↓/— arrow with no memory beyond one turn. A small sparkline or line graph (last ~10-turn price history per good per city, computed client-side from existing `GoodMarket` snapshots — no new game-logic needed, just remembering recent values in the UI layer) would let an engaged player actually learn a route's rhythm instead of guessing from a single arrow. Directly supports the "market feels alive" pillar already stated in the PRD.

### 4. Achievements / milestones log
A lightweight, no-new-mechanic feature: detect and record notable moments already implicit in existing state transitions (first 1,000 Mark net worth, first ship lost, first Mayor rank, Nth generation reached, survived a pirate Victory, etc.) into a simple list shown alongside the Dynasty Chronicle (#1) or as its own panel. Gives players something to look back on and share, cheap relative to its payoff for session-to-session motivation.

### Small UI polish (bundle with the playtesting fixes above)
- Fix the four playtesting findings above.
- A "Sell all" quick action next to the Sell button when the ship is in port at a city that buys the held good, since dumping an entire hold is common at the end of a route and currently requires typing the exact quantity.

---

## Cut (considered, not recommended)

- **Difficulty modes / alternate starting scenarios** — plausible replay-variety feature, but speculative without evidence anyone's asked for it yet, and duplicates effort better spent on the PRD backlog's more clearly-wanted items (stores, expeditions, real combat depth). Revisit once the core loop has more players/feedback.
- **A separate "notable events digest"** shown at each year's Spring rollover — folded into the Dynasty Chronicle (#1) instead of building a second, overlapping history feature.
- **In-app tutorial/onboarding flow** — the game currently has no explicit tutorial. Considered, but cut from this pass: the existing season-info popup and self-explanatory building panels seem to cover the basics adequately for the game's target audience (sim/strategy players used to reading UI), and a dedicated tutorial is a meaningfully sized feature better scoped on its own if a real new-player-confusion signal shows up.

---

## Related

- `docs/prd.md` — the broader feature backlog (deeper mechanics like stores, expeditions, real combat, multiplayer, art). This document is deliberately narrower: things that improve the *feel* of the existing game rather than add new systems.
- ADR-005 (art style) — the root cause behind playtesting finding #4.
