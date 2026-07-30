<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { GameState, Ship, CityId, GoodId } from '../game/state/types.ts';
  import { currentPrice } from '../game/systems/market-system.ts';
  import { cargoSpace } from '../game/systems/fleet-system.ts';
  import { GOOD_ICONS } from './icons.ts';
  import type { Translation } from './i18n.ts';

  export let T: Translation;
  export let goodIds: GoodId[];
  export let goodNames: Record<GoodId, string>;
  export let cityMarket: GameState['market'][CityId];
  export let state: GameState;
  export let selectedCityId: CityId;
  export let portCity: CityId | undefined;
  export let priceHeader: string;
  export let ship: Ship | undefined = undefined;
  export let buyQty = 1;
  export let sellQty = 1;
  type PreviewFn = (gameState: GameState, cityId: CityId, goodId: GoodId, qty: number) => { totalCost: number; avgUnitPrice: number };
  // Only called from inside `{#if ship}` branches below (the read-only,
  // no-ship variant never renders Buy/Sell cells) — the no-op default lets
  // the two props stay optional for that variant without needing `| undefined`
  // narrowing in the template.
  const noPreview: PreviewFn = () => ({ totalCost: 0, avgUnitPrice: 0 });
  export let buyPreview: PreviewFn = noPreview;
  export let sellPreview: PreviewFn = noPreview;

  const dispatch = createEventDispatcher<{ buy: GoodId; sell: GoodId }>();
</script>

<table class="market-table">
  <thead>
    <tr>
      <th>{T.colGood}</th>
      <th>{priceHeader}</th>
      <th>{T.colStock}</th>
      {#if ship}
        <th>{T.colInHold}</th>
        <th colspan="2">{T.colTrade}</th>
      {/if}
    </tr>
  </thead>
  <tbody>
    {#each goodIds as goodId}
      <tr>
        <td>{GOOD_ICONS[goodId]} {goodNames[goodId]}</td>
        <td>{currentPrice(cityMarket[goodId])} M</td>
        <td>{cityMarket[goodId].supply}</td>
        {#if ship}
          <td>{ship.cargo[goodId] ?? 0}</td>
          <td>
            {#if selectedCityId === portCity}
              {@const preview = buyPreview(state, selectedCityId, goodId, buyQty)}
              <button
                class="trade-btn buy"
                on:click={() => dispatch('buy', goodId)}
                disabled={cargoSpace(ship) < buyQty || state.player.cash < preview.totalCost}
                title={buyQty > 1 ? T.tradePreviewTitle(preview.avgUnitPrice.toFixed(1), currentPrice(cityMarket[goodId])) : ''}
              >{T.buyBtn(buyQty, preview.totalCost)}</button>
            {/if}
          </td>
          <td>
            {#if selectedCityId === portCity && (ship.cargo[goodId] ?? 0) > 0}
              {@const preview = sellPreview(state, selectedCityId, goodId, sellQty)}
              <button
                class="trade-btn sell"
                on:click={() => dispatch('sell', goodId)}
                disabled={(ship.cargo[goodId] ?? 0) < sellQty}
                title={sellQty > 1 ? T.tradePreviewTitle(preview.avgUnitPrice.toFixed(1), currentPrice(cityMarket[goodId])) : ''}
              >{T.sellBtn(sellQty, preview.totalCost)}</button>
            {/if}
          </td>
        {/if}
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .market-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
    margin-bottom: 0.8rem;
  }
  .market-table th {
    text-align: left;
    padding: 0.3rem 0.5rem;
    color: #8a7a60;
    border-bottom: 1px solid #3a2e18;
    font-weight: normal;
    font-size: 0.78rem;
  }
  .market-table td { padding: 0.3rem 0.5rem; border-bottom: 1px solid #2a2018; }

  .trade-btn { padding: 0.2rem 0.5rem; font-size: 0.78rem; }
  .trade-btn.buy { background: #1a3820; border-color: #4a8840; color: #90d890; }
  .trade-btn.buy:hover:not(:disabled) { background: #224828; }
  .trade-btn.sell { background: #381820; border-color: #884040; color: #d89090; }
  .trade-btn.sell:hover:not(:disabled) { background: #482228; }

  @media (max-width: 700px) {
    .trade-btn { padding: 0.45rem 0.7rem; }
  }
</style>
