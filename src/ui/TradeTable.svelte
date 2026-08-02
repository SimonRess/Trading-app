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
  // Convoy-wide trading (docs/design/ship-convoys.md): mutually exclusive
  // with `ship` — when set, the In-hold column and Buy-disabled check read
  // the convoy's pooled cargo/space instead of a single ship's.
  export let convoyCargo: Partial<Record<GoodId, number>> | undefined = undefined;
  export let convoyCargoSpace: number | undefined = undefined;
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

  const dispatch = createEventDispatcher<{ buy: GoodId; sell: GoodId; sellAll: GoodId }>();

  $: active = ship !== undefined || convoyCargo !== undefined;
  $: holdQty = (goodId: GoodId) => (ship ? (ship.cargo[goodId] ?? 0) : (convoyCargo?.[goodId] ?? 0));
  $: availableSpace = ship ? cargoSpace(ship) : (convoyCargoSpace ?? 0);
</script>

<table class="market-table">
  <thead>
    <tr>
      <th>{T.colGood}</th>
      <th>{priceHeader}</th>
      <th>{T.colStock}</th>
      {#if active}
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
        {#if active}
          <td>{holdQty(goodId)}</td>
          <td>
            {#if selectedCityId === portCity}
              {@const preview = buyPreview(state, selectedCityId, goodId, buyQty)}
              <button
                class="trade-btn buy"
                on:click={() => dispatch('buy', goodId)}
                disabled={availableSpace < buyQty || state.player.cash < preview.totalCost}
                title={buyQty > 1 ? T.tradePreviewTitle(preview.avgUnitPrice.toFixed(1), currentPrice(cityMarket[goodId])) : ''}
              >{T.buyBtn(buyQty, preview.totalCost)}</button>
            {/if}
          </td>
          <td>
            {#if selectedCityId === portCity && holdQty(goodId) > 0}
              {@const preview = sellPreview(state, selectedCityId, goodId, sellQty)}
              <button
                class="trade-btn sell"
                on:click={() => dispatch('sell', goodId)}
                disabled={holdQty(goodId) < sellQty}
                title={sellQty > 1 ? T.tradePreviewTitle(preview.avgUnitPrice.toFixed(1), currentPrice(cityMarket[goodId])) : ''}
              >{T.sellBtn(sellQty, preview.totalCost)}</button>
              <button
                class="trade-btn sell-all"
                on:click={() => dispatch('sellAll', goodId)}
              >{T.sellAllBtn}</button>
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
  .trade-btn.sell-all {
    background: none;
    border-color: transparent;
    color: #b08a50;
    text-decoration: underline;
    margin-left: 0.3rem;
  }
  .trade-btn.sell-all:hover { background: none; color: #d4a843; }

  @media (max-width: 700px) {
    .trade-btn { padding: 0.45rem 0.7rem; }
  }
</style>
