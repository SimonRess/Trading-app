import type { Season } from '../state/types.ts';
import { buildInitialMarket } from './goods.ts';
import type { GameState } from '../state/types.ts';
import { buildInitialRiskState } from '../systems/risk-system.ts';

export function buildStartingState(playerName: string): GameState {
  return {
    player: {
      name: playerName,
      cash: 500,
      age: 22,
      maritalStatus: 'single',
      politicalRank: 0,
      reputation: {
        lubeck: 20,
        hamburg: 10,
        danzig: 10,
        riga: 10,
        malmo: 10,
      },
    },
    fleet: {
      ships: [
        {
          id: 'ship-1',
          name: 'Wulf von Lübeck',
          type: 'kogge',
          durability: 100,
          position: 'lubeck',
          cargo: { salt: 20 },
        },
      ],
    },
    cities: {
      lubeck:  { id: 'lubeck'  },
      hamburg: { id: 'hamburg' },
      danzig:  { id: 'danzig'  },
      riga:    { id: 'riga'    },
      malmo:   { id: 'malmo'   },
    },
    market: buildInitialMarket(),
    calendar: {
      year: 1320,
      season: 'spring' as Season,
      turn: 1,
      maxTurns: 40,
    },
    risk: buildInitialRiskState(),
  };
}
