import type { Container } from 'pixi.js';

// Generic scene-stack primitive (docs/design/city-view.md "Architecture" and
// "Scene Navigation Model"). One PixiJS Application/root Container hosts many
// Scenes; only the top of the stack is visible at a time. Scenes are never
// destroyed on hide, only their container's `visible` flag toggles — the
// same "hidden, not destroyed" rule map-scene.ts's persistent-mount fix
// established (ADR-017), generalised from a single screen toggle to an
// arbitrary-depth stack. Registering the same id twice is a no-op — callers
// (e.g. CityScene switching which city's buildings to show) are expected to
// register once per distinct scene and reuse it afterwards.
export interface Scene {
  container: Container;
  onShow?(): void;
  onHide?(): void;
  destroy(): void;
}

export class SceneManager {
  private root: Container;
  private scenes = new Map<string, Scene>();
  private stack: string[] = [];

  constructor(root: Container) {
    this.root = root;
  }

  has(id: string): boolean {
    return this.scenes.has(id);
  }

  register(id: string, scene: Scene): void {
    if (this.scenes.has(id)) return;
    scene.container.visible = false;
    this.root.addChild(scene.container);
    this.scenes.set(id, scene);
  }

  push(id: string): void {
    if (!this.scenes.has(id)) return;
    const current = this.stack[this.stack.length - 1];
    if (current === id) return;
    if (current !== undefined) this.setVisible(current, false);
    this.stack.push(id);
    this.setVisible(id, true);
  }

  pop(): void {
    if (this.stack.length <= 1) return;
    const current = this.stack.pop();
    if (current !== undefined) this.setVisible(current, false);
    const next = this.stack[this.stack.length - 1];
    if (next !== undefined) this.setVisible(next, true);
  }

  get currentId(): string | undefined {
    return this.stack[this.stack.length - 1];
  }

  get depth(): number {
    return this.stack.length;
  }

  private setVisible(id: string, visible: boolean): void {
    const scene = this.scenes.get(id);
    if (!scene) return;
    scene.container.visible = visible;
    if (visible) scene.onShow?.();
    else scene.onHide?.();
  }

  destroy(): void {
    for (const scene of this.scenes.values()) scene.destroy();
    this.scenes.clear();
    this.stack = [];
  }
}
