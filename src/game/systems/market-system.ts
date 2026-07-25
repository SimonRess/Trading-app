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

export interface SteppedTradeResult {
  market: GoodMarket;
  totalCost: number;
  avgUnitPrice: number;
}

// Buying/selling used to price an entire order at a single "spot" unit
// price (price × quantity), with the market's supply shift only applied
// once the whole order was already paid for — so a 50-unit order cost
// exactly 50x today's single-unit price, with no in-transaction price
// pressure at all. This instead re-derives currentPrice() after each unit
// (via the existing resolveTrade supply shift), same curve as before, just
// applied incrementally rather than all at once — so a large order
// genuinely moves the price against the trader as it's filled. `sign` is
// +1 for a buy (supply falls, price rises) or -1 for a sell (supply rises,
// price falls); `unitPriceFactor` applies flat multipliers that don't
// depend on the market itself (e.g. a Penny-pincher/Simpleton trait).
export function resolveTradeStepped(
  market: GoodMarket,
  quantity: number,
  sign: 1 | -1,
  unitPriceFactor = 1,
): SteppedTradeResult {
  let currentMarket = market;
  let totalCost = 0;

  for (let i = 0; i < quantity; i++) {
    const unitPrice = Math.round(currentPrice(currentMarket) * unitPriceFactor);
    totalCost += unitPrice;
    currentMarket = resolveTrade(currentMarket, sign);
  }

  return { market: currentMarket, totalCost, avgUnitPrice: quantity > 0 ? totalCost / quantity : 0 };
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
