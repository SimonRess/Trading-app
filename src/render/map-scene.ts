import { Application, Container, Graphics, Text } from 'pixi.js';
import type { GameState, CityId, Ship, RoutePosition, RiskState, Season } from '../game/state/types.ts';
import { CITIES } from '../game/data/cities.ts';
import { ROUTES, routeKey, type Route } from '../game/data/routes.ts';

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 420;

const SEA_COLOR = 0x0d1b2a;
const ROUTE_COLOR = 0x3a5a70;
const ROUTE_DANGER_COLOR = 0xc23b3b;
const ROUTE_ACTIVE_COLOR = 0xd4a843;
const CITY_COLOR = 0xd4a843;
const CITY_RING_COLOR = 0xf0dca0;
const CITY_LABEL_COLOR = 0xe8dcc8;
const SHIP_COLOR = 0xc8a860;
const SHIP_SELECTED_COLOR = 0xffe08a;

const MIN_ZOOM = 1;
const MAX_ZOOM = 3.5;
const DRAG_THRESHOLD_PX = 4;
const WHEEL_ZOOM_SPEED = 0.0012;

// How long a ship marker takes to glide to its new logical position (port
// fan-out slot, a point along its route, or back into port) whenever
// update() reports a change — turns resolve instantly in game logic, but
// snapping the marker straight there read as teleporting. Purely a render
// concern: game state has no notion of "mid-tween".
const SHIP_MOVE_DURATION_MS = 600;

function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}

// Route-danger colouring (see ADR-015 for the risk model). This duplicates
// the tiny "normalise route risk against the network average" calculation
// from risk-system.ts rather than importing it, deliberately keeping
// map-scene.ts free of any src/game/systems/ dependency — see map-view.md
// "Architecture".
const RISK_FACTOR_MIN = 0.3;
const RISK_FACTOR_MAX = 3.0;

function networkAverageRisk(kind: 'storm' | 'pirate'): number {
  const values = ROUTES.flatMap(r => Object.values(kind === 'storm' ? r.stormRisk : r.pirateRisk));
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

const STORM_RISK_BASELINE = networkAverageRisk('storm');
const PIRATE_RISK_BASELINE = networkAverageRisk('pirate');

function routeDangerFactor(route: Route, season: Season, risk: RiskState, kind: 'storm' | 'pirate'): number {
  const baseline = kind === 'storm' ? STORM_RISK_BASELINE : PIRATE_RISK_BASELINE;
  const base = kind === 'storm' ? route.stormRisk[season] : route.pirateRisk[season];
  const modifier = risk.routeModifiers[routeKey(route.from, route.to)] ?? 1.0;
  return Math.min(RISK_FACTOR_MAX, Math.max(RISK_FACTOR_MIN, (base * modifier) / baseline));
}

function lerpColor(from: number, to: number, t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  const r = Math.round(fr + (tr - fr) * clamped);
  const g = Math.round(fg + (tg - fg) * clamped);
  const b = Math.round(fb + (tb - fb) * clamped);
  return (r << 16) | (g << 8) | b;
}

// Placeholder pixel-art icons (ADR-005 commits to pixel art long-term; no
// asset pipeline or artist exists yet — see map-view.md "Visual Design").
// Drawn as a grid of filled Graphics rects rather than a smooth circle/
// triangle: PixiJS Graphics fills are vector (always crisp-edged
// rectangles regardless of scale), so a deliberately blocky pixel-grid
// pattern reads as pixel art without needing a texture/sprite-sheet
// pipeline. Swapping in real sprite-sheet assets later only touches this
// function and the two pattern constants below.
const CITY_PIXEL_PATTERN = [
  '#.#.#.#',
  '#######',
  '.#####.',
  '.#####.',
  '.#.#.#.',
  '.#####.',
  '.#####.',
  '.#####.',
];

// Sail (rows 0-3) and hull (rows 6-8) are separated by two single-pixel
// mast rows (4-5) instead of the sail's base flowing straight into the
// hull's top edge — otherwise the two widen into each other and read as
// one shape instead of a mast-and-sail atop a hull.
const SHIP_PIXEL_PATTERN = [
  '....#....',
  '...###...',
  '..#####..',
  '.#######.',
  '....#....',
  '....#....',
  '..#####..',
  '.#######.',
  '#########',
];

function drawPixelSprite(pattern: string[], pixelSize: number, color: number): Graphics {
  return drawPixelSpriteInto(new Graphics(), pattern, pixelSize, color);
}

function drawPixelSpriteInto(g: Graphics, pattern: string[], pixelSize: number, color: number): Graphics {
  g.clear();
  const width = Math.max(...pattern.map(row => row.length));
  const offsetX = (width * pixelSize) / 2;
  const offsetY = (pattern.length * pixelSize) / 2;

  for (let y = 0; y < pattern.length; y++) {
    const row = pattern[y] ?? '';
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '#') {
        g.rect(x * pixelSize - offsetX, y * pixelSize - offsetY, pixelSize, pixelSize);
      }
    }
  }

  g.fill({ color });
  return g;
}

export interface MapSelection {
  selectedShipId?: string;
  selectedCityId?: CityId;
}

export interface MapSceneCallbacks {
  onCityClick?: (cityId: CityId) => void;
  onShipClick?: (shipId: string) => void;
}

function isInTransitPosition(position: Ship['position']): position is RoutePosition {
  return typeof position !== 'string';
}

interface PointerPoint {
  x: number;
  y: number;
}

interface ShipMarker {
  container: Container;
  icon: Graphics;
  label: Text;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  animStart: number;
}

export class MapScene {
  private app: Application;
  private worldLayer: Container;
  private routeLayer: Container;
  private cityLayer: Container;
  private shipLayer: Container;
  private hudLayer: Container;
  private callbacks: MapSceneCallbacks;
  private resizeObserver: ResizeObserver | undefined;
  private container: HTMLElement | undefined;

  private containerSize = { width: 0, height: 0 };
  private baseScale = 1;
  private zoom = MIN_ZOOM;
  private pan = { x: 0, y: 0 };

  private shipMarkers = new Map<string, ShipMarker>();
  private lastState: GameState | undefined;

  private activePointers = new Map<number, PointerPoint>();
  private dragStart: PointerPoint = { x: 0, y: 0 };
  private dragStartPan: PointerPoint = { x: 0, y: 0 };
  private isDragging = false;
  private hasDragged = false;
  private pinchStartDistance = 0;
  private pinchStartZoom = MIN_ZOOM;

  private boundHandlers: {
    wheel: (e: WheelEvent) => void;
    pointerDown: (e: PointerEvent) => void;
    pointerMove: (e: PointerEvent) => void;
    pointerUp: (e: PointerEvent) => void;
    doubleClick: () => void;
  };

  constructor(callbacks: MapSceneCallbacks = {}) {
    this.callbacks = callbacks;
    this.app = new Application();
    this.worldLayer = new Container();
    this.routeLayer = new Container();
    this.cityLayer = new Container();
    this.shipLayer = new Container();
    this.hudLayer = new Container();

    this.boundHandlers = {
      wheel: this.handleWheel.bind(this),
      pointerDown: this.handlePointerDown.bind(this),
      pointerMove: this.handlePointerMove.bind(this),
      pointerUp: this.handlePointerUp.bind(this),
      doubleClick: this.resetView.bind(this),
    };
  }

  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    await this.app.init({
      backgroundColor: SEA_COLOR,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      width: container.clientWidth || 400,
      height: container.clientHeight || 300,
    });

    container.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = 'none';
    this.app.canvas.style.cursor = 'grab';

    this.worldLayer.addChild(this.routeLayer, this.cityLayer, this.shipLayer);
    this.app.stage.addChild(this.worldLayer);
    this.app.stage.addChild(this.hudLayer);

    this.drawStaticRoutes();
    this.drawCities();
    this.drawLegend();
    // Fallback position using the same fallback dimensions as app.init above,
    // in case the container is 0×0 at mount (it will be, if MapView is
    // mounted while its parent is display:none — see MapView.svelte /
    // map-view.md "Persistent mount") and handleResize's zero-size guard
    // skips positioning it. Corrected for real once handleResize actually
    // runs with real dimensions.
    this.hudLayer.position.set(12, (container.clientHeight || 300) - 54);

    this.attachInputHandlers();
    this.app.ticker.add(this.tickShipAnimations);

    this.resizeObserver = new ResizeObserver(() => {
      if (this.container) this.handleResize(this.container);
    });
    this.resizeObserver.observe(container);
    this.handleResize(container);
  }

  // Called by MapView.svelte whenever the map's container transitions from
  // hidden to visible. ResizeObserver *should* catch a display:none -> block
  // transition on its own, but that behaviour has known cross-browser
  // inconsistencies — this is a deliberate, redundant catch-all so the
  // layout (in particular the legend's position, which the zero-size guard
  // in handleResize would otherwise leave un-set) is never left stale.
  refreshLayout(): void {
    if (this.container) this.handleResize(this.container);
  }

  private attachInputHandlers(): void {
    const canvas = this.app.canvas;
    canvas.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });
    canvas.addEventListener('pointerdown', this.boundHandlers.pointerDown);
    window.addEventListener('pointermove', this.boundHandlers.pointerMove);
    window.addEventListener('pointerup', this.boundHandlers.pointerUp);
    window.addEventListener('pointercancel', this.boundHandlers.pointerUp);
    canvas.addEventListener('dblclick', this.boundHandlers.doubleClick);
  }

  private detachInputHandlers(): void {
    const canvas = this.app.canvas;
    canvas.removeEventListener('wheel', this.boundHandlers.wheel);
    canvas.removeEventListener('pointerdown', this.boundHandlers.pointerDown);
    window.removeEventListener('pointermove', this.boundHandlers.pointerMove);
    window.removeEventListener('pointerup', this.boundHandlers.pointerUp);
    window.removeEventListener('pointercancel', this.boundHandlers.pointerUp);
    canvas.removeEventListener('dblclick', this.boundHandlers.doubleClick);
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const next = this.zoom - event.deltaY * WHEEL_ZOOM_SPEED;
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    this.applyTransform();
  }

  private handlePointerDown(event: PointerEvent): void {
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 2) {
      this.pinchStartDistance = this.currentPinchDistance();
      this.pinchStartZoom = this.zoom;
      this.isDragging = false;
      return;
    }

    if (this.activePointers.size === 1) {
      this.isDragging = true;
      this.hasDragged = false;
      this.dragStart = { x: event.clientX, y: event.clientY };
      this.dragStartPan = { ...this.pan };
    }
  }

  private currentPinchDistance(): number {
    const points = [...this.activePointers.values()];
    const a = points[0];
    const b = points[1];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.activePointers.has(event.pointerId)) return;
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 2) {
      const distance = this.currentPinchDistance();
      if (this.pinchStartDistance > 0) {
        const scaleFactor = distance / this.pinchStartDistance;
        this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.pinchStartZoom * scaleFactor));
        this.applyTransform();
      }
      return;
    }

    if (this.isDragging) {
      const dx = event.clientX - this.dragStart.x;
      const dy = event.clientY - this.dragStart.y;
      if (!this.hasDragged && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        this.hasDragged = true;
        this.app.canvas.style.cursor = 'grabbing';
      }
      if (this.hasDragged) {
        this.pan = { x: this.dragStartPan.x + dx, y: this.dragStartPan.y + dy };
        this.applyTransform();
      }
    }
  }

  private handlePointerUp(event: PointerEvent): void {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size < 2) this.pinchStartDistance = 0;
    if (this.activePointers.size === 0) {
      this.isDragging = false;
      this.hasDragged = false;
      this.app.canvas.style.cursor = 'grab';
    }
  }

  private resetView(): void {
    this.zoom = MIN_ZOOM;
    this.pan = { x: 0, y: 0 };
    this.applyTransform();
  }

  private handleResize(container: HTMLElement): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    this.containerSize = { width, height };
    this.app.renderer.resize(width, height);
    this.baseScale = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT);
    this.applyTransform();
    this.hudLayer.position.set(12, height - 54);
  }

  // Combines the base "fit to container" scale with user zoom/pan, and
  // clamps pan so the world can't be dragged fully out of view.
  private applyTransform(): void {
    const { width, height } = this.containerSize;
    if (width === 0 || height === 0) return;

    const scale = this.baseScale * this.zoom;
    this.worldLayer.scale.set(scale);

    const worldW = WORLD_WIDTH * scale;
    const worldH = WORLD_HEIGHT * scale;
    const centeredX = (width - worldW) / 2;
    const centeredY = (height - worldH) / 2;

    const maxPanX = Math.max(0, (worldW - width) / 2);
    const maxPanY = Math.max(0, (worldH - height) / 2);
    this.pan.x = Math.min(maxPanX, Math.max(-maxPanX, this.pan.x));
    this.pan.y = Math.min(maxPanY, Math.max(-maxPanY, this.pan.y));

    this.worldLayer.position.set(centeredX + this.pan.x, centeredY + this.pan.y);
  }

  // Fixed-position legend for the route-danger colouring, drawn once into
  // hudLayer (a child of app.stage, not worldLayer — it must not scale or
  // pan with the map, only reposition on resize).
  private drawLegend(): void {
    this.hudLayer.removeChildren();

    const rowGap = 16;
    const swatches: Array<{ label: string; color: number; y: number }> = [
      { label: 'Calm route', color: ROUTE_COLOR, y: 0 },
      { label: 'Dangerous route', color: ROUTE_DANGER_COLOR, y: rowGap },
      { label: 'Ship en route', color: ROUTE_ACTIVE_COLOR, y: rowGap * 2 },
    ];

    for (const swatch of swatches) {
      const line = new Graphics()
        .moveTo(0, swatch.y)
        .lineTo(18, swatch.y)
        .stroke({ width: 3, color: swatch.color, alpha: 0.9 });
      const label = new Text({
        text: swatch.label,
        style: { fill: CITY_LABEL_COLOR, fontSize: 11, fontFamily: 'Georgia' },
      });
      label.anchor.set(0, 0.5);
      label.position.set(24, swatch.y);
      this.hudLayer.addChild(line, label);
    }
  }

  private drawStaticRoutes(): void {
    this.routeLayer.removeChildren();
    for (const route of ROUTES) {
      const from = CITIES[route.from].position;
      const to = CITIES[route.to].position;
      const line = new Graphics()
        .moveTo(from.x, from.y)
        .lineTo(to.x, to.y)
        .stroke({ width: 2, color: ROUTE_COLOR, alpha: 0.7 });
      this.routeLayer.addChild(line);
    }
  }

  private drawCities(): void {
    this.cityLayer.removeChildren();
    for (const city of Object.values(CITIES)) {
      const dot = drawPixelSprite(CITY_PIXEL_PATTERN, 2.6, CITY_COLOR);
      dot.position.set(city.position.x, city.position.y);
      dot.eventMode = 'static';
      dot.cursor = 'pointer';
      dot.label = `city:${city.id}`;
      dot.on('pointertap', () => {
        this.callbacks.onCityClick?.(city.id);
      });

      const label = new Text({
        text: city.name,
        style: { fill: CITY_LABEL_COLOR, fontSize: 13, fontFamily: 'Georgia' },
      });
      label.anchor.set(0.5, 0);
      label.position.set(city.position.x, city.position.y + 14);

      this.cityLayer.addChild(dot, label);
    }
  }

  private drawSelectionRing(selection: MapSelection): void {
    const existing = this.cityLayer.getChildByLabel('selection-ring');
    if (existing) this.cityLayer.removeChild(existing);

    if (!selection.selectedCityId) return;
    const city = CITIES[selection.selectedCityId];
    const ring = new Graphics()
      .circle(0, 0, 15)
      .stroke({ width: 2, color: CITY_RING_COLOR, alpha: 0.9 });
    ring.position.set(city.position.x, city.position.y);
    ring.label = 'selection-ring';
    this.cityLayer.addChild(ring);
  }

  // Routes are tinted by their current combined storm+pirate danger (ADR-015
  // risk model — see routeDangerFactor above) so the player gets a visual
  // read on regional risk directly from the map. A route a ship is actively
  // sailing is drawn gold and thicker instead, taking priority over the
  // danger tint — "something is happening here right now" is a more
  // actionable signal than ambient danger level.
  private drawRoutes(state: GameState): void {
    const activeRouteKeys = new Set<string>();
    for (const ship of state.fleet.ships) {
      if (isInTransitPosition(ship.position)) {
        activeRouteKeys.add(routeKey(ship.position.from, ship.position.to));
      }
    }

    const season = state.calendar.season;

    this.routeLayer.removeChildren();
    for (const route of ROUTES) {
      const from = CITIES[route.from].position;
      const to = CITIES[route.to].position;
      const isActive = activeRouteKeys.has(routeKey(route.from, route.to));

      const stormFactor = routeDangerFactor(route, season, state.risk, 'storm');
      const pirateFactor = routeDangerFactor(route, season, state.risk, 'pirate');
      const danger = (stormFactor + pirateFactor) / 2;
      // danger is centred on 1.0 (RISK_FACTOR_MIN..MAX = 0.3..3.0); map the
      // "above average" half of that range onto the calm->danger gradient.
      const dangerT = (danger - 1.0) / (RISK_FACTOR_MAX - 1.0);
      const dangerColor = lerpColor(ROUTE_COLOR, ROUTE_DANGER_COLOR, dangerT);

      const line = new Graphics()
        .moveTo(from.x, from.y)
        .lineTo(to.x, to.y)
        .stroke({
          width: isActive ? 4 : 2.5,
          color: isActive ? ROUTE_ACTIVE_COLOR : dangerColor,
          alpha: isActive ? 0.95 : 0.8,
        });
      this.routeLayer.addChild(line);
    }
  }

  private shipTargetPosition(ship: Ship): { x: number; y: number } | undefined {
    if (typeof ship.position === 'string') {
      const ships = this.shipsAtCity(ship.position);
      const index = ships.indexOf(ship.id);
      const base = CITIES[ship.position].position;
      const offsetX = (index - (ships.length - 1) / 2) * 14;
      return { x: base.x + offsetX, y: base.y - 22 };
    }

    const pos = ship.position;
    const route = ROUTES.find(
      r => (r.from === pos.from && r.to === pos.to) || (r.to === pos.from && r.from === pos.to),
    );
    if (!route) return undefined;

    const from = CITIES[pos.from].position;
    const to = CITIES[pos.to].position;
    const progress = 1 - pos.turnsRemaining / route.turns;
    return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
  }

  // Stable ordering of ships currently in port at a city, used to fan
  // multiple ships out around the same city marker without them jittering
  // relative to each other between updates.
  private shipsAtCity(cityId: CityId): string[] {
    return this.lastState?.fleet.ships
      .filter(s => s.position === cityId)
      .map(s => s.id) ?? [];
  }

  private drawShips(state: GameState, selection: MapSelection): void {
    this.lastState = state;
    const currentIds = new Set(state.fleet.ships.map(s => s.id));

    for (const [id, marker] of this.shipMarkers) {
      if (!currentIds.has(id)) {
        this.shipLayer.removeChild(marker.container);
        this.shipMarkers.delete(id);
      }
    }

    for (const ship of state.fleet.ships) {
      const target = this.shipTargetPosition(ship);
      if (!target) continue;
      this.updateShipMarker(ship, target.x, target.y, selection);
    }
  }

  private updateShipMarker(ship: Ship, x: number, y: number, selection: MapSelection): void {
    const selected = ship.id === selection.selectedShipId;
    let marker = this.shipMarkers.get(ship.id);

    if (!marker) {
      const container = new Container();
      const icon = drawPixelSprite(SHIP_PIXEL_PATTERN, 1.5, SHIP_COLOR);
      const label = new Text({ text: ship.name, style: { fill: SHIP_SELECTED_COLOR, fontSize: 11, fontFamily: 'Georgia' } });
      label.anchor.set(0.5, 1);
      label.position.set(0, -10);
      container.addChild(icon, label);
      container.eventMode = 'static';
      container.cursor = 'pointer';
      container.on('pointertap', (event) => {
        event.stopPropagation();
        this.callbacks.onShipClick?.(ship.id);
      });
      container.position.set(x, y);
      this.shipLayer.addChild(container);

      marker = { container, icon, label, startX: x, startY: y, targetX: x, targetY: y, animStart: performance.now() - SHIP_MOVE_DURATION_MS };
      this.shipMarkers.set(ship.id, marker);
    } else if (marker.targetX !== x || marker.targetY !== y) {
      marker.startX = marker.container.position.x;
      marker.startY = marker.container.position.y;
      marker.targetX = x;
      marker.targetY = y;
      marker.animStart = performance.now();
    }

    drawPixelSpriteInto(marker.icon, SHIP_PIXEL_PATTERN, 1.5, selected ? SHIP_SELECTED_COLOR : SHIP_COLOR);
    marker.label.text = ship.name;
    marker.label.visible = selected;
  }

  update(state: GameState, selection: MapSelection): void {
    this.drawRoutes(state);
    this.drawSelectionRing(selection);
    this.drawShips(state, selection);
  }

  destroy(): void {
    this.detachInputHandlers();
    this.app.ticker.remove(this.tickShipAnimations);
    this.resizeObserver?.disconnect();
    this.app.destroy(true, { children: true });
  }

  private tickShipAnimations = (): void => {
    const now = performance.now();
    for (const marker of this.shipMarkers.values()) {
      const t = easeOutCubic((now - marker.animStart) / SHIP_MOVE_DURATION_MS);
      marker.container.position.set(
        marker.startX + (marker.targetX - marker.startX) * t,
        marker.startY + (marker.targetY - marker.startY) * t,
      );
    }
  };
}
