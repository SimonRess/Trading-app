<script lang="ts">
  import type { GameClient } from '../game/client/game-client.ts';

  export let gameClient: GameClient;

  const state = gameClient.getState();
</script>

<main>
  <h1>Hanse – Die Expedition</h1>
  <p>Welcome, {state.player.name}.</p>
  <p>Season: {state.calendar.season} {state.calendar.year} — Turn {state.calendar.turn} / {state.calendar.maxTurns}</p>
  <p>Cash: {state.player.cash} Mark</p>
</main>

<style>
  main {
    font-family: serif;
    padding: 2rem;
  }
</style>
