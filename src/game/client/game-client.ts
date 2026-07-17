import type { GameState, TurnResult, CityId, GoodId } from '../state/types.ts';

export type GameAction =
  | { type: 'NEW_GAME'; playerName: string }
  | { type: 'END_TURN'; orders: PlayerOrders }
  | { type: 'BUY_GOOD'; shipId: string; cityId: CityId; goodId: GoodId; quantity: number }
  | { type: 'SELL_GOOD'; shipId: string; cityId: CityId; goodId: GoodId; quantity: number }
  | { type: 'SET_DESTINATION'; shipId: string; destination: CityId }
  | { type: 'BUY_SHIP'; cityId: CityId }
  | { type: 'REPAIR_SHIP'; shipId: string }
  | { type: 'LOAD_SAVE'; state: GameState };

export interface PlayerOrders {
  destinations: Record<string, CityId>;
}

export interface GameClient {
  getState(): GameState;
  sendAction(action: GameAction): Promise<TurnResult | GameState>;
}
