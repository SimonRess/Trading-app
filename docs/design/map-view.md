# Design: Map View

**Status:** Draft
**Last updated:** 2026-07-17

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

## Visual Design (placeholder art)

ADR-005 commits the project to pixel art long-term, but no asset pipeline or artist exists yet. The MVP map uses **PixiJS `Graphics` primitives** (circles, lines, polygons) rather than sprites:

- **Sea background:** solid dark blue fill (`0x0d1b2a`), matching the existing UI's dark palette
- **Routes:** straight lines between connected cities (per `ROUTES`); a route with a player ship currently on it is drawn brighter/thicker
- **Cities:** a filled circle per city at its documented `position` (`cities.ts`), with a permanent text label (name) beneath it — labels are always visible (only 5 cities; avoids relying on hover, which doesn't exist on touch/mobile). The selected city (`selectedCityId`) gets a highlighted ring
- **Ships:** a small triangle marker. In port, ships fan out slightly above their city's dot so multiple ships at one city don't fully overlap. In transit, the marker is linearly interpolated along its route line based on `turnsRemaining / route.turns`. The selected ship (`selectedShipId`) is drawn in a brighter color

This is explicitly placeholder/programmer art. When pixel art assets exist (post-MVP, per ADR-005), `map-scene.ts`'s draw functions are the only place that needs to change — city/ship positions and the interpolation math stay the same.

## World Coordinate Space & Scaling

`CITIES` positions are defined in a fixed logical space (`x` up to 720, `y` up to 340). The map view canvas is not this exact pixel size — it fills whatever space its container (in the Svelte layout) gives it, which varies by window size and by the foldable Fleet panel's state.

`MapScene` renders everything into a `worldLayer` container sized to a constant `WORLD_WIDTH × WORLD_HEIGHT` (800×420, with padding around the max city coordinates), then scales and centers that layer to fit the actual canvas size:

```
scale = min(canvasWidth / WORLD_WIDTH, canvasHeight / WORLD_HEIGHT)
worldLayer.scale = scale
worldLayer.position = centered within the canvas
```

A `ResizeObserver` on the mount container (not just a `window resize` listener) drives re-scaling, so the map also adapts when the Fleet panel is folded/unfolded — a plain `window.resize` listener would miss that, since the window itself doesn't change size.

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

- Per-route storm-risk visualisation (e.g. tinting a route red in Winter) — `city-graph.md`'s storm-risk table still isn't consumed anywhere in the game logic (see its Implementation Status note); the map has nothing to visualise yet
- Animated ship movement between turns (the marker jumps to its new interpolated position on state update, it does not tween)
- Zoom/pan — 5 cities fit comfortably in one fixed view at MVP scope

## Related

- ADR-003 (Rendering — PixiJS for the game world; this is PixiJS's first real use)
- ADR-004 (Architecture — render layer consumes `GameState`, UI selection state is not persisted)
- ADR-005 (Art style — pixel art is the target; this pass uses `Graphics` primitives as a placeholder)
- `docs/design/city-graph.md` (city positions, routes, the still-unconsumed storm-risk table)
- `docs/design/mvp-scope.md` (Map view is UI screen #2 of 5)
- `src/render/map-scene.ts`, `src/ui/MapView.svelte` (implementation)
