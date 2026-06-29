# Decision 2: Programming Language & Framework

## Why This Matters

The language and framework determine developer experience, available libraries, long-term maintainability, and how easily game logic can be separated from UI rendering.

## Options

### TypeScript + React
**Pros**
- Massive ecosystem; easy to find help and libraries
- Excellent tooling (Vite, ESLint, testing)
- Component model suits UI panels (trade screens, inventory)

**Cons**
- Not a game framework; managing a game loop inside React is awkward
- Virtual DOM overhead irrelevant for canvas rendering

### TypeScript + Svelte / SvelteKit
**Pros**
- Much less boilerplate than React
- Reactive stores map naturally onto game state domains
- Smaller bundle size
- Compile-time reactivity — no virtual DOM

**Cons**
- Smaller ecosystem and community than React

### TypeScript + Phaser.js
**Pros**
- Purpose-built 2D game engine
- Built-in scene management, sprite batching, input, audio, physics
- Large game-specific community and examples

**Cons**
- UI-heavy screens (dialogs, trade menus) require more boilerplate
- Less suited to the "business simulation" half of the game

### GDScript + Godot (HTML5 export)
**Pros**
- Full game engine with scene graph, physics, animation
- Exports to HTML5, desktop, and mobile from one codebase

**Cons**
- GDScript is niche; harder to find web developers familiar with it
- Web export has known performance and audio quirks

### Rust + Bevy (WASM)
**Pros**
- Modern ECS architecture; excellent performance
- Compiles to WebAssembly

**Cons**
- Very steep learning curve
- Ecosystem still maturing; fewer ready-made assets

## Decision

**→ TypeScript with a hybrid approach**

- **Svelte** for UI layer (menus, trade screens, character panels, dialogs)
- **PixiJS** for the game render layer (map, ships, city animations)

This mirrors how the original game separated the "world view" (isometric port scenes) from the "business simulation" panels. TypeScript across both layers keeps the codebase unified.
