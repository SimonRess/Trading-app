# CLAUDE.md — Hanse Trading Game

## Project

A turn-based medieval trading simulation inspired by *Hanse – Die Expedition* (1994, Ascon). The player starts as a merchant in Lübeck, builds a trade network across Hanseatic northern Europe, manages a fleet of ships, raises a family across generations, and aims to become Mayor of Lübeck.

**Stack:** TypeScript · Svelte (UI) · PixiJS (game renderer) · Vite · Vitest  
**Not a:** real-time game, multiplayer game (v1), mobile app

Full design: `docs/design/game-mechanics.md`  
Architecture decisions: `docs/decisions/`  
Planning guide: `docs/00_project_structure.md`

---

## Architecture

```
src/
├── game/           ← pure game logic; NO imports from ui/ or render/
│   ├── client/     ← GameClient interface + LocalGameClient implementation
│   ├── state/      ← domain Svelte stores (player, fleet, cities, market, calendar)
│   ├── systems/    ← turn resolution, market simulation, combat, events
│   └── data/       ← static data: city definitions, goods, ship types, starting config
├── render/         ← PixiJS scenes (map, port views, ship animations)
├── ui/             ← Svelte components (menus, panels, dialogs)
└── main.ts         ← entry point: mounts Svelte app + PixiJS canvas; injects GameClient
```

**Hard rule 1:** `src/game/` has zero dependency on `src/ui/` or `src/render/`. Game logic is pure functions: `(state, action) => newState`. This is what makes logic unit-testable and save/load trivial.

**Hard rule 2:** UI components never import from `src/game/systems/` directly. All game actions go through the `GameClient` interface (`src/game/client/game-client.ts`). This keeps the seam clean for a future backend migration (see ADR-012).

```typescript
// WRONG — UI importing game logic directly
import { resolveMarket } from '../game/systems/market-system';

// CORRECT — UI dispatches through GameClient
const newState = await gameClient.sendAction({ type: 'END_TURN' });
```

`GameAction` must always be a serialisable discriminated union — no functions or class instances, since actions must be transmittable to a remote server at v3.

UI state (active screen, open dialog) lives in a separate store and is **never** written to save files.

---

## Code Conventions

- **TypeScript strict mode** — no `any`; use `unknown` and narrow explicitly
- **Named exports only** — no `export default` anywhere
- **File names** — kebab-case for all files (`city-store.ts`, `market-system.ts`)
- **Immutable state** — never mutate state objects; always return new state
- **No comments explaining what code does** — only add a comment when the WHY is non-obvious (a hidden constraint, a workaround, a subtle invariant)
- **No multi-line comment blocks or docstrings**
- **Formatting** — Prettier defaults: 2-space indent, single quotes, trailing commas

---

## State Shape

```typescript
interface GameState {
  player:   PlayerState;   // name, money, age, reputation, political rank
  fleet:    FleetState;    // ships[], each with cargo, position, durability
  cities:   CitiesState;   // per-city: stores, prices, player reputation
  market:   MarketState;   // price history, supply/demand units
  calendar: CalendarState; // current year, season, events queue
  // ui state is separate and never persisted
}
```

Save file = `JSON.stringify(gameState)`. Schema version field required — see `docs/design/save-file-schema.md` (when created).

---

## Testing

- Game logic in `src/game/` must have unit tests
- Test files are co-located: `foo.ts` → `foo.test.ts`
- Tests must not import from `src/ui/` or `src/render/`
- Run with: `npm test`

---

## Key Commands

```bash
npm run dev        # start dev server (Vite)
npm test           # run unit tests (Vitest)
npm run build      # production build
npm run typecheck  # tsc --noEmit (no emit, type errors only)
npm run lint       # ESLint
npm run format     # Prettier --write
```

---

## What NOT to Do

- Do not import `src/ui/` or `src/render/` from `src/game/`
- Do not import `src/game/systems/` from UI components — use `GameClient` instead
- Do not put non-serialisable values (functions, class instances) in `GameAction` objects
- Do not mutate state in place — return new state objects
- Do not use `any` types
- Do not use `export default`
- Do not write comments that explain what the code does
- Do not create new docs or design files without following the templates in `docs/00_project_structure.md`
- Do not push to `main` directly — always use a feature branch
- Do not add features beyond the current task scope
