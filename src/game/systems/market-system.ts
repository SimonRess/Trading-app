import type { GoodMarket, MarketState, CityId, GoodId, CityEffect } from '../state/types.ts';

export function currentPrice(market: GoodMarket): number {
  const factor = Math.max(0.2, Math.min(2.0, 2.0 - market.supply / 50));
  return Math.round(market.basePrice * factor);
}

export function priceTrend(prev: GoodMarket, curr: GoodMarket): '↑' | '↓' | '—' {
  const delta = prev.supply - curr.supply;
  if (delta > 5) return '↑';
  if (delta < -5) return '↓';
  return '—';
}

export function resolveTrade(
  market: GoodMarket,
  quantityBought: number,
): GoodMarket {
  return {
    ...market,
    supply: Math.max(0, Math.min(100, market.supply - quantityBought)),
  };
}

// production/consumption are the underlying flow rates (kept as-is
// internally, no save-file rename) — conceptually "Supply" and "Demand"
// per docs/design/event-table.md. supplyBonus/demandBonus come from active
// CityEffects (market_boost, plague) and are added to the flow for this
// turn only, without mutating the base rate.
export function resolveTurnMarket(market: GoodMarket, supplyBonus = 0, demandBonus = 0): GoodMarket {
  const next = market.supply + (market.production + supplyBonus) - (market.consumption + demandBonus);
  return { ...market, supply: Math.max(0, Math.min(100, next)) };
}

export function updateAllMarkets(market: MarketState, cityEffects: CityEffect[] = []): MarketState {
  const next = {} as MarketState;
  for (const cityId of Object.keys(market) as CityId[]) {
    const cityMarket = {} as typeof market[CityId];
    for (const goodId of Object.keys(market[cityId]) as GoodId[]) {
      const active = cityEffects.filter(e => e.cityId === cityId && (e.goodId === undefined || e.goodId === goodId));
      const supplyBonus = active.reduce((sum, e) => sum + (e.supplyBonus ?? 0), 0);
      const demandBonus = active.reduce((sum, e) => sum + (e.demandBonus ?? 0), 0);
      cityMarket[goodId] = resolveTurnMarket(market[cityId][goodId], supplyBonus, demandBonus);
    }
    next[cityId] = cityMarket;
  }
  return next;
}

export function isEmbargoed(cityEffects: CityEffect[], cityId: CityId, goodId: GoodId): boolean {
  return cityEffects.some(e => e.type === 'embargo' && e.cityId === cityId && e.goodId === goodId && e.turnsRemaining > 0);
}
