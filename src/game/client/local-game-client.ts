import type { GameClient, GameAction } from './game-client.ts';
import type { GameState, TurnResult } from '../state/types.ts';
import { buildStartingState } from '../data/starting-config.ts';
import {
  resolveTurn,
  executeBuy,
  executeSell,
  executeBuyShip,
  executeRepairShip,
  executeHireCrew,
  executeReleaseCrew,
  executeBuyCannon,
  executeSellCannon,
} from '../systems/turn-system.ts';
import { setDestination } from '../systems/fleet-system.ts';
import { saveToLocalStorage, exportToFile, importFromFile } from '../systems/save-system.ts';
import { donateChurch } from '../systems/church-system.ts';
import { executeTakeLoan, executeRepayLoan } from '../systems/banking-system.ts';
import { executeToggleInsurance } from '../systems/insurance-system.ts';
import { executeBuyWarehouse, executeSellWarehouse } from '../systems/warehouse-system.ts';

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

      case 'BUY_SHIP':
        this.state = executeBuyShip(this.state, action.cityId, action.shipType);
        return Promise.resolve(this.state);

      case 'REPAIR_SHIP':
        this.state = executeRepairShip(this.state, action.shipId);
        return Promise.resolve(this.state);

      case 'HIRE_CREW':
        this.state = executeHireCrew(this.state, action.shipId);
        return Promise.resolve(this.state);

      case 'RELEASE_CREW':
        this.state = executeReleaseCrew(this.state, action.shipId);
        return Promise.resolve(this.state);

      case 'DONATE_CHURCH':
        this.state = donateChurch(this.state, action.cityId, action.amount);
        return Promise.resolve(this.state);

      case 'TAKE_LOAN':
        this.state = executeTakeLoan(this.state, action.amount);
        return Promise.resolve(this.state);

      case 'REPAY_LOAN':
        this.state = executeRepayLoan(this.state, action.amount);
        return Promise.resolve(this.state);

      case 'BUY_CANNON':
        this.state = executeBuyCannon(this.state, action.shipId);
        return Promise.resolve(this.state);

      case 'SELL_CANNON':
        this.state = executeSellCannon(this.state, action.shipId);
        return Promise.resolve(this.state);

      case 'TOGGLE_INSURANCE':
        this.state = executeToggleInsurance(this.state, action.shipId);
        return Promise.resolve(this.state);

      case 'BUY_WAREHOUSE':
        this.state = executeBuyWarehouse(this.state, action.cityId);
        return Promise.resolve(this.state);

      case 'SELL_WAREHOUSE':
        this.state = executeSellWarehouse(this.state, action.cityId);
        return Promise.resolve(this.state);

      case 'END_TURN': {
        const result = resolveTurn(this.state, action.orders);
        this.state = result.state;
        saveToLocalStorage(this.state);
        return Promise.resolve(result);
      }
    }
  }

  exportSave(): void {
    exportToFile(this.state);
  }

  async importSave(file: File): Promise<GameState> {
    const state = await importFromFile(file);
    this.state = state;
    saveToLocalStorage(this.state);
    return this.state;
  }
}
