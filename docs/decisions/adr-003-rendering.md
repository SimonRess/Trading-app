# ADR-003: Rendering Approach

> Migrated from docs/03_rendering.md

**Date:** 2026-07-13  
**Status:** Accepted  
**Deciders:** Simon

## Context

The game has two structurally different visual surfaces that have opposing rendering requirements. The game world (map, ships, port scenes, animated tiles) needs efficient sprite rendering, a scene graph, and smooth animation. The UI layer (trade menus, dialogs, inventory panels, character screens) is information-dense and benefits from the DOM's layout engine, accessibility features, and CSS styling. A single rendering strategy cannot serve both surfaces well. The question was whether to use one renderer for everything or split them.

## Decision

Use **PixiJS** (WebGL-backed) for the game world and **DOM/CSS via Svelte** for all UI panels.

The two layers are stacked: the PixiJS canvas sits underneath, with Svelte UI components overlaid via absolute positioning. PixiJS handles the map, ships, port scenes, and all animation. Svelte handles every menu, dialog, and information panel. This is a proven pattern for web games.

## Alternatives Considered

- **DOM / CSS only** — accessibility built-in, easy parchment/wood-panel theming via CSS, responsive by default. Rejected because the DOM cannot efficiently render sprite sheets, animated tiles, or an interactive map. It handles the UI surface well but is not suited to the game-world layer.

- **Canvas 2D API** — simple and widely supported; good for 2D sprites, tile maps, and basic animation. Rejected because it has no built-in scene graph (all state and hit-testing is manual), and performance degrades with many draw calls. PixiJS solves both problems while sitting on the same canvas element.

- **SVG** — resolution-independent and well-suited to maps with clickable regions; animatable via CSS. Rejected because performance degrades significantly with many animated elements, and sprite-sheet workflows are complex and non-standard in SVG. The map will have many moving ships and animated effects.

- **WebGL directly (no library)** — maximum control and no abstraction overhead. Not seriously considered: PixiJS provides a scene graph, sprite batching, and texture management on top of WebGL with minimal overhead and good TypeScript support. Writing that layer from scratch would add months of work for no gain.

## Consequences

✅ GPU-accelerated rendering for the game world — handles thousands of sprites at 60 fps easily  
✅ PixiJS scene graph and sprite batching means no manual hit-testing or draw-call management  
✅ Svelte's DOM rendering handles the UI layer with full CSS flexibility and accessibility  
✅ CSS makes the parchment/wood-panel aesthetic straightforward to implement in the UI layer  
✅ Proven stacking pattern (canvas beneath, DOM overlay) — well-documented in the web game community  
⚠️  Two rendering contexts to initialise, manage, and tear down  
⚠️  Input events must be explicitly routed — PixiJS and the DOM have separate event systems; clicks on UI panels must not bleed through to the canvas  
⚠️  The game-world layer has no built-in accessibility (no screen reader support for the map)  
🔒  Commits the game-world layer to PixiJS's scene graph API and texture pipeline  
🔒  The stacking approach means the UI layer always renders on top — game-world elements cannot visually overlap UI panels  

## Links

- Supersedes: —  
- Superseded by: —  
- Related ADRs: ADR-002 (Language & Framework — establishes Svelte + PixiJS as the chosen stack; this ADR elaborates the rendering split), ADR-004 (Architecture — defines how state flows between the two layers)  
- Related design docs: —
