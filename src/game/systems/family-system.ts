import type { GameState, Child, TraitId } from '../state/types.ts';
import { isInPort } from './fleet-system.ts';
import {
  PARTNER_TYPES,
  MARRIAGE_SUCCESS_CHANCE,
  MIN_MARRIAGE_AGE,
  TRAIT_IDS,
  MAX_CHILD_TRAITS,
  CHILD_BASE_TRAIT_ROLL_CHANCE,
  CHILD_TUTORED_TRAIT_ROLL_CHANCE,
  HIRE_TUTOR_COST,
  HEIR_MIN_AGE,
  birthChance,
  nextChildName,
} from '../data/family.ts';

export function executeSeekMarriage(state: GameState): GameState {
  if (state.player.maritalStatus === 'married') return state;
  if (state.player.age < MIN_MARRIAGE_AGE) return state;

  const partnerType = PARTNER_TYPES[0];
  if (!partnerType) return state;
  if (state.player.cash < partnerType.buyoutCost) return state;
  if (Math.random() > MARRIAGE_SUCCESS_CHANCE) return state;

  let newState: GameState = {
    ...state,
    player: {
      ...state.player,
      cash: state.player.cash - partnerType.buyoutCost,
      maritalStatus: 'married',
      partner: { title: partnerType.title, age: partnerType.age, gender: partnerType.gender },
    },
  };

  if (partnerType.giftCityId && partnerType.giftGoodId && partnerType.giftQuantity) {
    const ship = newState.fleet.ships.find(s => isInPort(s) && s.position === partnerType.giftCityId);
    if (ship) {
      const goodId = partnerType.giftGoodId;
      const qty = partnerType.giftQuantity;
      const newCargo = { ...ship.cargo, [goodId]: (ship.cargo[goodId] ?? 0) + qty };
      newState = {
        ...newState,
        fleet: { ships: newState.fleet.ships.map(s => (s.id === ship.id ? { ...s, cargo: newCargo } : s)) },
      };
    }
  }

  return newState;
}

export function executeHireTutor(state: GameState, childId: string): GameState {
  const child = state.player.children.find(c => c.id === childId);
  if (!child) return state;
  if (child.age >= HEIR_MIN_AGE) return state;
  if (child.traits.length >= MAX_CHILD_TRAITS) return state;
  if (child.tutoredThisYear) return state;
  if (state.player.cash < HIRE_TUTOR_COST) return state;

  const newChild: Child = { ...child, tutoredThisYear: true };
  return {
    ...state,
    player: {
      ...state.player,
      cash: state.player.cash - HIRE_TUTOR_COST,
      children: state.player.children.map(c => (c.id === childId ? newChild : c)),
    },
  };
}

function rollTrait(existing: TraitId[]): TraitId | null {
  const pool = TRAIT_IDS.filter(t => !existing.includes(t));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

// Called once per in-game year (Spring rollover) — advances every child's
// age, rolls a chance-based trait for children still growing (age <
// HEIR_MIN_AGE), and resets each child's tutoredThisYear flag. Returns the
// updated children plus messages for any trait gained, for the caller to
// fold into the turn summary.
export function growChildren(children: Child[]): { children: Child[]; messages: string[] } {
  const messages: string[] = [];

  const next = children.map(child => {
    const age = child.age + 1;
    if (age >= HEIR_MIN_AGE || child.traits.length >= MAX_CHILD_TRAITS) {
      return { ...child, age, tutoredThisYear: false };
    }

    const chance = child.tutoredThisYear ? CHILD_TUTORED_TRAIT_ROLL_CHANCE : CHILD_BASE_TRAIT_ROLL_CHANCE;
    if (Math.random() < chance) {
      const trait = rollTrait(child.traits);
      if (trait) {
        messages.push(`👶 ${child.name} has developed the trait "${trait}".`);
        return { ...child, age, traits: [...child.traits, trait], tutoredThisYear: false };
      }
    }

    // A tutor was hired but this year's (boosted) roll didn't produce a
    // trait — surface that explicitly. Without this, the "Tutored" flag
    // just silently reverted to "Hire Tutor" at the next Spring rollover
    // with no visible cause, which players reported as the tutor
    // "randomly disappearing" (2026-07-25).
    if (child.tutoredThisYear) {
      messages.push(`📚 ${child.name}'s tutoring this year didn't produce a new trait — hire again to try next year.`);
    }

    return { ...child, age, tutoredThisYear: false };
  });

  return { children: next, messages };
}

// Called once per year alongside growChildren — while married, a chance of
// a new child, decreasing with the female partner's age (whichever of
// player/partner is female; only female partner types exist so far, so
// this always resolves to the partner). See docs/design/
// family-succession.md "Birth chance".
export function attemptBirth(state: GameState): { children: Child[]; message: string | null } {
  if (state.player.maritalStatus !== 'married' || !state.player.partner) {
    return { children: state.player.children, message: null };
  }

  const femaleAge = state.player.gender === 'female' ? state.player.age : state.player.partner.age;
  const chance = birthChance(femaleAge);
  if (Math.random() >= chance) return { children: state.player.children, message: null };

  const gender: 'male' | 'female' = Math.random() < 0.5 ? 'male' : 'female';
  const name = nextChildName(gender, state.player.children.length);
  const child: Child = { id: `child-${String(Date.now())}-${String(Math.random())}`, name, age: 0, gender, health: 100, traits: [], tutoredThisYear: false };

  return {
    children: [...state.player.children, child],
    message: `👶 A child is born! ${name} joins the family.`,
  };
}

export function traitPurchasePriceFactor(traits: TraitId[]): number {
  let factor = 1;
  if (traits.includes('penny-pincher')) factor -= 0.05;
  if (traits.includes('simpleton')) factor += 0.05;
  return factor;
}
