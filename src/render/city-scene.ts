import { Application, Container, Text } from 'pixi.js';
import type { CityId } from '../game/state/types.ts';
import { isShipyardCity } from '../game/data/ships.ts';
import { drawPixelSprite } from './pixel-art.ts';
import { SceneManager } from './scene-manager.ts';

const WORLD_WIDTH = 400;
const WORLD_HEIGHT = 300;
const SKY_COLOR = 0x1a1408;
const LABEL_COLOR = 0xe8dcc8;

export type BuildingId =
  | 'harbor'
  | 'trading-post'
  | 'shipyard'
  | 'church'
  | 'counting-house'
  | 'merchants-house'
  | 'town-hall'
  | 'warehouse-district';

interface BuildingDef {
  id: BuildingId;
  label: string;
  color: number;
  position: { x: number; y: number };
  shipyardOnly?: boolean;
}

// Fixed layout shared by every city (docs/design/city-view.md "Open
// Questions": identical positions across cities for predictability) — only
// presence/absence varies (Shipyard only in SHIPYARD_CITIES, per
// isShipyardCity, matching the existing Shipyard-section gate in App.svelte).
const BUILDINGS: BuildingDef[] = [
  { id: 'harbor', label: 'Harbor', color: 0x3a5a70, position: { x: 60, y: 220 } },
  { id: 'trading-post', label: 'Trading Post', color: 0xd4a843, position: { x: 200, y: 220 } },
  { id: 'shipyard', label: 'Shipyard', color: 0xc8a860, position: { x: 340, y: 220 }, shipyardOnly: true },
  { id: 'church', label: 'Church', color: 0xe8dcc8, position: { x: 60, y: 100 } },
  { id: 'counting-house', label: 'Counting House', color: 0xc09040, position: { x: 200, y: 60 } },
  { id: 'merchants-house', label: "Merchant's House", color: 0xb08a50, position: { x: 340, y: 100 } },
  { id: 'town-hall', label: 'Town Hall', color: 0xf0dca0, position: { x: 130, y: 150 } },
  { id: 'warehouse-district', label: 'Warehouses', color: 0x9a8060, position: { x: 270, y: 150 } },
];

// One shared generic building silhouette for this skeleton pass — buildings
// are distinguished by color and label, not bespoke art (docs/design/
// city-view.md step 1: "prove the rendering approach", not final visuals).
// Bespoke per-building silhouettes are a later polish pass.
const BUILDING_PIXEL_PATTERN = [
  '..####..',
  '.######.',
  '########',
  '#.#..#.#',
  '#.#..#.#',
  '#.####.#',
];

export interface CitySceneCallbacks {
  onBuildingClick?: (buildingId: BuildingId) => void;
}

export class CityScene {
  private app: Application;
  private sceneManager: SceneManager | undefined;
  private callbacks: CitySceneCallbacks;
  private container: HTMLElement | undefined;
  private containerSize = { width: 0, height: 0 };
  private resizeObserver: ResizeObserver | undefined;

  constructor(callbacks: CitySceneCallbacks = {}) {
    this.callbacks = callbacks;
    this.app = new Application();
  }

  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    await this.app.init({
      backgroundColor: SKY_COLOR,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      width: container.clientWidth || 400,
      height: container.clientHeight || 300,
    });

    container.appendChild(this.app.canvas);

    const worldLayer = new Container();
    this.app.stage.addChild(worldLayer);
    this.sceneManager = new SceneManager(worldLayer);

    this.resizeObserver = new ResizeObserver(() => {
      if (this.container) this.handleResize(this.container);
    });
    this.resizeObserver.observe(container);
    this.handleResize(container);
  }

  // Called whenever the displayed city changes (e.g. the player's active
  // ship is in a different port). Builds that city's building scene once
  // and registers it with the SceneManager; switching back to an
  // already-visited city in the same session reuses the existing scene
  // rather than rebuilding it — the same "hidden, not destroyed" rule
  // scene-manager.ts documents.
  showCity(cityId: CityId): void {
    if (!this.sceneManager) return;
    const id = `city:${cityId}`;
    if (!this.sceneManager.has(id)) {
      this.sceneManager.register(id, this.buildCityScene(cityId));
    }
    this.sceneManager.push(id);
  }

  private buildCityScene(cityId: CityId) {
    const container = new Container();
    const buildings = BUILDINGS.filter(b => !b.shipyardOnly || isShipyardCity(cityId));

    for (const building of buildings) {
      const icon = drawPixelSprite(BUILDING_PIXEL_PATTERN, 4, building.color);
      icon.position.set(building.position.x, building.position.y);
      icon.eventMode = 'static';
      icon.cursor = 'pointer';
      icon.on('pointertap', () => {
        this.callbacks.onBuildingClick?.(building.id);
      });
      container.addChild(icon);

      const label = new Text({
        text: building.label,
        style: { fill: LABEL_COLOR, fontSize: 12, fontFamily: 'Georgia' },
      });
      label.anchor.set(0.5, 0);
      label.position.set(building.position.x, building.position.y + 20);
      container.addChild(label);
    }

    return {
      container,
      destroy: () => {
        container.destroy({ children: true });
      },
    };
  }

  private handleResize(container: HTMLElement): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    this.containerSize = { width, height };
    this.app.renderer.resize(width, height);

    const scale = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT);
    const worldLayer = this.app.stage.children[0];
    if (!worldLayer) return;
    worldLayer.scale.set(scale);
    worldLayer.position.set(
      (width - WORLD_WIDTH * scale) / 2,
      (height - WORLD_HEIGHT * scale) / 2,
    );
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.sceneManager?.destroy();
    this.app.destroy(true, { children: true });
  }
}
