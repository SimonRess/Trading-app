<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import type { GameState, CityId } from '../game/state/types.ts';
  import { MapScene } from '../render/map-scene.ts';

  export let state: GameState;
  export let selectedShipId: string;
  export let selectedCityId: CityId | undefined;

  const dispatch = createEventDispatcher<{ selectCity: CityId; selectShip: string }>();

  let container: HTMLDivElement;
  let scene: MapScene | undefined;
  let ready = false;

  onMount(() => {
    scene = new MapScene({
      onCityClick: (cityId) => dispatch('selectCity', cityId),
      onShipClick: (shipId) => dispatch('selectShip', shipId),
    });
    scene.mount(container).then(() => {
      ready = true;
      scene?.update(state, { selectedShipId, selectedCityId });
    });
  });

  onDestroy(() => {
    scene?.destroy();
  });

  $: if (ready && scene) {
    scene.update(state, { selectedShipId, selectedCityId });
  }
</script>

<div class="map-container" bind:this={container}></div>

<style>
  .map-container {
    width: 100%;
    height: 100%;
    min-height: 320px;
  }
</style>
