import { describe, it, expect, vi } from 'vitest';
import { resolveCombat, playerCombatPower, convoyCombatPower, resolveConvoyCombat } from './combat-system.ts';
import { buildInitialRiskState } from './risk-system.ts';
import type { Ship } from '../state/types.ts';

const shipInTransit = (overrides?: Partial<Ship>): Ship => ({
  id: 'ship-1',
  name: 'Wulf',
  type: 'kogge',
  durability: 100,
  position: { from: 'lubeck', to: 'danzig', turnsRemaining: 1 },
  cargo: {},
  crew: 8,
  cannons: 0,
  insured: false,
  repairCooldown: 0,
  posture: 'defensive',
  ...overrides,
});

describe('playerCombatPower', () => {
  it('is 0 for a fleeing ship regardless of cannons/crew', () => {
    const ship = shipInTransit({ posture: 'flee', cannons: 6, crew: 8 });
    expect(playerCombatPower(ship)).toBe(0);
  });

  it('scales with cannons and crew', () => {
    const bare = shipInTransit({ cannons: 0, crew: 0, posture: 'defensive' });
    const armed = shipInTransit({ cannons: 6, crew: 8, posture: 'defensive' });
    expect(playerCombatPower(armed)).toBeGreaterThan(playerCombatPower(bare));
  });

  it('aggressive posture grants more power than defensive, all else equal', () => {
    const defensive = shipInTransit({ posture: 'defensive' });
    const aggressive = shipInTransit({ posture: 'aggressive' });
    expect(playerCombatPower(aggressive)).toBeGreaterThan(playerCombatPower(defensive));
  });
});

describe('convoyCombatPower', () => {
  it('sums power across members and applies the posture modifier once', () => {
    const a = shipInTransit({ id: 'a', cannons: 2, crew: 4 });
    const b = shipInTransit({ id: 'b', cannons: 3, crew: 4 });
    const combined = convoyCombatPower([a, b], 'defensive');
    const soloA = playerCombatPower(a);
    const soloB = playerCombatPower(b);
    expect(combined).toBe(soloA + soloB);
  });

  it('is 0 for a fleeing convoy', () => {
    const a = shipInTransit({ cannons: 6, crew: 8 });
    expect(convoyCombatPower([a], 'flee')).toBe(0);
  });
});

describe('resolveConvoyCombat', () => {
  it('always flees without a power roll when posture is flee', () => {
    const risk = buildInitialRiskState();
    const a = shipInTransit();
    const result = resolveConvoyCombat([a], 'flee', risk, 'summer');
    expect(result.outcome).toBe('flee');
    expect(result.playerPower).toBeNull();
  });

  it('rolls one outcome shared by the whole convoy', () => {
    const risk = buildInitialRiskState();
    const a = shipInTransit({ cannons: 10, crew: 10 });
    const b = shipInTransit({ id: 'b', cannons: 10, crew: 10 });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = resolveConvoyCombat([a, b], 'aggressive', risk, 'summer');
    expect(result.outcome).toBe('victory');
    vi.restoreAllMocks();
  });
});

describe('resolveCombat', () => {
  it('always flees with no power roll when posture is flee', () => {
    const risk = buildInitialRiskState();
    const ship = shipInTransit({ posture: 'flee' });
    const result = resolveCombat(ship, risk, 'winter');
    expect(result.outcome).toBe('flee');
    expect(result.playerPower).toBeNull();
    expect(result.enemyPower).toBeNull();
    expect(result.durabilityLoss).toBe(0);
  });

  it('flee cargo loss falls between retreat\'s and defeat\'s ranges', () => {
    const risk = buildInitialRiskState();
    const ship = shipInTransit({ posture: 'flee' });
    for (let i = 0; i < 50; i++) {
      const result = resolveCombat(ship, risk, 'winter');
      expect(result.cargoLossFraction).toBeGreaterThanOrEqual(0.2);
      expect(result.cargoLossFraction).toBeLessThanOrEqual(0.35);
    }
  });

  it('a heavily-armed ship on a calm route usually wins', () => {
    const risk = buildInitialRiskState();
    const ship = shipInTransit({ cannons: 6, crew: 8, posture: 'aggressive' });
    let victories = 0;
    for (let i = 0; i < 100; i++) {
      const result = resolveCombat(ship, risk, 'summer');
      if (result.outcome === 'victory') victories++;
    }
    expect(victories).toBeGreaterThan(50);
  });

  it('an unarmed, uncrewed ship usually loses or retreats, never wins', () => {
    const risk = buildInitialRiskState();
    const ship = shipInTransit({ cannons: 0, crew: 0, posture: 'defensive' });
    let victories = 0;
    for (let i = 0; i < 100; i++) {
      const result = resolveCombat(ship, risk, 'winter');
      if (result.outcome === 'victory') victories++;
    }
    expect(victories).toBe(0);
  });

  it('victory always grants some loot', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0) // enemy power roll -> minimum
      .mockReturnValueOnce(0) // random spread -> minimum (still a strong win)
      .mockReturnValue(0.1); // loot rolls
    const risk = buildInitialRiskState();
    const ship = shipInTransit({ cannons: 6, crew: 8, posture: 'aggressive' });
    const result = resolveCombat(ship, risk, 'summer');
    expect(result.outcome).toBe('victory');
    expect(Object.keys(result.loot).length).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });

  it('defeat carries both durability loss and cargo loss', () => {
    // First call is the enemy's base power roll (pushed to its max); the
    // second is the outcome's random spread (pushed to its min) — an
    // unarmed ship facing a maxed-out enemy with the worst possible spread
    // guarantees a defeat regardless of route/season danger factor.
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.999).mockReturnValue(0);
    const risk = buildInitialRiskState();
    const ship = shipInTransit({ cannons: 0, crew: 0, posture: 'defensive' });
    const result = resolveCombat(ship, risk, 'winter');
    expect(result.outcome).toBe('defeat');
    expect(result.durabilityLoss).toBeGreaterThan(0);
    expect(result.cargoLossFraction).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });
});
