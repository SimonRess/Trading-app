import type { CityId, GameState } from '../state/types.ts';

const SCHEMA_VERSION = 1;

// Mirrors starting-config.ts's church seed spread — churchCompletion was
// added to CityState after schema v1 shipped; additive field, no schema
// bump, so an older save's cities may genuinely lack it. Defaulting to
// "as if the feature had always existed" (the same starting values a new
// game gets) rather than 0, which would understate every city's progress.
const CHURCH_COMPLETION_DEFAULTS: Record<CityId, number> = {
  lubeck: 60, hamburg: 25, danzig: 30, riga: 15, malmo: 20,
};
const STORAGE_KEY = 'hanse_save_v1';

interface SaveMeta {
  schemaVersion: number;
  savedAt: string;
  appVersion: string;
  turnNumber: number;
  playerName: string;
  year: number;
  season: string;
}

interface SaveFile {
  meta: SaveMeta;
  state: GameState;
}

export function saveToLocalStorage(state: GameState): void {
  const file: SaveFile = {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      appVersion: '0.1.0',
      turnNumber: state.calendar.turn,
      playerName: state.player.name,
      year: state.calendar.year,
      season: state.calendar.season,
    },
    state,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
}

export function loadFromLocalStorage(): GameState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return parseSaveFile(raw);
}

export function exportToFile(state: GameState): void {
  const file: SaveFile = {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      appVersion: '0.1.0',
      turnNumber: state.calendar.turn,
      playerName: state.player.name,
      year: state.calendar.year,
      season: state.calendar.season,
    },
    state,
  };
  const json = JSON.stringify(file, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hanse_${state.player.name}_year${String(state.calendar.year)}_turn${String(state.calendar.turn)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importFromFile(file: File): Promise<GameState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error('Failed to read file');
        const state = parseSaveFile(text);
        if (!state) throw new Error('Invalid save file');
        resolve(state);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    reader.readAsText(file);
  });
}

function parseSaveFile(raw: string): GameState | null {
  try {
    const file = JSON.parse(raw) as SaveFile;
    if (file.meta.schemaVersion !== SCHEMA_VERSION) {
      console.warn(`Save schema v${String(file.meta.schemaVersion)} does not match app schema v${String(SCHEMA_VERSION)}`);
      return null;
    }
    // maritalStatus and hasWon were both added after schema v1 shipped;
    // additive fields with sensible defaults, so no schema bump per
    // save-file-schema.md — older saves on disk may genuinely lack them
    // despite what the SaveFile type claims, so read them through Partial
    // rather than trusting the cast.
    const rawPlayer = file.state.player as Partial<GameState['player']>;
    const player = { ...file.state.player, maritalStatus: rawPlayer.maritalStatus ?? 'single' };
    const rawState = file.state as Partial<GameState>;

    const cities = { ...file.state.cities };
    for (const cityId of Object.keys(cities) as CityId[]) {
      const rawCity = cities[cityId] as Partial<GameState['cities'][CityId]>;
      cities[cityId] = {
        ...cities[cityId],
        churchCompletion: rawCity.churchCompletion ?? CHURCH_COMPLETION_DEFAULTS[cityId],
        churchPledged: rawCity.churchPledged ?? 0,
      };
    }

    return { ...file.state, player, cities, hasWon: rawState.hasWon ?? false };
  } catch {
    return null;
  }
}
