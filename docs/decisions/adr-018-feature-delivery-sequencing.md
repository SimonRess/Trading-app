# ADR-018: Feature Delivery Sequencing — UI and Logic Ship Together

**Date:** 2026-07-21  
**Status:** Accepted  
**Deciders:** Simon

## Context

`docs/design/city-view.md` proposes replacing the Port screen's growing scrolling text panel with a clickable city scene (Harbor, Trading Post, Shipyard, Church, Counting House, Merchant's House, Town Hall, Warehouse District). At the same time, a substantial backlog of v1.1/v2 mechanics is queued up and not yet built: crew management, banking & loans, insurance, church donations, warehouses, cannons, and more. Two entire mechanics' worth of work (six-plus proposed systems, one graphical UI overhaul) both sit ahead of the project, and the order they get built in is itself a real decision, not a neutral scheduling detail — it directly affects how much throwaway work happens along the way.

Two extreme sequencing options were considered:

1. **Finish all remaining game mechanics first, then do the graphical UI overhaul afterward** — every new mechanic (crew, church, bank, warehouses) ships first as another text-panel section (matching the current Port-view pattern), and the city view is built as a single later pass that migrates everything at once.
2. **Build the entire graphical city view first, then implement the mechanics into it** — construct all eight buildings' UI shells before the logic they control exists.

## Decision

**Neither extreme. The city-view skeleton (rendering + the two functions every city already has — Harbor, Trading Post) ships first, as pure UI work with no new game logic. Every mechanic implemented after that point ships together with its building UI in the same change, not as a text-panel section to be migrated later.**

Concrete ordering that follows from this:

1. `CityScene`/`CityView.svelte` skeleton, wired to the Harbor (fleet overview, set destination) and Trading Post (buy/sell goods) buildings — functions that already exist in every city today, so this step is 100% UI, zero new game logic, and immediately replaces the largest, most duplicated part of the current text panel.
2. Wire the Shipyard building to the ship buy/repair logic that already exists — again, no new logic, just its second-largest existing chunk of UI.
3. From this point on, **every new mechanic (crew management, church donations, banking & loans, insurance, warehouses, cannons) is implemented in the same change as its building's UI** — a feature isn't "done" until it has both its `turn-system.ts`/`political-system.ts`-style logic *and* its `CityScene` building, matching this project's existing "logic + UI + tests + docs, all in one change" norm (already how every prior feature in this codebase has shipped — see the Contribution Workflow in this file) extended explicitly to cover which *screen* a feature's UI lands in, not just that it has UI at all.

## Alternatives Considered

- **All game logic first, one big UI migration afterward.** Rejected: every new mechanic between now and "afterward" would first get a text-panel section, then later get rebuilt as a building — double UI implementation work per feature, and the text-panel debt (already flagged as a motivation for `city-view.md` in the first place) keeps growing for the entire intervening period instead of shrinking.
- **All UI first, mechanics fitted in afterward.** Rejected: building Church/Counting House/Warehouse District panels before their mechanics exist means designing click targets and controls for logic that isn't decided yet; any late change to a mechanic's actual actions (which is likely — none of the proposed mechanics' numeric details are finalized, per every design doc's own "Open Questions") risks reworking the just-built UI too.
- **Migrate the text panel to buildings feature-by-feature, in the *current* text-panel order, independent of when each mechanic's logic lands.** i.e. build all eight buildings' shells now, atop the *existing* functions only, and let new mechanics slot into already-built buildings later. Rejected: this still front-loads UI work disconnected from the logic it will eventually control (a Church building built before church donations exist has literally nothing to click through to), and doesn't meaningfully differ from "all UI first" for the buildings that don't have existing functions yet (Church, Counting House, Merchant's House, Town Hall, Warehouse District — five of the eight).

## Consequences

✅ No feature ships twice — every mechanic from crew management onward gets exactly one UI implementation (its building), not a text panel followed by a later rebuild  
✅ Visible graphical progress starts immediately (Harbor/Trading Post skeleton), rather than being gated behind finishing the entire mechanics backlog first  
✅ Each subsequent feature PR stays self-contained (logic + its building + tests + docs together), consistent with how every feature in this project has already been built and reviewed  
⚠️ The Harbor/Trading Post/Shipyard skeleton work is now an explicit prerequisite step that must land before any of crew/church/banking/insurance/warehouses/cannons — those mechanics are effectively blocked on the skeleton existing, not just "nice to have alongside it." This is a real sequencing constraint the backlog didn't have before this decision.  
🔒 Any future proposed feature (beyond the current six-plus backlog) should default to "ships with its own building" per this ADR, unless a specific reason exists to add a text-only stopgap first (e.g. an urgent bugfix that can't wait for its building's implementation) — such an exception should be called out explicitly when it happens, not treated as the new default.

## Links

- Supersedes: —
- Related ADRs: ADR-017 (Ship-animation lifecycle — the overlay pattern the city view's building panels reuse)
- Related design docs: docs/design/city-view.md (the UI this sequencing decision governs the rollout of), docs/design/crew-management.md, docs/design/church-donations.md, docs/design/banking-loans.md, docs/design/insurance.md, docs/design/warehouses.md, docs/design/ship-stats.md (cannons) — every mechanic now gated on shipping with its building per this decision
