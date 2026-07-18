# Design: Save File Schema

**Status:** Draft  
**Last updated:** 2026-07-14

## Purpose

Define exactly what is saved, how it is stored, and how the schema evolves across versions. A save file must be complete enough to fully restore a game session and robust enough to survive app updates without corrupting existing saves.

---

## Storage Strategy (MVP)

Two complementary mechanisms:

| Mechanism | Trigger | Purpose |
|-----------|---------|---------|
| **localStorage auto-save** | Every turn end | Seamless resume on same browser/device |
| **JSON file export** | Player clicks "Save to file" | Backup; transfer between devices |
| **JSON file import** | Player clicks "Load from file" | Restore from exported file |

localStorage key: `hanse_save_v1`

If localStorage is unavailable (private browsing, storage quota exceeded), the game continues without auto-save and warns the player. File export/import always works as a fallback.

---

## What Is Saved

The save file is `JSON.stringify(SaveFile)`. It contains the full `GameState` minus UI state, plus a metadata envelope.

### Schema

```typescript
interface SaveFile {
  meta: SaveMeta;
  state: PersistedGameState;
}

interface SaveMeta {
  schemaVersion: number;   // incremented on breaking changes
  savedAt: string;         // ISO 8601 timestamp
  appVersion: string;      // semver string from package.json
  turnNumber: number;      // denormalised for quick display in load screen
  playerName: string;      // denormalised for quick display in load screen
  year: number;            // denormalised for quick display in load screen
  season: Season;          // denormalised for quick display in load screen
}

interface PersistedGameState {
  player: PlayerState;
  fleet: FleetState;
  cities: CitiesState;
  market: MarketState;
  calendar: CalendarState;
  risk: RiskState;         // added in ADR-015; additive, no schema bump needed
  // ui state is deliberately excluded
}
```

Current schema version: **1**

---

## Field Definitions

### `PlayerState`

```typescript
interface PlayerState {
  name: string;
  cash: number;
  age: number;
  maritalStatus: 'single' | 'married' | 'widowed';  // added post-v1; additive, no schema bump — save-system.ts defaults to 'single' if absent
  politicalRank: number;         // 0=Citizen, 1=Guild, 2=Council, 3=Mayor
  reputation: Record<CityId, number>;  // 0–100 per city
}
```

### `FleetState`

```typescript
interface FleetState {
  ships: Ship[];
}

interface Ship {
  id: string;                    // stable uuid assigned at creation
  name: string;
  type: ShipType;                // 'kogge' in MVP
  durability: number;            // 0–100
  position: CityId | RoutePosition;
  cargo: Partial<Record<GoodId, number>>;  // good → quantity in last
}

interface RoutePosition {
  from: CityId;
  to: CityId;
  turnsRemaining: number;
}
```

### `CitiesState`

```typescript
type CitiesState = Record<CityId, CityState>;

interface CityState {
  id: CityId;
  // MVP: no stores, no agents — placeholder for v1.1
}
```

### `MarketState`

```typescript
type MarketState = Record<CityId, CityMarket>;
type CityMarket = Record<GoodId, GoodMarket>;

interface GoodMarket {
  supply: number;          // 0–100
  basePrice: number;       // Mark per last (static, from data — included for forward-compat)
  production: number;      // supply units added per turn resolution
  consumption: number;     // supply units removed per turn resolution
}
```

### `CalendarState`

```typescript
interface CalendarState {
  year: number;
  season: Season;          // 'spring' | 'summer' | 'autumn' | 'winter'
  turn: number;
  maxTurns: number;
  pendingEvents: GameEvent[];   // events queued to resolve this turn
}
```

### `RiskState` (added in ADR-015)

```typescript
interface RiskState {
  routeModifiers: Record<string, number>;              // key: sorted "cityA-cityB"; multiplier, drifts each turn
  cityModifiers: Partial<Record<CityId, number>>;       // per harvest-eligible city (currently just Danzig)
}
```

Session-persistent regional danger multipliers (see `event-table.md` "Per-Route & Session Risk"). Saving/loading a game simply carries whatever modifier values were current — there is no separate history or decay-on-load; a fresh `NEW_GAME` resets every modifier to 1.0 via `buildInitialRiskState`.

---

## Excluded from Save

| Data | Reason |
|------|--------|
| UI state (active screen, open dialog) | Session-specific; meaningless on reload |
| Static data (base prices, routes, city names) | Lives in `src/game/data/`; loaded fresh each session |
| PixiJS render state | Reconstructed from `GameState` on load |

---

## Schema Versioning

`schemaVersion` is incremented whenever a breaking change is made to `PersistedGameState` — a field removed, renamed, or changed in type. Additive changes (new optional field) do not require a version bump if a sensible default can be assumed.

### Migration strategy

A migration function is run on load before the state is passed to the game:

```typescript
function migrateSave(raw: unknown): SaveFile {
  const file = raw as SaveFile;
  if (file.meta.schemaVersion === CURRENT_SCHEMA_VERSION) return file;
  return applyMigrations(file, file.meta.schemaVersion, CURRENT_SCHEMA_VERSION);
}

const migrations: Record<number, (state: PersistedGameState) => PersistedGameState> = {
  // 1 → 2: example future migration
  // 1: (state) => ({ ...state, player: { ...state.player, newField: defaultValue } }),
};
```

If `schemaVersion` is higher than `CURRENT_SCHEMA_VERSION` (save from a newer app version), warn the player and refuse to load rather than silently corrupting state.

---

## Export File Format

```
filename: hanse_<playerName>_year<year>_turn<turn>.json
encoding: UTF-8
content:  JSON.stringify(SaveFile, null, 2)  // pretty-printed for debuggability
```

---

## Load Screen Display

The denormalised fields in `SaveMeta` let a load screen show save info without parsing the full state:

```
"Erik Thorvaldsen — Spring 1323 (Turn 12)"
```

This richer preview is **not yet implemented** — see Implementation Status below for what actually exists.

---

## UI (implemented)

A "💾 Save" button in the port-screen header opens a small menu with:

- **Export Save** — calls `GameClient.exportSave()`, which triggers `exportToFile(state)` (browser file download, per "Export File Format" above)
- **Import Save** — a file `<input type="file">`; on selection, calls `GameClient.importSave(file)`, which parses the file, replaces the in-memory game state, and re-saves it to `localStorage` (so the imported save becomes the new auto-save baseline). Invalid files show an inline error rather than crashing.

The same import control appears on the New Game screen, so a player can load an exported file (their own earlier backup, or one shared by someone else) without first starting a fresh game.

`GameClient` (not `LocalGameClient` alone) gained `exportSave()`/`importSave()` methods rather than the UI calling `save-system.ts` directly — export/import are I/O side effects that don't fit the `(state, action) => newState` `GameAction` shape, but must still go through the client abstraction per CLAUDE.md Hard Rule 2 (UI never imports `src/game/systems/` directly).

## Implementation Status (as of 2026-07-18)

- ✅ `saveToLocalStorage`/`loadFromLocalStorage` (auto-save every `END_TURN`), `exportToFile`/`importFromFile`, and the in-game Save menu described above — all implemented
- ❌ The richer "Load Screen Display" (a dedicated screen listing save summaries like `"Erik Thorvaldsen — Spring 1323 (Turn 12)"`) is **not implemented** — there is exactly one `localStorage` slot (auto-save, loaded silently on page load by `main.ts`) plus raw file import with no preview of the file's contents before loading
- ❌ Multiple named save slots are not implemented (see Open Questions)

## Open Questions

- Should there be multiple save slots in localStorage, or one auto-save slot only?
- Should the export file be minified (smaller) or pretty-printed (debuggable)? Current choice: pretty-printed.
- When a migration fails, should the player be offered a raw JSON download before the save is discarded?
- Should the import control show the `SaveMeta` summary (player/turn/date) before committing to load, rather than loading immediately on file selection?

## Related

- ADR-004 (Architecture — save = JSON.stringify(GameState minus ui))
- ADR-011 (Save file format decision — to be created)
- ADR-012 (Game client abstraction — why export/import go through `GameClient`, not directly from the UI)
- docs/design/starting-scenario.md (initial state that a new game produces)
- `src/game/systems/save-system.ts`, `src/game/client/game-client.ts`, `src/game/client/local-game-client.ts` (implementation)
