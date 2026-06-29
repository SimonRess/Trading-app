# Recommended Starting Stack

This is the consolidated technology stack based on all decisions in this folder.

## Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Language | TypeScript | Type safety across both game logic and UI; great tooling |
| UI Framework | Svelte | Less boilerplate than React; reactive stores map cleanly to game state domains |
| Game Renderer | PixiJS | Hardware-accelerated 2D; sprite batching; good TypeScript support |
| Build Tool | Vite | Fast dev server; native TypeScript + Svelte support |
| State Management | Svelte stores (domain-sliced) | Reactive, serializable, testable pure functions |
| Audio | Howler.js | Simple Web Audio API wrapper; supports sprite sheets for SFX |
| Art | Aseprite (pixel art) | Industry standard for pixel art; exports sprite sheets |
| Deployment | GitHub Pages (static) | Free, automatic from GitHub Actions |
| Distribution v1 | Open source / GitHub | No friction, community-first |
| Distribution v2 | itch.io | Indie standard when playable build exists |

## Project Structure (proposed)

```
Trading-app/
├── docs/               ← This folder: decisions and design docs
├── src/
│   ├── game/           ← Pure game logic (no UI dependencies)
│   │   ├── state/      ← Domain stores (player, fleet, cities, market, calendar)
│   │   ├── systems/    ← Turn resolution, market simulation, combat
│   │   └── data/       ← Static data (city definitions, goods, starting config)
│   ├── render/         ← PixiJS scenes (map, port views, combat)
│   ├── ui/             ← Svelte components (menus, panels, dialogs)
│   └── main.ts         ← Entry point; mounts Svelte app + PixiJS canvas
├── public/
│   └── assets/         ← Sprites, tilesets, audio
├── index.html
├── vite.config.ts
└── package.json
```

## Key Architectural Principle

Game logic (`src/game/`) has **no dependency** on UI or rendering code. It takes state in, returns new state out. This means:
- Logic is unit-testable without a browser
- UI and renderer are just views onto the same state
- Save/load is `JSON.stringify` / `JSON.parse` on the game state object
