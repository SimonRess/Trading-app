import type { Season } from '../state/types.ts';
import { buildInitialMarket } from './goods.ts';
import type { GameState } from '../state/types.ts';
import { buildInitialRiskState } from '../systems/risk-system.ts';
import { defaultCrew } from './ships.ts';

export function buildStartingState(playerName: string): GameState {
  return {
    player: {
      name: playerName,
      cash: 500,
      age: 22,
      gender: 'male',
      maritalStatus: 'single',
      politicalRank: 0,
      loan: 0,
      health: 100,
      partner: null,
      children: [],
      traits: [],
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
          crew: defaultCrew('kogge'),
          cannons: 0,
          insured: false,
          repairCooldown: 0,
          posture: 'defensive',
        },
      ],
      convoys: [],
    },
    // churchCompletion seeded per city (docs/design/church-donations.md) —
    // Lübeck, the political home base, starts furthest along; the rest are
    // varied so the player sees different funding opportunities from turn 1.
    cities: {
      lubeck:  { id: 'lubeck',  churchCompletion: 60, churchPledged: 0 },
      hamburg: { id: 'hamburg', churchCompletion: 25, churchPledged: 0 },
      danzig:  { id: 'danzig',  churchCompletion: 30, churchPledged: 0 },
      riga:    { id: 'riga',    churchCompletion: 15, churchPledged: 0 },
      malmo:   { id: 'malmo',   churchCompletion: 20, churchPledged: 0 },
    },
    market: buildInitialMarket(),
    calendar: {
      year: 1320,
      season: 'spring' as Season,
      turn: 1,
      // Effectively unbounded — see docs/design/family-succession.md.
      // The session now ends via death (with or without an heir) or a
      // Mayor-of-Lübeck win, not a turn counter.
      maxTurns: 999_999,
    },
    risk: buildInitialRiskState(),
    hasWon: false,
    warehouses: {},
    cityStores: {},
    cityEffects: [],
    pendingSuccession: null,
    chronicle: [`🏛️ ${playerName} begins trading in Lübeck, Spring 1320.`],
    achievements: [],
  };
}
