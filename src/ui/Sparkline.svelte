<script lang="ts">
  // Presentational only — takes a plain number array (already-tracked price
  // history) and draws a small inline SVG trend line. No state of its own,
  // no game-logic imports; App.svelte owns the history buffer (see its
  // recordPriceHistory) since "how many turns to remember" is a UI-layer
  // decision, not something GameState needs to know about.
  export let values: number[];
  export let width = 60;
  export let height = 18;

  $: min = values.length ? Math.min(...values) : 0;
  $: max = values.length ? Math.max(...values) : 0;
  // Flat history (min === max, including a single-point history) would
  // divide by zero — draw a flat mid-line instead of NaN-ing the path.
  $: range = max - min || 1;
  $: points = values
    .map((v, i) => {
      const x = values.length > 1 ? (i / (values.length - 1)) * width : width / 2;
      const y = height - ((v - min) / range) * height;
      return `${String(x)},${String(y)}`;
    })
    .join(' ');
</script>

{#if values.length > 1}
  <svg {width} {height} viewBox="0 0 {width} {height}" class="sparkline">
    <polyline {points} fill="none" stroke="#d4a843" stroke-width="1.5" />
  </svg>
{:else}
  <span class="sparkline-empty">—</span>
{/if}

<style>
  .sparkline { display: block; overflow: visible; }
  .sparkline-empty { color: #6a5a44; font-size: 0.8rem; }
</style>
