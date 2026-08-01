import type { CityId, GoodId, Gender, TraitId } from '../state/types.ts';

export interface PartnerType {
  id: string;
  title: string;
  age: number;
  gender: Gender;
  buyoutCost: number; // Mark paid at marriage
  ships: never[]; // reserved for future partner types that bring ships into the marriage
  hasStatus: boolean; // true if this partner grants a reputation gift (giftReputation* below) rather than/in addition to a goods gift
  giftCityId?: CityId;
  giftGoodId?: GoodId;
  giftQuantity?: number;
  giftReputationCityId?: CityId;
  giftReputationAmount?: number;
  // Offers below this net worth aren't shown at all — a poor merchant
  // isn't a match for an alderman's family. Undefined = always available,
  // same as the Fisherman's Daughter today. See docs/design/
  // family-succession.md "Marriage" for the reasoning.
  minNetWorth?: number;
}

// Two partner types exist — see docs/design/family-succession.md
// "Marriage". Eligible offers (net worth permitting) are shown together in
// the Merchant's House rather than picked randomly, keeping the mechanic
// deterministic; a future pass could add a weighted-random element on top
// of this if that turns out to matter, mirroring SHIP_TYPES/GOODS'
// registry pattern either way.
export const PARTNER_TYPES: PartnerType[] = [
  {
    id: 'fishermans-daughter',
    title: "the Fisherman's Daughter",
    age: 22,
    gender: 'female',
    buyoutCost: 300,
    ships: [],
    hasStatus: false,
    giftCityId: 'lubeck',
    giftGoodId: 'herring',
    giftQuantity: 10,
  },
  {
    id: 'aldermans-daughter',
    title: "the Alderman's Daughter",
    age: 24,
    gender: 'female',
    buyoutCost: 2000,
    ships: [],
    hasStatus: true,
    giftReputationCityId: 'hamburg',
    giftReputationAmount: 10,
    // A starting player's net worth is already ~4,660 (500 cash + a
    // ~4,000 Mark ship + starting cargo), comfortably past
    // RANK_THRESHOLDS' Council Member tier (4,000) — a gate anywhere
    // near that would be trivially met at New Game, defeating the "not
    // a match for a poor merchant" point. Set between Council Member
    // and Mayor (10,000) so it requires real progress.
    minNetWorth: 6000,
  },
];

// Probability the marriage proposal succeeds at all — always 100% for now
// (only one partner type, always accepts); a future pass with multiple
// partner types would make this genuinely probabilistic.
export const MARRIAGE_SUCCESS_CHANCE = 1;

export const MIN_MARRIAGE_AGE = 16;

export interface TraitDef {
  id: TraitId;
  label: string;
  description: string;
}

export const TRAITS: Record<TraitId, TraitDef> = {
  'penny-pincher': { id: 'penny-pincher', label: 'Penny-pincher', description: 'Purchase prices 5% lower.' },
  simpleton: { id: 'simpleton', label: 'Simpleton', description: 'Purchase prices 5% higher.' },
  charismatic: { id: 'charismatic', label: 'Charismatic', description: 'Reputation gains +10%, losses -10%.' },
  'hot-tempered': { id: 'hot-tempered', label: 'Hot-tempered', description: 'Reputation losses +10%.' },
};

export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];

const CHILD_NAMES_MALE = ['Hans', 'Peter', 'Klaus', 'Bernt', 'Tile'];
const CHILD_NAMES_FEMALE = ['Grete', 'Katarina', 'Ilse', 'Anneke', 'Wibbeke'];

export function nextChildName(gender: Gender, existingCount: number): string {
  const pool = gender === 'male' ? CHILD_NAMES_MALE : CHILD_NAMES_FEMALE;
  return pool[existingCount % pool.length] ?? (gender === 'male' ? 'Heinrich' : 'Margarethe');
}

export const CHILD_BASE_TRAIT_ROLL_CHANCE = 0.05; // per year, no tutor
export const CHILD_TUTORED_TRAIT_ROLL_CHANCE = 0.25; // per year, tutor hired
export const HIRE_TUTOR_COST = 30;
export const MAX_CHILD_TRAITS = 2;
export const HEIR_MIN_AGE = 10;

export const BASE_BIRTH_CHANCE = 0.3;
export const BIRTH_CHANCE_BASELINE_AGE = 20;
export const BIRTH_CHANCE_DECAY_PER_YEAR = 0.01;

export function birthChance(femaleAge: number): number {
  const chance = BASE_BIRTH_CHANCE - (femaleAge - BIRTH_CHANCE_BASELINE_AGE) * BIRTH_CHANCE_DECAY_PER_YEAR;
  return Math.max(0, Math.min(BASE_BIRTH_CHANCE, chance));
}
