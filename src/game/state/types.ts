export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type CityId = 'lubeck' | 'hamburg' | 'danzig' | 'riga' | 'malmo';

export type GoodId = 'salt' | 'grain' | 'timber' | 'furs' | 'herring';

export type ShipType = 'kogge' | 'hulk' | 'schnigge';

export type PoliticalRank = 0 | 1 | 2 | 3; // citizen, guild, council, mayor

export type MaritalStatus = 'single' | 'married' | 'widowed';

export type Gender = 'male' | 'female';

// Penny-pincher/Simpleton modify purchase prices; Charismatic/Hot-tempered
// modify reputation gain/loss magnitude. Rolled onto children as they grow
// (family-system.ts) and carried onto PlayerState once a child succeeds as
// heir — see docs/design/family-succession.md.
export type TraitId = 'penny-pincher' | 'simpleton' | 'charismatic' | 'hot-tempered';

export interface Partner {
  title: string; // e.g. "the Fisherman's Daughter" — flavor, not a proper name
  age: number;
  gender: Gender;
}

export interface Child {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  // Tracked from birth using the same decay formula as the player
  // (health-system.ts) — becomes the new PlayerState.health if this child
  // is ever chosen as heir.
  health: number;
  traits: TraitId[];
  // True while a Hire Tutor action has been used for this child this year
  // — boosts that year's trait-roll odds, then resets on the next Spring
  // rollover. See docs/design/family-succession.md.
  tutoredThisYear: boolean;
}

export interface RoutePosition {
  from: CityId;
  to: CityId;
  turnsRemaining: number;
}

export interface PlayerState {
  name: string;
  cash: number;
  age: number;
  gender: Gender;
  maritalStatus: MaritalStatus;
  politicalRank: PoliticalRank;
  reputation: Record<CityId, number>;
  // Outstanding loan principal, 0 = no active loan. Compounds by
  // LOAN_INTEREST_RATE each turn (banking-system.ts) — see
  // docs/design/banking-loans.md. Subtracted in computeNetWorth (ADR-014
  // amendment, see ADR-019) so an unpaid loan is a real liability, not free
  // cash.
  loan: number;
  // 0-100. Decays every turn (health-system.ts); reaching 0 triggers
  // succession (or, with no eligible heir, ends the session). See
  // docs/design/family-succession.md.
  health: number;
  partner: Partner | null;
  children: Child[];
  // Inherited from whichever child became heir at succession; empty for a
  // first-generation player. See family-system.ts.
  traits: TraitId[];
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
  // 0 to the type's max (see ships.ts CANNON_MAX). Each cannon consumes 2
  // cargo capacity (fleet-system.ts's cargoCapacity). No combat exists yet
  // (ADR-010) — a cannon is purely a cargo-for-a-resellable-asset trade
  // until combat resolution lands. See docs/design/ship-stats.md.
  cannons: number;
  // Opt-in per-ship insurance, toggled anytime (not shipyard-restricted).
  // While true, costs INSURANCE_PREMIUM_PER_TURN each turn and pays out
  // INSURANCE_PAYOUT_RATE of any storm damage/pirate cargo loss that turn
  // — see docs/design/insurance.md, insurance-system.ts.
  insured: boolean;
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
  // Warehouses owned per city, 0 or absent = none. Each generates
  // WAREHOUSE_INCOME_PER_TURN passively every turn, capped at
  // MAX_WAREHOUSES_PER_CITY — see docs/design/warehouses.md,
  // warehouse-system.ts.
  warehouses: Partial<Record<CityId, number>>;
  // Temporary per-city/per-good effects from random events (market boom,
  // plague, embargo) — see docs/design/event-table.md and
  // src/game/systems/event-system.ts's applyCityEffects.
  cityEffects: CityEffect[];
  // Set when the player dies (health 0) with more than one heir-eligible
  // child — resolveTurn pauses succession rather than auto-picking, and
  // the game stays paused (no further turns) until CHOOSE_HEIR resolves
  // it. null the rest of the time, including when there's exactly one (or
  // zero) eligible heir, which still resolve automatically. See
  // docs/design/family-succession.md.
  pendingSuccession: PendingSuccession | null;
}

export interface PendingSuccession {
  candidates: Child[];
  halvedReputation: Record<CityId, number>;
  deceasedName: string;
  deceasedAge: number;
}

export type CityEffectType = 'embargo' | 'plague' | 'market_boost';

export interface CityEffect {
  cityId: CityId;
  goodId?: GoodId; // absent = applies city-wide (plague); present = one good (embargo, market_boost)
  type: CityEffectType;
  turnsRemaining: number;
  supplyBonus?: number; // market_boost only
  demandBonus?: number; // market_boost only
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
