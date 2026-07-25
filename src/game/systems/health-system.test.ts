import { describe, it, expect } from 'vitest';
import { rollHealthDecay, applyHealthDecay } from './health-system.ts';

describe('rollHealthDecay', () => {
  it('is age/40 plus 0-0.5 random plus eventModifier', () => {
    const decay = rollHealthDecay(20, 0);
    expect(decay).toBeGreaterThanOrEqual(0.5);
    expect(decay).toBeLessThan(1);
  });

  it('increases with age', () => {
    const young = rollHealthDecay(0, 0);
    const old = rollHealthDecay(100, 0);
    expect(young).toBeLessThanOrEqual(0.5); // 0/40 + [0,0.5)
    expect(old).toBeGreaterThanOrEqual(2.5); // 100/40 + [0,0.5)
  });

  it('includes the event modifier', () => {
    const withoutModifier = rollHealthDecay(20, 0);
    const withModifier = rollHealthDecay(20, 100);
    expect(withModifier).toBeGreaterThan(withoutModifier);
  });
});

describe('applyHealthDecay', () => {
  it('subtracts decay from current health', () => {
    const next = applyHealthDecay(100, 20, 0);
    expect(next).toBeLessThan(100);
    expect(next).toBeGreaterThanOrEqual(99);
  });

  it('floors at 0', () => {
    const next = applyHealthDecay(1, 100, 0);
    expect(next).toBe(0);
  });
});
