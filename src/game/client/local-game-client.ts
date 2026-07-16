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

  async sendAction(action: GameAction): Promise<TurnResult | GameState> {
    switch (action.type) {
      case 'NEW_GAME':
        this.state = buildStartingState(action.playerName);
        return this.state;

      case 'LOAD_SAVE':
        this.state = action.state;
        return this.state;

      case 'SET_DESTINATION': {
        const ship = this.state.fleet.ships.find(s => s.id === action.shipId);
        if (!ship) return this.state;
        const updatedShip = setDestination(ship, action.destination);
        this.state = {
          ...this.state,
          fleet: {
            ships: this.state.fleet.ships.map(s => (s.id === action.shipId ? updatedShip : s)),
          },
        };
        return this.state;
      }

      case 'BUY_GOOD':
        this.state = executeBuy(this.state, action.shipId, action.cityId, action.goodId, action.quantity);
        return this.state;

      case 'SELL_GOOD':
        this.state = executeSell(this.state, action.shipId, action.cityId, action.goodId, action.quantity);
        return this.state;

      case 'END_TURN': {
        const result = resolveTurn(this.state, action.orders);
        this.state = result.state;
        saveToLocalStorage(this.state);
        return result;
      }
    }
  }
}
