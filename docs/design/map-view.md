# Design: Map View

**Status:** Draft
**Last updated:** 2026-07-18

## Purpose

Render the 5-city world as a navigable map — the second of the five MVP screens (`mvp-scope.md`), and the first system to actually use the PixiJS game-world layer defined in ADR-003. Until now, all travel and city selection has been text-only (buttons in the Port view). The map gives the player a spatial view of the network: where their ships are, what routes connect which cities, and a way to jump straight to a city's port.

## Inputs & Outputs

**Reads:** `GameState.fleet` (ship positions, in-port or in-transit), plus the static `CITIES` and `ROUTES` data (`src/game/data/cities.ts`, `routes.ts`). Also reads the UI-only selection state (`selectedShipId`, `selectedCityId`) to highlight what's currently selected — this is UI state per ADR-004, not persisted.

**Writes:** Nothing to `GameState`. The map is read-only/navigational: clicking a city or ship only changes local UI state (`selectedCityId`, `selectedShipId`, `screen`) in `App.svelte`, exactly like the existing city-select buttons and ship cards already do. No new `GameAction` is introduced.

## Architecture

Per ADR-003 (PixiJS for the game world, Svelte/DOM for UI) and ADR-004 (render layer consumes `GameState`, never mutates it):

```
src/render/map-scene.ts   ← pure PixiJS: owns the Application, draws cities/routes/ships
src/ui/MapView.svelte     ← thin Svelte wrapper: mounts/destroys the scene, forwards clicks as events
src/ui/App.svelte         ← owns `screen: 'map' | 'port' | ...`; renders <MapView> when screen === 'map'
```

`map-scene.ts` lives in `src/render/`, not `src/ui/`, and does not import anything from `src/game/systems/` — only `src/game/data/` (static, non-mutating) and `src/game/state/types.ts` (types only). It has zero Svelte dependency, so it is testable/reusable independent of the UI framework, consistent with Hard Rule 1/2 in `CLAUDE.md`.

`MapScene` is a plain class, not a component:

```typescript
export interface MapSceneCallbacks {
  onCityClick?: (cityId: CityId) => void;
  onShipClick?: (shipId: string) => void;
}

export class MapScene {
  constructor(callbacks?: MapSceneCallbacks);
  mount(container: HTMLElement): Promise<void>;   // async: PixiJS v8 init is async
  update(state: GameState, selection: { selectedShipId?: string; selectedCityId?: CityId }): void;
  destroy(): void;
}
```

`MapView.svelte` creates a `MapScene` in `onMount`, calls `.update(...)` in a reactive statement whenever `state`/selection props change, and calls `.destroy()` in `onDestroy`. This mirrors the existing pattern of `App.svelte` re-fetching `state` from `GameClient` after every action and passing it down as a prop — no new state-management approach introduced.

### Persistent mount (fixed a real perf issue)

`App.svelte` originally used `{#if screen === 'map'}<MapView .../>{/if}`, which Svelte tears down and recreates on every truthiness change — so toggling Map/Port destroyed and recreated the entire `MapScene` (a new PixiJS `Application`, WebGL context, shader compilation, font texture generation) on *every single switch*, not just the first. This was reported as "opening the map takes a while the first time, faster afterwards" — the "faster afterwards" was the browser's GPU driver caching compiled shaders across the repeated context creations, not the app actually reusing anything.

Fixed by keeping `<MapView>` permanently mounted inside the port screen and toggling only its container's CSS visibility (`class:hidden`, `display: none`) based on `screen`. `MapScene.update()` still runs on every state change regardless of visibility, so the map is current the instant it's shown. This scope is intentionally narrow — switching *away* from the port/map screen entirely (e.g. to the turn-summary screen) still unmounts and remounts on return, since that toggle is far less frequent than Map/Port switching within a turn.

**Follow-up fix — legend not appearing:** `MapScene.mount()` runs while the container is still `display:none` (dimensions `0×0`), so the zero-size guard in `handleResize` skipped positioning `hudLayer`, leaving the legend un-positioned until a `ResizeObserver` firing on the `0×0 → real size` transition corrected it — a transition that is not reliably observed across browsers. Fixed two ways: `mount()` now also sets an immediate fallback `hudLayer` position (using the same `container.clientHeight || 300` fallback already used for `app.init()`), and `MapScene` gained a public `refreshLayout()` method that re-runs `handleResize` on demand. `MapView.svelte` takes a new `visible` prop and calls `refreshLayout()` in a reactive statement whenever it flips true, so `App.svelte` explicitly re-lays-out the map the moment `screen` becomes `'map'`, independent of whether `ResizeObserver` fires.

## Visual Design (procedural pixel art)

ADR-005 commits the project to pixel art long-term, but no asset pipeline or artist exists yet. Rather than block on that, cities and ships are drawn as **procedural pixel-grid sprites**: `drawPixelSprite(pattern, pixelSize, color)` takes a small ASCII grid (`'#'` = filled, `'.'` = empty) and renders one PixiJS `Graphics.rect()` per filled cell. A city is a 7×8 castle/tower silhouette (`CITY_PIXEL_PATTERN`); a ship is a 9×9 sailboat silhouette (`SHIP_PIXEL_PATTERN`) whose sail (rows 0-3) and hull (rows 6-8) are separated by two single-pixel mast rows (4-5) — an earlier 7-row pattern let the sail's triangular base flow straight into the hull's top edge, reading as one blob rather than a mast-and-sail atop a hull. Because `Graphics` fills are vector (always crisp rectangle edges regardless of zoom), this reads as genuine blocky pixel art without needing a texture atlas or sprite-sheet pipeline — confirmed by zooming to 3.5× in a live check, the icons stay crisp rather than blurring.

This is still explicitly placeholder art relative to ADR-005's long-term direction (a real pixel artist producing an actual sprite sheet) — but it is categorically closer to "pixel art" than the earlier smooth vector circles/triangles were, and needs no further rework when a real sprite sheet arrives: swapping `drawPixelSprite(...)` for `new Sprite(texture)` only touches `drawCities()`/`drawShipMarker()`, not the positioning, interpolation, or interaction code around them.

- **Sea background:** solid dark blue fill (`0x0d1b2a`), matching the existing UI's dark palette
- **Routes:** straight lines between connected cities (per `ROUTES`), tinted by current combined storm+pirate danger (see "Route Danger Colouring" below); a route with a player ship currently on it overrides to gold and thicker
- **Cities:** a pixel-art castle icon per city at its documented `position` (`cities.ts`), with a permanent text label (name) beneath it — labels are always visible (only 5 cities; avoids relying on hover, which doesn't exist on touch/mobile). The selected city (`selectedCityId`) gets a highlighted ring
- **Ships:** a small pixel-art sailboat icon. In port, ships fan out slightly above their city's icon so multiple ships at one city don't fully overlap. In transit, the marker's logical target position is linearly interpolated along its route line based on `turnsRemaining / route.turns`. The selected ship (`selectedShipId`) is drawn in a brighter color with its name labelled

## Ship Movement Animation

Turns resolve instantly in game logic — a ship's `position` jumps straight from one `RoutePosition`/city to the next with no notion of "mid-tween". Snapping the on-map marker straight to that new logical position on every `update()` read as teleporting rather than sailing. `MapScene` now keeps a persistent `ShipMarker` (a `Container` with its icon `Graphics` and name `Text`, added once and reused) per ship in `shipMarkers`, instead of clearing and recreating `shipLayer`'s children every `update()`. When a ship's computed target position (port fan-out slot, or interpolated point along its route) changes between updates, the marker glides from its current on-screen position to the new one over `SHIP_MOVE_DURATION_MS` (600ms, eased with `easeOutCubic`), driven by a PixiJS `Ticker` callback (`tickShipAnimations`) rather than by `update()` itself — so the glide keeps progressing smoothly across animation frames regardless of how often game state changes arrive. A newly-appearing ship (freshly bought) is placed at its target immediately, with no glide-in.

## Route Danger Colouring (ADR-015)

Once per-route/session risk actually drove gameplay (ADR-015), the map gained a visual read on it: every route line is tinted along a gradient from calm blue (`ROUTE_COLOR`) to danger red (`ROUTE_DANGER_COLOR`), based on the same `routeDangerFactor` normalisation used for event-pool weighting (deliberately duplicated here rather than imported from `risk-system.ts`, to keep `map-scene.ts` free of any `src/game/systems/` dependency — see "Architecture" above). A small fixed-position legend (bottom-left, drawn into a `hudLayer` that is a child of `app.stage`, not `worldLayer`, so it doesn't scale/pan with zoom) explains the three line states: calm, dangerous, ship en route.

## World Coordinate Space & Scaling

`CITIES` positions are defined in a fixed logical space (`x` up to 720, `y` up to 340). The map view canvas is not this exact pixel size — it fills whatever space its container (in the Svelte layout) gives it, which varies by window size and by the foldable Fleet panel's state.

`MapScene` renders everything into a `worldLayer` container sized to a constant `WORLD_WIDTH × WORLD_HEIGHT` (800×420, with padding around the max city coordinates), then scales and centers that layer to fit the actual canvas size:

```
scale = min(canvasWidth / WORLD_WIDTH, canvasHeight / WORLD_HEIGHT)
worldLayer.scale = scale
worldLayer.position = centered within the canvas
```

A `ResizeObserver` on the mount container (not just a `window resize` listener) drives re-scaling, so the map also adapts when the Fleet panel is folded/unfolded — a plain `window.resize` listener would miss that, since the window itself doesn't change size.

## Zoom & Pan

Added after playtesting feedback that city/ship markers were hard to hit precisely at the default fit-to-container scale, especially on smaller screens. On top of the base "fit to container" scale above, `MapScene` layers a user-controlled zoom/pan:

- **Mouse wheel** — zooms in/out (1.0×–3.5×), centered on the current view
- **Click-and-drag** (or touch-drag) — pans the view once zoomed in; a small movement threshold (4px) distinguishes a genuine drag from a click, so tapping a city/ship still works normally
- **Two-finger pinch** (touch) — zooms, tracked via native Pointer Events (`activePointers` map keyed by `pointerId`), not the Pixi interaction system — panning/zooming is a viewport transform, not something that needs Pixi's hit-testing
- **Double-click/double-tap** — resets zoom and pan to the default fit-to-container view
- **Pan clamping** — the world can be dragged around but not fully off-screen; `applyTransform` computes `maxPanX`/`maxPanY` from how much larger the zoomed world is than the container, so at the default zoom (1.0, already fit) there's nothing to pan

All zoom/pan state lives in `MapScene` itself (`zoom`, `pan`, `containerSize`), not in `GameState` or Svelte component state — it's pure view state, reset on remount, consistent with ADR-004's "ui state is not part of GameState" principle applied to the render layer too.

## Interaction

- **Click a city** → `selectedCityId` is set to that city, and `screen` switches to `'port'` (consistent with "the map is for navigating, the port is for acting" — matches how the existing city-select buttons work, just spatial instead of a button list)
- **Click a ship marker** → `selectedShipId` is set to that ship (and `selectedCityId` follows it, if the ship is in port), `screen` switches to `'port'`
- **Navigation between screens:** a small nav toggle in the port-screen header (`🗺️ Map` / `⚓ Port`) lets the player move between the Map and Port views at will. Ending a turn always returns to the Port screen (via the existing turn-summary → continue flow) — the map is an optional navigation aid, not the game's home screen

## Edge Cases

- **No route between two cities visually adjacent on the map** (e.g. Hamburg–Riga): not drawn as a line — only the 5 documented direct routes (`ROUTES`) are rendered. This matches the Port view's existing `reachableCities()`, which only offers direct destinations.
- **Multiple ships at the same city:** fanned out with a small horizontal offset per ship index, so markers don't fully overlap.
- **Container starts at 0×0** (e.g. mid-layout-transition): `MapScene` skips a resize/redraw pass if the observed size is zero, avoiding a division-by-zero in the scale calculation.
- **Wrecked ships:** simply absent from `state.fleet.ships` (per `fleet-system.ts`), so nothing extra is needed — they're already gone from the list the map iterates over.

## Not in This Pass

- Animated ship movement between turns (the marker jumps to its new interpolated position on state update, it does not tween)
- Real sprite-sheet pixel art (the current pixel-grid icons are procedural placeholders, per "Visual Design" above)

## Related

- ADR-003 (Rendering — PixiJS for the game world; this is PixiJS's first real use)
- ADR-004 (Architecture — render layer consumes `GameState`, UI selection state is not persisted)
- ADR-005 (Art style — pixel art is the target; this pass uses procedural pixel-grid sprites as a placeholder)
- ADR-015 (Per-route & session event risk — the data now visualised as route danger colouring)
- `docs/design/city-graph.md` (city positions, routes, stormRisk/pirateRisk tables)
- `docs/design/mvp-scope.md` (Map view is UI screen #2 of 5)
- `src/render/map-scene.ts`, `src/ui/MapView.svelte` (implementation)
