# Design: Technology Stack Reference

> Migrated from docs/09_recommended_stack.md

**Status:** Accepted  
**Last updated:** 2026-07-13

## Purpose

A single-page reference for the full technology stack. Each choice here is the outcome of a dedicated ADR — this doc exists for quick lookup, not for re-arguing decisions. Follow the ADR links for context and trade-offs.

## Stack

| Layer | Technology | ADR |
|-------|-----------|-----|
| Language | TypeScript (strict mode) | ADR-002 |
| UI Framework | Svelte | ADR-002 |
| Game Renderer | PixiJS | ADR-002, ADR-003 |
| Build Tool | Vite | ADR-002 |
| State Management | Svelte stores (domain-sliced, pure functions) | ADR-004 |
| Audio | Howler.js | — |
| Art tooling | Aseprite (pixel art) | ADR-005 |
| Deployment | GitHub Pages (static, via GitHub Actions) | ADR-008 |
| Distribution v1 | Open source / GitHub | ADR-008 |
| Distribution v2 | itch.io (pay-what-you-want) | ADR-008 |

## Source Tree

```
Trading-app/
├── CLAUDE.md                 ← AI session instructions
├── .claude/                  ← AI tool configuration (settings, slash commands)
├── docs/
│   ├── 00_project_structure.md
│   ├── decisions/            ← ADRs (one per architectural decision)
│   └── design/               ← System design docs (this folder)
├── src/
│   ├── game/                 ← Pure game logic; zero imports from ui/ or render/
│   │   ├── client/           ← GameClient interface + LocalGameClient (+ RemoteGameClient at v3)
│   │   ├── state/            ← Domain stores: player, fleet, cities, market, calendar
│   │   ├── systems/          ← Turn resolution, market simulation, combat, events
│   │   └── data/             ← Static data: city definitions, goods, ship types
│   ├── render/               ← PixiJS scenes: map, port views, ship animations
│   ├── ui/                   ← Svelte components: menus, panels, dialogs
│   └── main.ts               ← Entry point: mounts Svelte app + PixiJS canvas
├── public/
│   └── assets/               ← Sprites, tilesets, audio files
├── index.html
├── vite.config.ts
└── package.json
```

## Core Architectural Rule

`src/game/` has **zero dependency** on `src/ui/` or `src/render/`. Game logic functions take state in and return new state out: `(state, action) => newState`. This rule is what makes logic unit-testable without a browser and save/load trivially implementable as `JSON.stringify` / `JSON.parse`.

Enforced by: CLAUDE.md (AI sessions), ESLint import boundary rule (tooling).

## Related

- ADR-001 — Platform (Web / PWA)
- ADR-002 — Language & Framework (TypeScript + Svelte + PixiJS)
- ADR-003 — Rendering (PixiJS canvas + Svelte DOM overlay)
- ADR-004 — Architecture & State (domain-sliced stores, pure functions)
- ADR-012 — Game Client Abstraction (UI dispatches through GameClient, never imports systems/ directly)
- ADR-005 — Art Style (pixel art + illustrated key scenes)
- ADR-008 — Distribution (open source → itch.io → Steam)
