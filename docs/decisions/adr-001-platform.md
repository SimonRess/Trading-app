# ADR-001: Platform Target

> Migrated from docs/01_platform.md

**Date:** 2026-07-01  
**Status:** Accepted  
**Deciders:** Simon

## Context

The platform choice is the first and most cascading decision in the project — it determines language selection, rendering approach, distribution strategy, and monetization. The game is a turn-based, point-and-click trading simulation with a complex map view and many information-heavy UI panels, similar in interaction style to a board game or business simulation.

## Decision

Target the **Web (PWA-capable)** as the primary platform.

The game's turn-based, point-and-click nature fits browsers perfectly. A PWA wrapper enables offline play and home-screen install. Wrapping in Electron or Tauri for a Steam release remains a viable later step without requiring architectural changes.

## Alternatives Considered

- **Desktop App (Electron / Tauri)** — native window, menus, file dialogs, and full offline support; can ship on Steam. Rejected because Electron adds ~150 MB to binary size and complicates updates; Tauri requires Rust knowledge. These costs are not justified before the game has a proven audience.

- **Mobile App (iOS / Android)** — large audience and touch input suits point-and-click. Rejected because small screens fundamentally limit the map and multi-panel UI complexity; App Store review overhead and Apple's $99/year fee add friction without clear benefit at this stage.

- **Native Desktop (C++ / Rust)** — maximum performance and smallest footprint. Rejected because of very long development time and no fast iteration cycle. The game does not require native performance.

## Consequences

✅ No install friction — shareable via URL; works on Windows, Mac, Linux, and mobile browsers  
✅ Fastest iteration cycle; deploy updates instantly  
✅ PWA support enables offline play without a native wrapper  
✅ Zero distribution cost for initial release  
✅ Electron/Tauri wrapping for Steam remains a low-effort future option  
⚠️  No native file system access without workarounds (Web File System Access API or download-based saves)  
⚠️  Canvas/WebGL performance ceiling exists, though it is not a concern for a 2D simulation  
⚠️  Less native "desktop app" feel without additional shell integration  
🔒  Locks the rendering layer to browser-compatible technologies (Canvas/WebGL — no OpenGL, no Vulkan)

## Links

- Supersedes: —  
- Superseded by: —  
- Related ADRs: ADR-002 (Language & Framework), ADR-003 (Rendering), ADR-008 (Distribution)  
- Related design docs: —
