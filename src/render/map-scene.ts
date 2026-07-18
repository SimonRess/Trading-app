import { Application, Container, Graphics, Text } from 'pixi.js';
import type { GameState, CityId, Ship, RoutePosition } from '../game/state/types.ts';
import { CITIES } from '../game/data/cities.ts';
import { ROUTES, routeKey } from '../game/data/routes.ts';

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 420;

const SEA_COLOR = 0x0d1b2a;
const ROUTE_COLOR = 0x3a5a70;
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

export class MapScene {
  private app: Application;
  private worldLayer: Container;
  private routeLayer: Container;
  private cityLayer: Container;
  private shipLayer: Container;
  private callbacks: MapSceneCallbacks;
  private resizeObserver: ResizeObserver | undefined;
  private container: HTMLElement | undefined;

  private containerSize = { width: 0, height: 0 };
  private baseScale = 1;
  private zoom = MIN_ZOOM;
  private pan = { x: 0, y: 0 };

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

    this.drawStaticRoutes();
    this.drawCities();

    this.attachInputHandlers();

    this.resizeObserver = new ResizeObserver(() => {
      if (this.container) this.handleResize(this.container);
    });
    this.resizeObserver.observe(container);
    this.handleResize(container);
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
      const dot = new Graphics()
        .circle(0, 0, 10)
        .fill({ color: CITY_COLOR })
        .stroke({ width: 2, color: 0x3a2810 });
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

  private drawActiveRoutes(state: GameState): void {
    const activeRouteKeys = new Set<string>();
    for (const ship of state.fleet.ships) {
      if (isInTransitPosition(ship.position)) {
        activeRouteKeys.add(routeKey(ship.position.from, ship.position.to));
      }
    }

    this.routeLayer.removeChildren();
    for (const route of ROUTES) {
      const from = CITIES[route.from].position;
      const to = CITIES[route.to].position;
      const isActive = activeRouteKeys.has(routeKey(route.from, route.to));
      const line = new Graphics()
        .moveTo(from.x, from.y)
        .lineTo(to.x, to.y)
        .stroke({
          width: isActive ? 3 : 2,
          color: isActive ? ROUTE_ACTIVE_COLOR : ROUTE_COLOR,
          alpha: isActive ? 0.9 : 0.7,
        });
      this.routeLayer.addChild(line);
    }
  }

  private drawShips(state: GameState, selection: MapSelection): void {
    this.shipLayer.removeChildren();

    const shipsByCity = new Map<CityId, Ship[]>();
    for (const ship of state.fleet.ships) {
      if (typeof ship.position === 'string') {
        const list = shipsByCity.get(ship.position) ?? [];
        list.push(ship);
        shipsByCity.set(ship.position, list);
      }
    }

    for (const [cityId, ships] of shipsByCity) {
      const base = CITIES[cityId].position;
      ships.forEach((ship, index) => {
        const offsetX = (index - (ships.length - 1) / 2) * 14;
        this.drawShipMarker(ship, base.x + offsetX, base.y - 22, selection);
      });
    }

    for (const ship of state.fleet.ships) {
      if (!isInTransitPosition(ship.position)) continue;
      const pos = ship.position;
      const route = ROUTES.find(
        r => (r.from === pos.from && r.to === pos.to) || (r.to === pos.from && r.from === pos.to),
      );
      if (!route) continue;

      const from = CITIES[pos.from].position;
      const to = CITIES[pos.to].position;
      const progress = 1 - pos.turnsRemaining / route.turns;
      const x = from.x + (to.x - from.x) * progress;
      const y = from.y + (to.y - from.y) * progress;

      this.drawShipMarker(ship, x, y, selection);
    }
  }

  private drawShipMarker(ship: Ship, x: number, y: number, selection: MapSelection): void {
    const selected = ship.id === selection.selectedShipId;
    const marker = new Graphics()
      .poly([0, -7, 6, 6, -6, 6], true)
      .fill({ color: selected ? SHIP_SELECTED_COLOR : SHIP_COLOR })
      .stroke({ width: 1.5, color: 0x2a1c08 });
    marker.position.set(x, y);
    marker.eventMode = 'static';
    marker.cursor = 'pointer';
    marker.on('pointertap', (event) => {
      event.stopPropagation();
      this.callbacks.onShipClick?.(ship.id);
    });
    this.shipLayer.addChild(marker);

    if (selected) {
      const label = new Text({
        text: ship.name,
        style: { fill: SHIP_SELECTED_COLOR, fontSize: 11, fontFamily: 'Georgia' },
      });
      label.anchor.set(0.5, 1);
      label.position.set(x, y - 10);
      this.shipLayer.addChild(label);
    }
  }

  update(state: GameState, selection: MapSelection): void {
    this.drawActiveRoutes(state);
    this.drawSelectionRing(selection);
    this.drawShips(state, selection);
  }

  destroy(): void {
    this.detachInputHandlers();
    this.resizeObserver?.disconnect();
    this.app.destroy(true, { children: true });
  }
}
