import type { GoodMarket, MarketState, CityId, GoodId } from '../state/types.ts';

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

export function resolveTurnMarket(market: GoodMarket): GoodMarket {
  const next = market.supply + market.production - market.consumption;
  return { ...market, supply: Math.max(0, Math.min(100, next)) };
}

export function updateAllMarkets(market: MarketState): MarketState {
  const next = {} as MarketState;
  for (const cityId of Object.keys(market) as CityId[]) {
    const cityMarket = {} as typeof market[CityId];
    for (const goodId of Object.keys(market[cityId]) as GoodId[]) {
      cityMarket[goodId] = resolveTurnMarket(market[cityId][goodId]);
    }
    next[cityId] = cityMarket;
  }
  return next;
}
