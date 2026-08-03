<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { GameState, Ship, CityId } from '../game/state/types.ts';
  import { cargoTotal, cargoCapacity, isInPort } from '../game/systems/fleet-system.ts';
  import { durabilityStatus, SHIP_TYPES } from '../game/data/ships.ts';
  import { CITIES } from '../game/data/cities.ts';
  import { groupShipsByConvoy, convoyCargo as convoyCargoOf, convoyCargoCapacity } from '../game/systems/convoy-system.ts';
  import type { Translation } from './i18n.ts';

  export let T: Translation;
  export let state: GameState;
  export let selectedShipId: string;
  export let selectedConvoyId: string | undefined;
  export let pendingDest: Record<string, CityId>;
  export let positionLabel: (ship: Ship) => string;
  export let shipTravelTurns: (ship: Ship | undefined, from: CityId | undefined, to: CityId | undefined) => number | undefined;
  export let shipCity: (ship: Ship | undefined) => CityId | undefined;
  export let groupingMode = false;
  export let groupSelection: Set<string> = new Set();

  const dispatch = createEventDispatcher<{
    selectShip: string;
    selectConvoy: string;
    toggleExpand: string;
    exclude: string;
    toggleGroup: string;
  }>();

  let expanded = new Set<string>();
  function toggleExpand(convoyId: string) {
    const next = new Set(expanded);
    if (next.has(convoyId)) next.delete(convoyId);
    else next.add(convoyId);
    expanded = next;
    dispatch('toggleExpand', convoyId);
  }

  $: grouping = groupShipsByConvoy(state.fleet);
  $: DURABILITY_LABELS = T.durability;

  function worstDurabilityStatus(ships: Ship[]): keyof Translation['durability'] {
    const order: Array<keyof Translation['durability']> = ['critical', 'damaged', 'worn', 'seaworthy'];
    let worst: keyof Translation['durability'] = 'seaworthy';
    for (const s of ships) {
      const status = durabilityStatus(s.durability) as keyof Translation['durability'];
      if (order.indexOf(status) < order.indexOf(worst)) worst = status;
    }
    return worst;
  }
</script>

<div class="fleet-list">
  {#each grouping.groups as group (group.convoy.id)}
    <div class="convoy-card" class:selected={group.convoy.id === selectedConvoyId}>
      <div
        class="convoy-header"
        on:click={() => dispatch('selectConvoy', group.convoy.id)}
        role="button"
        tabindex="0"
        on:keydown={e => { if (e.key === 'Enter') dispatch('selectConvoy', group.convoy.id); }}
      >
        <button class="convoy-fold-btn" on:click|stopPropagation={() => toggleExpand(group.convoy.id)}>
          {expanded.has(group.convoy.id) ? '▾' : '▸'}
        </button>
        <strong>⛵ {group.convoy.name}</strong>
        <span class="tag">{T.convoyMemberCount(group.ships.length)}</span>
        <span class="tag">{group.ships[0] ? positionLabel(group.ships[0]) : ''}</span>
        <span class="tag durability-{worstDurabilityStatus(group.ships)}">
          {T.durLabel} {DURABILITY_LABELS[worstDurabilityStatus(group.ships)]}
        </span>
        <span class="tag">{T.cargoLabel} {Object.values(convoyCargoOf(state.fleet, group.convoy)).reduce((a, b) => a + b, 0)}/{convoyCargoCapacity(state.fleet, group.convoy)}</span>
      </div>
      {#if expanded.has(group.convoy.id)}
        <div class="convoy-members">
          {#each group.ships as s (s.id)}
            <div
              class="ship-card member"
              class:selected={s.id === selectedShipId}
              on:click={() => dispatch('selectShip', s.id)}
              role="button"
              tabindex="0"
              on:keydown={e => { if (e.key === 'Enter') dispatch('selectShip', s.id); }}
            >
              <strong>{s.name}</strong>
              <span class="tag">{SHIP_TYPES[s.type].name}</span>
              <span class="tag durability-{durabilityStatus(s.durability)}">
                {T.durLabel} {s.durability}/100 · {DURABILITY_LABELS[durabilityStatus(s.durability)]}
              </span>
              <span class="tag">{T.cargoLabel} {cargoTotal(s)}/{cargoCapacity(s)}</span>
              <button
                class="exclude-btn"
                disabled={!isInPort(s)}
                on:click|stopPropagation={() => dispatch('exclude', s.id)}
              >{T.excludeFromConvoy}</button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/each}

  {#each grouping.independent as s (s.id)}
    <div
      class="ship-card"
      class:selected={s.id === selectedShipId}
      on:click={() => (groupingMode ? dispatch('toggleGroup', s.id) : dispatch('selectShip', s.id))}
      role="button"
      tabindex="0"
      on:keydown={e => { if (e.key === 'Enter') (groupingMode ? dispatch('toggleGroup', s.id) : dispatch('selectShip', s.id)); }}
    >
      {#if groupingMode}
        <input type="checkbox" checked={groupSelection.has(s.id)} disabled={!isInPort(s)} on:click|stopPropagation={() => dispatch('toggleGroup', s.id)} />
      {/if}
      <strong>{s.name}</strong>
      <span class="tag">{SHIP_TYPES[s.type].name}</span>
      <span class="tag">{positionLabel(s)}</span>
      {#if pendingDest[s.id]}
        <span class="tag order">⚓ → {CITIES[pendingDest[s.id]].name} ({shipTravelTurns(s, shipCity(s), pendingDest[s.id])}t)</span>
      {/if}
      <span class="tag durability-{durabilityStatus(s.durability)}">
        {T.durLabel} {s.durability}/100 · {DURABILITY_LABELS[durabilityStatus(s.durability)]}
      </span>
      <span class="tag">{T.cargoLabel} {cargoTotal(s)}/{cargoCapacity(s)}</span>
    </div>
  {/each}
</div>

<style>
  .fleet-list { display: flex; flex-direction: column; gap: 0.5rem; }

  .ship-card {
    border: 1px solid #3a2e18;
    border-radius: 4px;
    padding: 0.6rem 0.8rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    background: #201810;
  }
  .ship-card.selected { border-color: #c09040; background: #2a1e0c; }
  .ship-card strong { color: #d4a843; font-size: 0.95rem; }
  .ship-card.member { margin-left: 1rem; }

  .tag { font-size: 0.75rem; color: #8a7a60; }
  .tag.order { color: #d4a843; }
  .tag.durability-seaworthy { color: #8a7a60; }
  .tag.durability-worn { color: #d4b843; }
  .tag.durability-damaged { color: #d48a43; }
  .tag.durability-critical { color: #e06060; font-weight: bold; }

  .convoy-card {
    border: 1px solid #4a3a20;
    border-radius: 4px;
    background: #241c10;
  }
  .convoy-card.selected { border-color: #c09040; }
  .convoy-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.8rem;
    cursor: pointer;
    flex-wrap: wrap;
  }
  .convoy-header strong { color: #f0dca0; }
  .convoy-fold-btn {
    background: none;
    border: none;
    color: #c0a880;
    cursor: pointer;
    padding: 0 0.2rem;
    font-size: 0.9rem;
  }
  .convoy-members { padding: 0 0.6rem 0.6rem; display: flex; flex-direction: column; gap: 0.4rem; }
  .exclude-btn {
    align-self: flex-start;
    font-size: 0.72rem;
    padding: 0.15rem 0.5rem;
    background: #381820;
    border: 1px solid #884040;
    color: #d89090;
    border-radius: 3px;
    cursor: pointer;
  }
  .exclude-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
