import { describe, it, expect } from 'vitest';
import { currentPrice, resolveTrade, resolveTradeStepped, resolveTurnMarket, priceTrend, updateAllMarkets, isEmbargoed } from './market-system.ts';
import type { GoodMarket, CityEffect, MarketState } from '../state/types.ts';

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

describe('resolveTradeStepped', () => {
  it('matches a single flat-price purchase for quantity 1', () => {
    const result = resolveTradeStepped({ ...base, supply: 50 }, 1, 1);
    expect(result.totalCost).toBe(currentPrice({ ...base, supply: 50 }));
    expect(result.market.supply).toBe(49);
  });

  it('a large buy costs more per unit than the flat spot price, as supply falls', () => {
    const result = resolveTradeStepped({ ...base, supply: 50 }, 20, 1);
    const flatCost = currentPrice({ ...base, supply: 50 }) * 20;
    expect(result.totalCost).toBeGreaterThan(flatCost);
    expect(result.market.supply).toBe(30);
  });

  it('a large sell earns less per unit than the flat spot price, as supply rises', () => {
    const result = resolveTradeStepped({ ...base, supply: 50 }, 20, -1);
    const flatRevenue = currentPrice({ ...base, supply: 50 }) * 20;
    expect(result.totalCost).toBeLessThan(flatRevenue);
    expect(result.market.supply).toBe(70);
  });

  it('applies a flat unit-price factor (e.g. a trait discount) to every step', () => {
    const full = resolveTradeStepped({ ...base, supply: 50 }, 10, 1, 1);
    const discounted = resolveTradeStepped({ ...base, supply: 50 }, 10, 1, 0.95);
    expect(discounted.totalCost).toBeLessThan(full.totalCost);
  });

  it('reports the average unit price paid', () => {
    const result = resolveTradeStepped({ ...base, supply: 50 }, 20, 1);
    expect(result.avgUnitPrice).toBeCloseTo(result.totalCost / 20);
  });

  it('quantity 0 costs nothing and leaves the market unchanged', () => {
    const result = resolveTradeStepped({ ...base, supply: 50 }, 0, 1);
    expect(result.totalCost).toBe(0);
    expect(result.avgUnitPrice).toBe(0);
    expect(result.market.supply).toBe(50);
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

describe('resolveTurnMarket with bonuses', () => {
  it('adds supplyBonus/demandBonus from active city effects', () => {
    const result = resolveTurnMarket({ ...base, supply: 50, production: 5, consumption: 3 }, 20, 10);
    expect(result.supply).toBe(62); // 50 + (5+20) - (3+10)
  });
});

describe('updateAllMarkets with city effects', () => {
  const market: MarketState = {
    lubeck: { salt: { ...base } },
  } as unknown as MarketState;

  it('applies a market_boost effect only to the matching city/good', () => {
    const effects: CityEffect[] = [{ cityId: 'lubeck', goodId: 'salt', type: 'market_boost', turnsRemaining: 2, supplyBonus: 20, demandBonus: 10 }];
    const next = updateAllMarkets(market, effects);
    expect(next.lubeck.salt.supply).toBe(62);
  });

  it('applies a plague effect (no goodId) to every good in that city', () => {
    const effects: CityEffect[] = [{ cityId: 'lubeck', type: 'plague', turnsRemaining: 2, supplyBonus: -10 }];
    const next = updateAllMarkets(market, effects);
    expect(next.lubeck.salt.supply).toBe(42); // 50 + (5-10) - 3
  });

  it('is unaffected by an effect in a different city', () => {
    const effects: CityEffect[] = [{ cityId: 'hamburg', goodId: 'salt', type: 'market_boost', turnsRemaining: 2, supplyBonus: 20 }];
    const next = updateAllMarkets(market, effects);
    expect(next.lubeck.salt.supply).toBe(52);
  });
});

describe('isEmbargoed', () => {
  it('is true for an active embargo on that city/good', () => {
    const effects: CityEffect[] = [{ cityId: 'lubeck', goodId: 'salt', type: 'embargo', turnsRemaining: 1 }];
    expect(isEmbargoed(effects, 'lubeck', 'salt')).toBe(true);
  });

  it('is false for a different good', () => {
    const effects: CityEffect[] = [{ cityId: 'lubeck', goodId: 'salt', type: 'embargo', turnsRemaining: 1 }];
    expect(isEmbargoed(effects, 'lubeck', 'grain')).toBe(false);
  });

  it('is false once expired', () => {
    const effects: CityEffect[] = [{ cityId: 'lubeck', goodId: 'salt', type: 'embargo', turnsRemaining: 0 }];
    expect(isEmbargoed(effects, 'lubeck', 'salt')).toBe(false);
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
