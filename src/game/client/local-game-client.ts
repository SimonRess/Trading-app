import type { GameClient, GameAction } from './game-client.ts';
import type { GameState, TurnResult } from '../state/types.ts';
import { buildStartingState } from '../data/starting-config.ts';
import { resolveTurn, executeBuy, executeSell } from '../systems/turn-system.ts';
import { setDestination } from '../systems/fleet-system.ts';
import { saveToLocalStorage } from '../systems/save-system.ts';

export class LocalGameClient implements GameClient {
  private state: GameState;

  constructor(initialState?: GameState) {
    this.state = initialState ?? buildStartingState('Player');
  }

  getState(): GameState {
    return this.state;
  }

  sendAction(action: GameAction): Promise<TurnResult | GameState> {
    switch (action.type) {
      case 'NEW_GAME':
        this.state = buildStartingState(action.playerName);
        return Promise.resolve(this.state);

      case 'LOAD_SAVE':
        this.state = action.state;
        return Promise.resolve(this.state);

      case 'SET_DESTINATION': {
        const ship = this.state.fleet.ships.find(s => s.id === action.shipId);
        if (ship) {
          const updatedShip = setDestination(ship, action.destination);
          this.state = {
            ...this.state,
            fleet: {
              ships: this.state.fleet.ships.map(s => (s.id === action.shipId ? updatedShip : s)),
            },
          };
        }
        return Promise.resolve(this.state);
      }

      case 'BUY_GOOD':
        this.state = executeBuy(this.state, action.shipId, action.cityId, action.goodId, action.quantity);
        return Promise.resolve(this.state);

      case 'SELL_GOOD':
        this.state = executeSell(this.state, action.shipId, action.cityId, action.goodId, action.quantity);
        return Promise.resolve(this.state);

      case 'END_TURN': {
        const result = resolveTurn(this.state, action.orders);
        this.state = result.state;
        saveToLocalStorage(this.state);
        return Promise.resolve(result);
      }
    }
  }
}
