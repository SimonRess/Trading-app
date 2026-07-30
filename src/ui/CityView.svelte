<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import type { CityId } from '../game/state/types.ts';
  import { CityScene, type BuildingId } from '../render/city-scene.ts';

  export let cityId: CityId;
  export let labels: Record<BuildingId, string>;

  const dispatch = createEventDispatcher<{ selectBuilding: BuildingId }>();

  let container: HTMLDivElement;
  let scene: CityScene | undefined;
  let ready = false;

  onMount(() => {
    scene = new CityScene({
      onBuildingClick: (buildingId) => dispatch('selectBuilding', buildingId),
    });
    scene.mount(container).then(() => {
      ready = true;
      scene?.setLabels(labels);
      scene?.showCity(cityId);
    });
  });

  onDestroy(() => {
    scene?.destroy();
  });

  $: if (ready && scene) {
    scene.showCity(cityId);
  }
  $: if (ready && scene) {
    scene.setLabels(labels);
  }
</script>

<div class="city-container" bind:this={container}></div>

<style>
  .city-container {
    width: 100%;
    height: 100%;
    min-height: 320px;
  }
</style>
