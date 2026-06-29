# Decision 1: Platform Target

## Why This Matters

The platform choice cascades into language selection, rendering approach, distribution strategy, and monetization. It should be the first decision made.

## Options

### Web App (Browser / PWA)
**Pros**
- No install friction — share a URL and it works
- Truly cross-platform (Windows, Mac, Linux, mobile browser)
- Fastest iteration cycle; deploy updates instantly
- PWA support enables offline play and home-screen install
- Zero distribution cost

**Cons**
- No native file system access without workarounds
- Canvas/WebGL performance ceiling (fine for a 2D sim)
- Less "desktop app" feel out of the box

### Desktop App (Electron / Tauri)
**Pros**
- Native window, menus, file dialogs
- Full offline support
- Can ship on Steam

**Cons**
- Electron adds ~150 MB to binary size
- Update distribution is more complex
- Tauri is lighter but requires Rust knowledge

### Mobile App (iOS / Android)
**Pros**
- Large audience
- Touch input suits point-and-click style

**Cons**
- Small screens limit map and panel complexity
- App Store review and $99/year Apple developer fee
- Harder to develop and test

### Native Desktop (C++ / Rust)
**Pros**
- Maximum performance, smallest footprint

**Cons**
- Very long development time
- No fast iteration

## Decision

**→ Web App (PWA-capable)**

The game's turn-based, point-and-click nature fits browsers perfectly. Iteration is fastest, there are no install barriers, and wrapping in Electron/Tauri for a Steam release is a straightforward later step if needed.
