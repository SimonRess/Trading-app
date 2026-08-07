import type { GameState, TurnResult, CityId, GoodId, ShipType, Ship } from '../state/types.ts';

export type GameAction =
  | { type: 'NEW_GAME'; playerName: string }
  | { type: 'END_TURN'; orders: PlayerOrders }
  | { type: 'BUY_GOOD'; shipId: string; cityId: CityId; goodId: GoodId; quantity: number }
  | { type: 'SELL_GOOD'; shipId: string; cityId: CityId; goodId: GoodId; quantity: number }
  | { type: 'SET_DESTINATION'; shipId: string; destination: CityId }
  | { type: 'BUY_SHIP'; cityId: CityId; shipType: ShipType }
  | { type: 'REPAIR_SHIP'; shipId: string }
  | { type: 'AUCTION_SHIP'; shipId: string }
  | { type: 'RENAME_SHIP'; shipId: string; name: string }
  | { type: 'HIRE_CREW'; shipId: string }
  | { type: 'RELEASE_CREW'; shipId: string }
  | { type: 'DONATE_CHURCH'; cityId: CityId; amount: number }
  | { type: 'TAKE_LOAN'; amount: number }
  | { type: 'REPAY_LOAN'; amount: number }
  | { type: 'BUY_CANNON'; shipId: string }
  | { type: 'SELL_CANNON'; shipId: string }
  | { type: 'TOGGLE_INSURANCE'; shipId: string }
  | { type: 'SET_POSTURE'; shipId: string; posture: Ship['posture'] }
  | { type: 'BUY_WAREHOUSE'; cityId: CityId }
  | { type: 'SELL_WAREHOUSE'; cityId: CityId }
  | { type: 'SEEK_MARRIAGE'; partnerId: string }
  | { type: 'HIRE_TUTOR'; childId: string }
  | { type: 'CHOOSE_HEIR'; childId: string }
  | { type: 'LOAD_SAVE'; state: GameState }
  | { type: 'CREATE_CONVOY'; shipIds: string[]; name?: string }
  | { type: 'ADD_SHIP_TO_CONVOY'; convoyId: string; shipId: string }
  | { type: 'REMOVE_SHIP_FROM_CONVOY'; shipId: string }
  | { type: 'DISSOLVE_CONVOY'; convoyId: string }
  | { type: 'SET_CONVOY_DESTINATION'; convoyId: string; destination: CityId }
  | { type: 'SET_CONVOY_POSTURE'; convoyId: string; posture: Ship['posture'] }
  | { type: 'CONVOY_BUY_GOOD'; convoyId: string; cityId: CityId; goodId: GoodId; quantity: number }
  | { type: 'CONVOY_SELL_GOOD'; convoyId: string; cityId: CityId; goodId: GoodId; quantity: number }
  | { type: 'STORE_BUY_GOOD'; cityId: CityId; goodId: GoodId; quantity: number }
  | { type: 'STORE_SELL_GOOD'; cityId: CityId; goodId: GoodId; quantity: number }
  | { type: 'STORE_DEPOSIT'; shipId: string; cityId: CityId; goodId: GoodId; quantity: number }
  | { type: 'STORE_WITHDRAW'; shipId: string; cityId: CityId; goodId: GoodId; quantity: number }
  | { type: 'CONVOY_STORE_DEPOSIT'; convoyId: string; cityId: CityId; goodId: GoodId; quantity: number }
  | { type: 'CONVOY_STORE_WITHDRAW'; convoyId: string; cityId: CityId; goodId: GoodId; quantity: number };

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
