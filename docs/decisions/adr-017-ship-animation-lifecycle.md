# ADR-017: Ship-Animation Lifecycle — Persistent Overlays & Pause/Resume

**Date:** 2026-07-20  
**Status:** Accepted  
**Deciders:** Simon

## Context

Ship markers on the map were changed to glide smoothly to their new position (port fan-out slot, or a point along a route) instead of snapping there instantly, whenever `MapScene.update()` reports a change (`docs/design/map-view.md` "Ship Movement Animation"). Verifying this feature live surfaced two problems that weren't apparent from code review alone, each requiring a real architectural decision rather than a one-line fix:

1. **The animation never actually played across a real turn.** `End Turn` always routes through a `turn-summary` screen, which — at the time — was a separate `{:else if screen === 'turn-summary'}` branch in `App.svelte`. Since `<MapView>` is only rendered inside the `port`/`map` branch, every turn unmounted it (destroying its `MapScene`/PixiJS `Application`) and remounted a fresh one when the player returned to Port. A freshly-created `MapScene` always places a new ship marker directly at its current target — there is no "before" position to glide from — so the glide only ever worked for the Map↔Port toggle *within* a turn (which doesn't move ships), never for the turn-to-turn movement it was actually built for.

2. **The animation could finish invisibly while the map was hidden.** The tween runs on wall-clock time (`performance.now()`), independent of whether the map container is actually on screen (`display:none` while on the Port view). A first attempt at a fix — shifting a marker's `animStart` forward by however long the map had been hidden — was itself buggy: it used the time since the map was *first ever* hidden (effectively "since app start") rather than the time relevant to that specific marker's most recent target change, which meant an already-finished animation could appear to jump backward or freeze for an unrelated stretch of time once revealed. This was only caught by adding temporary instrumentation and watching real `animStart`/`t` values across ticks — not obvious from reading the pause logic in isolation.

Both problems trace back to the same underlying question: **what should count as "the same ongoing animation" across a screen transition or a visibility change, and who is responsible for preserving that continuity — the screen-routing layer, or the animation code itself?**

## Decision

**Milestone/interrupt screens (turn-summary, and now the win screen — ADR-016) are rendered as overlays on top of the persistently-mounted port/map view, never as separate screen branches that unmount it. Separately, `MapScene` itself is responsible for freezing and correctly resuming its own animations across any hide/show transition, by tracking each marker's actual elapsed progress rather than by shifting timestamps based on wall-clock duration.**

### Overlay, not screen-swap

- `turn-summary` (and the win/Victory variant, ADR-016) render as a `.turn-summary-overlay` `<div>` — a fixed-position, full-viewport overlay — inside the same `port-screen` `<main>` that already hosts the persistently-mounted `<MapView>`, instead of a separate `{:else if}` branch.
- This makes "genuine session boundary" (new game, game over on a *loss*) the only remaining case where `<MapView>` unmounts. Every other screen transition a session goes through repeatedly (turn-summary every turn, the win screen once) now happens without disturbing the mounted `MapScene`.

### Pause/resume, tracked as elapsed progress

- `MapScene.setVisible(visible: boolean)` is called by `MapView.svelte` on every visibility change (the Map↔Port toggle, and — now that turn-summary is an overlay covering the map — screen becoming covered/uncovered).
- While hidden, `tickShipAnimations` skips repositioning entirely — a marker's on-screen position is frozen exactly where it was the instant visibility was lost, not advanced further by wall-clock time.
- On becoming visible again, each marker's `animStart` is recomputed as `now - elapsedAtHide`, where `elapsedAtHide` is the progress that specific marker had actually made *before* hiding (clamped to `[0, SHIP_MOVE_DURATION_MS]`, and clamped to `0` if the marker's target changed *after* the map was already hidden — it never got to show any progress, so it restarts fresh rather than resuming a fraction of an animation the player never saw begin). This is a pure function of that marker's own state, not of how long the map has been hidden overall.

## Alternatives Considered

- **Shift `animStart` forward by total-time-hidden** (the first attempt). Rejected after live instrumentation showed it produced animations stuck at `t=1` (or, in principle, temporarily negative-elapsed and frozen at the start position) depending on when a marker's target last changed relative to when the map first went hidden — the bug that prompted writing this ADR instead of just re-shipping the fix silently.
- **Don't freeze position updates while hidden; let the tween keep running in the background.** Considered once the elapsed-progress-based resume was correctly derived, since position is a pure function of `(now, animStart, start, target)` recomputed every tick — freezing isn't strictly *required* for correctness under that formula. Kept the freeze anyway as a minor, free efficiency measure (skip work with no visible effect) and because it keeps the mental model simpler ("hidden = paused", not "hidden = still computing, just not drawing").
- **Keep turn-summary as a separate screen; fix the remount by making `MapScene` cheaper to recreate** (e.g. reuse the WebGL context across instances). Rejected: doesn't address the actual problem (a fresh scene has no memory of a ship's *previous* on-screen position regardless of how cheap recreation is), and adds real complexity to `MapScene`'s constructor/mount lifecycle for no benefit over just not tearing it down.
- **Make the win screen a genuinely separate overlay/screen from turn-summary**, rather than a variant of the same component. Rejected: it needed the exact same "don't unmount the map" property turn-summary had just been fixed to have; building a second, parallel overlay mechanism to get the same property would have been pure duplication.

## Consequences

✅ Ship-movement animation actually plays across real turns now, not just within the Map↔Port toggle it was accidentally limited to  
✅ A ship that moves while the player is on the Port screen is guaranteed to still show its glide the next time the map is opened, regardless of how long it was hidden  
✅ Turn-summary, and now the win screen, share one overlay mechanism instead of each screen-swap event needing its own unmount/remount consideration  
⚠️ `MapScene` now carries more animation-lifecycle state (`shipMarkers`, `isVisible`, `hiddenSince`) than a purely stateless "redraw everything from `GameState` every update" render layer would — a deliberate trade-off for smooth motion, but it does mean `MapScene` is no longer trivially re-derivable from state alone; `destroy()`/`mount()` must be paired correctly (already true) and any future render-layer refactor needs to preserve this marker-persistence behavior deliberately, not assume it away  
🔒 Any future full-screen interrupt (e.g. the family-succession announcement proposed in `docs/design/family-succession.md`) should default to the overlay pattern established here rather than a new screen branch, unless there's a specific reason a session boundary is appropriate (as `game-over` on a loss still is)

## Links

- Supersedes: —
- Related ADRs: ADR-003 (Rendering approach — PixiJS `Application` lifecycle cost is why remounting was expensive in the first place), ADR-016 (Political rank & continuable win — the win screen that reuses this same overlay pattern)
- Related design docs: docs/design/map-view.md ("Persistent mount", "Ship Movement Animation" — full implementation detail)
