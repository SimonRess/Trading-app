import type { GameClient, GameAction, PlayerOrders } from './game-client.ts';
import type { GameState, TurnResult } from '../state/types.ts';
import { buildStartingState } from '../data/starting-config.ts';
import { advanceCalendar } from '../systems/calendar-system.ts';
import { updateAllMarkets } from '../systems/market-system.ts';
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

      case 'END_TURN': {
        const result = this.resolveTurn(action.orders);
        this.state = result.state;
        saveToLocalStorage(this.state);
        return result;
      }

      default:
        return this.state;
    }
  }

  private resolveTurn(orders: PlayerOrders): TurnResult {
    const events: string[] = [];

    const afterCalendar = advanceCalendar(this.state.calendar);
    const afterMarket = updateAllMarkets(this.state.market);

    const afterEvent = this.rollRandomEvent(afterMarket, events);

    const newState: GameState = {
      ...this.state,
      calendar: afterCalendar,
      market: afterEvent,
    };

    const outcome = this.checkEndConditions(newState);

    return { state: newState, summary: { events, outcome } };
  }

  private rollRandomEvent(
    market: typeof this.state.market,
    events: string[],
  ): typeof this.state.market {
    if (Math.random() > 0.25) return market;

    const roll = Math.random();

    if (roll < 0.33) {
      events.push('A storm battered ships in the Baltic.');
      return market;
    } else if (roll < 0.66) {
      const danzig = market['danzig'];
      const grain = danzig['grain'];
      const newSupply = Math.min(100, grain.supply + 30);
      events.push('A bumper harvest flooded Danzig with grain — prices dropped sharply.');
      return {
        ...market,
        danzig: { ...danzig, grain: { ...grain, supply: newSupply } },
      };
    } else {
      events.push('Pirates raided a coastal vessel.');
      return market;
    }
  }

  private checkEndConditions(state: GameState): 'win' | 'lose' | null {
    const netWorth = state.player.cash;
    if (netWorth >= 10_000) return 'win';
    if (netWorth <= 0) return 'lose';
    if (state.calendar.turn >= state.calendar.maxTurns) return 'lose';
    return null;
  }
}
