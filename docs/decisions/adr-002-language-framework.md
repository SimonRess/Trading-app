# ADR-002: Programming Language & Framework

> Migrated from docs/02_language_and_framework.md

**Date:** 2026-07-13  
**Status:** Accepted  
**Deciders:** Simon

## Context

The game has two structurally different concerns that need to coexist: a game-world render layer (map, ships, animated port scenes) and a business-simulation UI layer (trade menus, dialogs, inventory panels, character screens). The language and framework choice determines how cleanly these two concerns can be separated, how testable the game logic is, and how much boilerplate the team has to carry. TypeScript was a given for type safety and tooling — the question was which UI and game frameworks to pair with it.

## Decision

Use **TypeScript** throughout, with a hybrid framework approach:

- **Svelte** for the UI layer (menus, trade screens, character panels, dialogs)
- **PixiJS** for the game render layer (map, ships, city animations)

This mirrors the original game's structural separation between the "world view" (isometric port scenes) and the "business simulation" panels. TypeScript across both layers keeps the codebase unified under one language and build tool.

## Alternatives Considered

- **TypeScript + React** — massive ecosystem and excellent tooling, but React's virtual DOM overhead is wasted on canvas rendering, and managing a game render loop inside React's lifecycle is awkward. The component model suits UI panels but so does Svelte with far less boilerplate.

- **TypeScript + Phaser.js** — purpose-built 2D game engine with built-in scene management, sprite batching, input, and audio. Rejected because the game's dominant interaction surface is the business-simulation UI (trade menus, dialogs, character management), not the game world. Phaser requires significant boilerplate for those UI-heavy screens and is less suited to the "spreadsheet with a map" nature of the game.

- **GDScript + Godot (HTML5 export)** — full game engine with scene graph, physics, and animation; exports to HTML5, desktop, and mobile from one codebase. Rejected because GDScript is niche and harder to find web developers familiar with; web export has known performance and audio quirks; and the project already has TypeScript as the preferred language.

- **Rust + Bevy (WASM)** — modern ECS architecture and excellent performance, compiles to WebAssembly. Rejected due to very steep learning curve, a still-maturing ecosystem, and fewer ready-made assets. The performance ceiling is not needed for a turn-based 2D simulation.

## Consequences

✅ Svelte's reactive stores map naturally onto game state domains (player, fleet, cities, market, calendar)  
✅ Compile-time reactivity — no virtual DOM overhead in the UI layer  
✅ Smaller bundle size than React  
✅ PixiJS provides a GPU-accelerated scene graph without requiring raw WebGL knowledge  
✅ Single language (TypeScript) across both layers — one build tool, one type system  
✅ Game logic in `src/game/` can remain framework-agnostic (pure functions) — testable without a browser  
⚠️  Svelte has a smaller ecosystem and community than React — fewer ready-made components  
⚠️  Two rendering contexts (PixiJS canvas + Svelte DOM) must be initialised and coordinated  
⚠️  Input event routing must be handled carefully — PixiJS and the DOM have separate event systems  
🔒  Locks the UI layer to Svelte's reactivity model and store API  
🔒  Locks the render layer to PixiJS's scene graph and texture pipeline  

## Links

- Supersedes: —  
- Superseded by: —  
- Related ADRs: ADR-001 (Platform — Web target makes browser-compatible stack mandatory), ADR-003 (Rendering — elaborates the PixiJS + DOM split), ADR-004 (Architecture — defines how Svelte stores are used for state)  
- Related design docs: —
