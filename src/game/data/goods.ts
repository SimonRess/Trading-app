import type { CityId, GoodId } from '../state/types.ts';
import type { CityMarket, MarketState } from '../state/types.ts';

interface GoodDefinition {
  id: GoodId;
  name: string;
  basePrice: number;
}

export const GOODS: Record<GoodId, GoodDefinition> = {
  salt:    { id: 'salt',    name: 'Salt',    basePrice: 8  },
  grain:   { id: 'grain',   name: 'Grain',   basePrice: 6  },
  timber:  { id: 'timber',  name: 'Timber',  basePrice: 10 },
  furs:    { id: 'furs',    name: 'Furs',    basePrice: 20 },
  herring: { id: 'herring', name: 'Herring', basePrice: 7  },
};

type MarketTable = Record<CityId, Record<GoodId, { supply: number; production: number; consumption: number }>>;

const MARKET_TABLE: MarketTable = {
  lubeck:  { salt: { supply: 70, production: 15, consumption: 3 }, grain:   { supply: 40, production: 0,  consumption: 5 }, timber:  { supply: 35, production: 0,  consumption: 6 }, furs:    { supply: 50, production: 0,  consumption: 4 }, herring: { supply: 40, production: 0,  consumption: 5 } },
  hamburg: { salt: { supply: 65, production: 10, consumption: 3 }, grain:   { supply: 35, production: 0,  consumption: 5 }, timber:  { supply: 40, production: 0,  consumption: 5 }, furs:    { supply: 45, production: 0,  consumption: 3 }, herring: { supply: 40, production: 0,  consumption: 5 } },
  danzig:  { salt: { supply: 40, production: 0,  consumption: 5 }, grain:   { supply: 75, production: 18, consumption: 4 }, timber:  { supply: 60, production: 10, consumption: 2 }, furs:    { supply: 45, production: 0,  consumption: 2 }, herring: { supply: 45, production: 0,  consumption: 4 } },
  riga:    { salt: { supply: 35, production: 0,  consumption: 5 }, grain:   { supply: 45, production: 0,  consumption: 3 }, timber:  { supply: 70, production: 12, consumption: 2 }, furs:    { supply: 75, production: 10, consumption: 1 }, herring: { supply: 40, production: 0,  consumption: 3 } },
  malmo:   { salt: { supply: 40, production: 0,  consumption: 4 }, grain:   { supply: 45, production: 0,  consumption: 4 }, timber:  { supply: 45, production: 0,  consumption: 3 }, furs:    { supply: 50, production: 0,  consumption: 2 }, herring: { supply: 75, production: 18, consumption: 3 } },
};

export function buildInitialMarket(): MarketState {
  const market = {} as MarketState;
  for (const cityId of Object.keys(MARKET_TABLE) as CityId[]) {
    const cityMarket = {} as CityMarket;
    for (const goodId of Object.keys(GOODS) as GoodId[]) {
      const row = MARKET_TABLE[cityId][goodId];
      cityMarket[goodId] = {
        supply: row.supply,
        basePrice: GOODS[goodId].basePrice,
        production: row.production,
        consumption: row.consumption,
      };
    }
    market[cityId] = cityMarket;
  }
  return market;
}
