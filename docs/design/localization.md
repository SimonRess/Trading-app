# Design: Localization (Settings Menu, English/German)

**Status:** Implemented (first pass, 2026-07-25)

## What shipped

A new "⚙️ Settings" button in the header opens a panel with a language switch (English/Deutsch). The choice is stored in `localStorage` (falling back to the browser's `navigator.language` on first visit) and applies immediately across the whole app — no reload needed.

`src/ui/i18n.ts` holds a `Locale = 'en' | 'de'` Svelte store and a `TRANSLATIONS: Record<Locale, Translation>` dictionary. `App.svelte` derives `$: T = TRANSLATIONS[$locale]` and reads every static string through `T.xxx`, instead of hardcoded English literals.

**Covered:** every screen's static chrome — nav bar, all building panels (Harbor, Trading Post, Shipyard, Church, Counting House, Warehouse District, Town Hall, Merchant's House), the New Game screen, Save menu, Settings panel, season-info popover, changelog-viewer button, turn-summary and game-over screens, the heir-succession and ship-auction popups, table headers, and the shared display-only vocabulary (seasons, goods, marital status, ship posture, durability, building names, political ranks, child traits). The map's route-danger legend and the City view's PixiJS building labels are also localized — see "Canvas labels" below.

**Not covered (deliberate, documented in `i18n.ts`'s header comment):** the narrative turn-summary log lines generated inside `src/game/systems/*.ts` (event messages like "🏴‍☠️ Pirates intercepted...", succession/death messages, rank-up announcements, wage/interest/warehouse-income lines). These are plain English strings returned by pure game-logic functions today. Localizing them correctly means changing those functions to return a message key + params instead of a formatted string, so the UI layer (not game logic) does the translating — CLAUDE.md's architecture rule is that `src/game/` must never know about the UI or locale. That's a real refactor touching roughly 10 system files and the ~50 existing tests that assert on message substrings, not a small addition alongside this change. Also not covered: ship-type flavor descriptions ("The Hanseatic workhorse...", from `data/ships.ts`) and the changelog viewer's content (a dev-facing document, not gameplay UI).

## Canvas labels (PixiJS)

Building/legend text drawn into PixiJS `Text` objects (`city-scene.ts`, `map-scene.ts`) isn't part of Svelte's reactive DOM, so switching language doesn't update it "for free" the way HTML text does. Both scenes gained a small public API:

- `MapScene.setLegendLabels([calm, dangerous, enRoute])` — stores the three strings and redraws the legend (cheap, always redrawn from scratch already).
- `CityScene.setLabels(labels)` — stores the label map; since `showCity()` caches a built scene per city (`SceneManager`, keyed by city id) to avoid rebuilding on every revisit, changing language throws away that cache (`SceneManager.destroy()` clears its own bookkeeping) **and explicitly calls `worldLayer.removeChildren()`** before rebuilding — a bug caught during live verification: `buildCityScene`'s own `destroy()` is a deliberate no-op (see the comment there, from the earlier double-destroy fix), so without this the old scene's containers stayed attached to `worldLayer` and old/new language labels rendered stacked on top of each other.

`CityView.svelte`/`MapView.svelte` pass `labels`/`legendLabels` props reactively; `App.svelte` computes them from `T` on every locale change.

## Open follow-up

- Translate the turn-summary/event narrative log lines (see "Not covered" above) — the real remaining gap. Requires refactoring `src/game/systems/*.ts`'s message-producing functions to return `{ key, params }` instead of formatted strings.
- Ship-type flavor descriptions (`data/ships.ts`).

## Related

- `docs/prd.md` Feature Backlog (localization was not previously tracked there — this doc supersedes that gap)
- CLAUDE.md's architecture rule (`src/game/` has zero dependency on `src/ui/`) — the reason the game-logic message refactor above is scoped as a separate follow-up rather than attempted here
