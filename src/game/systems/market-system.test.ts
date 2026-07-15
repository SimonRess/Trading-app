import { describe, it, expect } from 'vitest';
import { currentPrice, resolveTrade, resolveTurnMarket, priceTrend } from './market-system.ts';
import type { GoodMarket } from '../state/types.ts';

const base: GoodMarket = { supply: 50, basePrice: 10, production: 5, consumption: 3 };

describe('currentPrice', () => {
  it('returns base price at equilibrium supply (50)', () => {
    expect(currentPrice({ ...base, supply: 50 })).toBe(10);
  });

  it('doubles price at zero supply', () => {
    expect(currentPrice({ ...base, supply: 0 })).toBe(20);
  });

  it('floors at 20% of base price at full supply (100)', () => {
    expect(currentPrice({ ...base, supply: 100 })).toBe(2);
  });

  it('clamps below zero supply to 2x', () => {
    expect(currentPrice({ ...base, supply: -10 })).toBe(20);
  });
});

describe('resolveTrade', () => {
  it('reduces supply by quantity bought', () => {
    const result = resolveTrade({ ...base, supply: 60 }, 20);
    expect(result.supply).toBe(40);
  });

  it('clamps supply at 0', () => {
    const result = resolveTrade({ ...base, supply: 10 }, 50);
    expect(result.supply).toBe(0);
  });

  it('does not mutate the input', () => {
    const market = { ...base, supply: 60 };
    resolveTrade(market, 20);
    expect(market.supply).toBe(60);
  });
});

describe('resolveTurnMarket', () => {
  it('applies production and consumption each turn', () => {
    const result = resolveTurnMarket({ ...base, supply: 50, production: 5, consumption: 3 });
    expect(result.supply).toBe(52);
  });

  it('clamps supply at 100', () => {
    const result = resolveTurnMarket({ ...base, supply: 98, production: 10, consumption: 0 });
    expect(result.supply).toBe(100);
  });

  it('clamps supply at 0', () => {
    const result = resolveTurnMarket({ ...base, supply: 2, production: 0, consumption: 10 });
    expect(result.supply).toBe(0);
  });
});

describe('priceTrend', () => {
  it('returns ↑ when supply dropped significantly', () => {
    expect(priceTrend({ ...base, supply: 60 }, { ...base, supply: 50 })).toBe('↑');
  });

  it('returns ↓ when supply rose significantly', () => {
    expect(priceTrend({ ...base, supply: 50 }, { ...base, supply: 60 })).toBe('↓');
  });

  it('returns — for small changes', () => {
    expect(priceTrend({ ...base, supply: 50 }, { ...base, supply: 53 })).toBe('—');
  });
});
