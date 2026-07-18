export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type CityId = 'lubeck' | 'hamburg' | 'danzig' | 'riga' | 'malmo';

export type GoodId = 'salt' | 'grain' | 'timber' | 'furs' | 'herring';

export type ShipType = 'kogge' | 'hulk' | 'schnigge';

export type PoliticalRank = 0 | 1 | 2 | 3; // citizen, guild, council, mayor

export interface RoutePosition {
  from: CityId;
  to: CityId;
  turnsRemaining: number;
}

export interface PlayerState {
  name: string;
  cash: number;
  age: number;
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
}

export interface FleetState {
  ships: Ship[];
}

export interface CityState {
  id: CityId;
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
