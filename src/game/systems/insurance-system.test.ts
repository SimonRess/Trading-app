import { describe, it, expect } from 'vitest';
import { buildStartingState } from '../data/starting-config.ts';
import {
  executeToggleInsurance,
  accrueInsurancePremiums,
  computeInsurancePayouts,
  INSURANCE_PREMIUM_PER_TURN,
} from './insurance-system.ts';

describe('executeToggleInsurance', () => {
  it('turns insurance on for an uninsured ship', () => {
    const state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    const next = executeToggleInsurance(state, shipId);
    expect(next.fleet.ships[0]!.insured).toBe(true);
  });

  it('turns insurance back off', () => {
    const state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    const insured = executeToggleInsurance(state, shipId);
    const uninsured = executeToggleInsurance(insured, shipId);
    expect(uninsured.fleet.ships[0]!.insured).toBe(false);
  });

  it('is a no-op for an unknown ship id', () => {
    const state = buildStartingState('TestPlayer');
    const next = executeToggleInsurance(state, 'no-such-ship');
    expect(next).toBe(state);
  });

  it('does not require the ship to be in port', () => {
    const state = buildStartingState('TestPlayer');
    const shipId = state.fleet.ships[0]!.id;
    const inTransit = {
      ...state,
      fleet: { ships: [{ ...state.fleet.ships[0]!, position: { from: 'lubeck' as const, to: 'danzig' as const, turnsRemaining: 2 } }] },
    };
    const next = executeToggleInsurance(inTransit, shipId);
    expect(next.fleet.ships[0]!.insured).toBe(true);
  });
});

describe('accrueInsurancePremiums', () => {
  it('is 0 with no insured ships', () => {
    const state = buildStartingState('TestPlayer');
    expect(accrueInsurancePremiums(state.fleet.ships)).toBe(0);
  });

  it('charges a flat premium per insured ship', () => {
    const state = buildStartingState('TestPlayer');
    const insured = executeToggleInsurance(state, state.fleet.ships[0]!.id);
    expect(accrueInsurancePremiums(insured.fleet.ships)).toBe(INSURANCE_PREMIUM_PER_TURN);
  });
});

describe('computeInsurancePayouts', () => {
  it('pays out nothing for an uninsured ship even if damaged', () => {
    const state = buildStartingState('TestPlayer');
    const pre = state.fleet.ships;
    const post = [{ ...state.fleet.ships[0]!, durability: 80 }];
    const result = computeInsurancePayouts(pre, post);
    expect(result.totalPayout).toBe(0);
    expect(result.messages).toEqual([]);
  });

  it('pays 50% of storm damage value for an insured ship', () => {
    const state = buildStartingState('TestPlayer');
    const insured = executeToggleInsurance(state, state.fleet.ships[0]!.id);
    const pre = insured.fleet.ships;
    // Kogge purchase price 400; 20-point durability loss = 80 Mark value lost.
    const post = [{ ...insured.fleet.ships[0]!, durability: pre[0]!.durability - 20 }];
    const result = computeInsurancePayouts(pre, post);
    expect(result.totalPayout).toBe(40);
    expect(result.messages[0]).toContain('storm damage');
  });

  it('pays 50% of lost cargo value for an insured ship', () => {
    const state = buildStartingState('TestPlayer');
    const insured = executeToggleInsurance(state, state.fleet.ships[0]!.id);
    const pre = insured.fleet.ships; // starts with 20 salt (basePrice 8)
    const post = [{ ...insured.fleet.ships[0]!, cargo: { salt: 10 } }]; // lost 10 salt = 80 Mark
    const result = computeInsurancePayouts(pre, post);
    expect(result.totalPayout).toBe(40);
    expect(result.messages[0]).toContain('lost cargo');
  });

  it('does not pay out for a wrecked (removed) ship', () => {
    const state = buildStartingState('TestPlayer');
    const insured = executeToggleInsurance(state, state.fleet.ships[0]!.id);
    const pre = insured.fleet.ships;
    const post: typeof pre = [];
    const result = computeInsurancePayouts(pre, post);
    expect(result.totalPayout).toBe(0);
  });

  it('does not mutate the input arrays', () => {
    const state = buildStartingState('TestPlayer');
    const insured = executeToggleInsurance(state, state.fleet.ships[0]!.id);
    const pre = insured.fleet.ships;
    const before = JSON.parse(JSON.stringify(pre)) as typeof pre;
    const post = [{ ...pre[0]!, durability: pre[0]!.durability - 10 }];
    computeInsurancePayouts(pre, post);
    expect(pre).toEqual(before);
  });
});
