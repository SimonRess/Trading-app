export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type CityId = 'lubeck' | 'hamburg' | 'danzig' | 'riga' | 'malmo';

export type GoodId = 'salt' | 'grain' | 'timber' | 'furs' | 'herring';

export type ShipType = 'kogge' | 'hulk' | 'schnigge';

export type PoliticalRank = 0 | 1 | 2 | 3; // citizen, guild, council, mayor

export type MaritalStatus = 'single' | 'married' | 'widowed';

export interface RoutePosition {
  from: CityId;
  to: CityId;
  turnsRemaining: number;
}

export interface PlayerState {
  name: string;
  cash: number;
  age: number;
  maritalStatus: MaritalStatus;
  politicalRank: PoliticalRank;
  reputation: Record<CityId, number>;
}

export interface Ship {
  id: string;
  name: string;
  type: ShipType;
  durability: number;
  position: CityId | RoutePosition;
  cargo: Partial<Record<GoodId, number>>;
  // Headcount, 0 to the type's max (see ships.ts CREW_MAX). Costs wages
  // every turn (turn-system.ts) and slows an under-crewed ship down the same
  // way a Damaged hull does — see docs/design/crew-management.md.
  crew: number;
}

export interface FleetState {
  ships: Ship[];
}

export interface CityState {
  id: CityId;
  // 0-100. Starts partially built (see starting-config.ts) and only ever
  // increases — see docs/design/church-donations.md.
  churchCompletion: number;
  // Mark donated but not yet converted to completion — donateChurch() adds
  // here immediately; resolveTurn's advanceChurchProgress() converts at
  // most 1 percentage point's worth per city per turn, so a large donation
  // is felt gradually rather than instantly.
  churchPledged: number;
}

export type CitiesState = Record<CityId, CityState>;

export interface GoodMarket {
  supply: number;
  basePrice: number;
  production: number;
  consumption: number;
}

export type CityMarket = Record<GoodId, GoodMarket>;

export type MarketState = Record<CityId, CityMarket>;

export interface CalendarState {
  year: number;
  season: Season;
  turn: number;
  maxTurns: number;
}

// Session-persistent regional danger levels. Multipliers around 1.0 that
// drift slightly each turn (see risk-system.ts), representing e.g. "pirate
// activity in the Riga approach is currently elevated this session" without
// requiring any player-facing configuration.
export interface RiskState {
  routeModifiers: Record<string, number>; // key: sorted "cityA-cityB"
  cityModifiers: Partial<Record<CityId, number>>;
}

export interface GameState {
  player: PlayerState;
  fleet: FleetState;
  cities: CitiesState;
  market: MarketState;
  calendar: CalendarState;
  risk: RiskState;
  // True once a win condition has fired at least once. Winning no longer
  // ends the session — the player can continue — so this exists purely to
  // stop the win screen from reappearing every subsequent turn while the
  // qualifying condition (net worth, Mayor rank) remains true.
  hasWon: boolean;
}

export type GameOutcome = 'win' | 'lose' | null;

export interface TurnSummary {
  events: string[];
  outcome: GameOutcome;
}

export interface TurnResult {
  state: GameState;
  summary: TurnSummary;
}
