# ADR-011: Save File Format & Versioning

**Date:** 2026-07-14  
**Status:** Accepted  
**Deciders:** Simon

## Context

Save state must survive app updates. A player who saves in v1.0 and returns after a v1.1 update must be able to load their game. This requires a defined serialisation format, a version field, and a migration strategy. The decision must be made before the first line of persistent state is written — retrofitting versioning onto an unversioned format is painful.

The game has no backend server (ADR-001, ADR-007 v1). All state lives in the browser. Two distribution concerns shape the options: in-browser storage is device-local and fragile; a downloadable file is portable but requires the player to manage it.

## Decision

**Two complementary save mechanisms: localStorage auto-save + JSON file export/import.**

- `localStorage` key `hanse_save_v1` is written on every turn end
- Players can export to a `hanse_<name>_year<year>_turn<turn>.json` file at any time
- Players can import a previously exported file to restore that state

The save file format is a `SaveFile` envelope wrapping `PersistedGameState`:

```typescript
interface SaveFile {
  meta: {
    schemaVersion: number;   // incremented on breaking changes
    savedAt: string;         // ISO 8601
    appVersion: string;      // semver
    turnNumber: number;      // for load screen display
    playerName: string;      // for load screen display
    year: number;
    season: Season;
  };
  state: PersistedGameState; // GameState minus ui slice
}
```

`schemaVersion` starts at 1. A migration function runs on load to bring old saves up to the current schema before they enter the game. If the schema version in a save file exceeds the app's current version, the load is refused with a warning. Full schema in `docs/design/save-file-schema.md`.

## Alternatives Considered

- **localStorage only, no file export** — simplest. Rejected because localStorage is tied to a single browser and wiped by "Clear site data". Players would lose saves through routine browser maintenance with no recovery path.

- **File export/import only, no localStorage** — portable and explicit. Rejected because it puts the full save burden on the player: forgetting to export before closing the tab loses progress. The combination of auto-save + file export gives both safety and portability.

- **IndexedDB instead of localStorage** — larger storage quota; supports binary data. Rejected for MVP because the save file is a small JSON blob (well under localStorage's 5 MB limit); IndexedDB's async API adds complexity for no benefit at this scale.

- **Server-side save (backend + database)** — persistent across all devices, no local storage concerns. Rejected because the game has no backend server in v1 (ADR-001). Remains the right approach if online multiplayer is ever built (v3).

- **No schema versioning** — simpler, defer the problem. Rejected outright. The cost of adding `schemaVersion: 1` now is one field. The cost of adding it to an already-deployed save format is a painful migration or a hard break of all existing saves.

## Consequences

✅ Auto-save means no progress is lost if the player closes the tab without exporting  
✅ File export/import enables cross-device play and manual backups  
✅ `schemaVersion` from day one means future field additions and renames are manageable  
✅ Denormalised display fields in `meta` allow a load screen without deserialising the full state  
✅ UI state explicitly excluded — saves are portable across sessions without stale screen state  
⚠️  localStorage is still fragile — "Clear site data" wipes it; players should be reminded to export periodically  
⚠️  Single auto-save slot means the player cannot maintain multiple parallel save states without using file export  
🔒  `schemaVersion` must be incremented on every breaking change to `PersistedGameState` — additive changes (new optional field with a default) do not require a bump  
🔒  UI state (`active screen`, `open dialog`) must never appear in `PersistedGameState` — this is a permanent structural rule  

## Links

- Supersedes: —  
- Superseded by: —  
- Related ADRs: ADR-004 (Architecture — save = JSON.stringify of GameState minus ui; immutable state makes serialisation trivial), ADR-001 (Platform — web app; no native filesystem access)  
- Related design docs: docs/design/save-file-schema.md (full TypeScript interfaces and migration strategy)
