import type { GameState, TurnResult, CityId, GoodId, ShipType } from '../state/types.ts';

export type GameAction =
  | { type: 'NEW_GAME'; playerName: string }
  | { type: 'END_TURN'; orders: PlayerOrders }
  | { type: 'BUY_GOOD'; shipId: string; cityId: CityId; goodId: GoodId; quantity: number }
  | { type: 'SELL_GOOD'; shipId: string; cityId: CityId; goodId: GoodId; quantity: number }
  | { type: 'SET_DESTINATION'; shipId: string; destination: CityId }
  | { type: 'BUY_SHIP'; cityId: CityId; shipType: ShipType }
  | { type: 'REPAIR_SHIP'; shipId: string }
  | { type: 'HIRE_CREW'; shipId: string }
  | { type: 'RELEASE_CREW'; shipId: string }
  | { type: 'DONATE_CHURCH'; cityId: CityId; amount: number }
  | { type: 'LOAD_SAVE'; state: GameState };

export interface PlayerOrders {
  destinations: Record<string, CityId>;
}

export interface GameClient {
  getState(): GameState;
  sendAction(action: GameAction): Promise<TurnResult | GameState>;
  // Save/load are I/O side effects (file download, file read), not state
  // transitions on their own — they don't fit the (state, action) => newState
  // GameAction shape, but still must go through GameClient rather than UI
  // components reaching into src/game/systems/save-system.ts directly
  // (CLAUDE.md Hard Rule 2).
  exportSave(): void;
  importSave(file: File): Promise<GameState>;
}
