# Decision 3: Rendering Approach

## Why This Matters

The game has two visually distinct areas: an interactive world map / city views, and information-heavy UI panels. These may benefit from different rendering strategies.

## Options

### DOM / CSS Only
**Pros**
- Accessibility built-in (screen readers, keyboard nav)
- Easy to style with parchment/wood-panel themes using CSS
- Responsive by default

**Cons**
- Cannot efficiently render sprite sheets, animated tiles, or an isometric map
- Not suited for the game-world visual layer

### Canvas 2D API
**Pros**
- Simple, widely supported API
- Good for 2D sprites, tile maps, and basic animation

**Cons**
- No built-in scene graph; all state and hit-testing is manual
- Performance degrades with many draw calls

### WebGL / PixiJS
**Pros**
- Hardware-accelerated via GPU
- PixiJS provides a scene graph, sprite batching, and texture management on top of WebGL
- Handles thousands of sprites at 60 fps easily
- Good TypeScript support

**Cons**
- More setup than Canvas 2D
- Slight overkill if the map is mostly static, but the overhead is negligible

### SVG
**Pros**
- Resolution-independent; great for maps with clickable regions
- Easy to animate with CSS

**Cons**
- Performance degrades with many animated elements
- Complex sprite-sheet workflows

## Decision

**→ PixiJS for the game world; DOM/CSS for UI panels**

PixiJS handles the map, ships, port scenes, and any animation. Svelte components handle all menus, dialogs, and information panels. The two layers are stacked: PixiJS canvas underneath, Svelte UI overlaid via absolute positioning. This is a proven pattern for web games.
