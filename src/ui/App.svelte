<script lang="ts">
  import type { GameClient } from '../game/client/game-client.ts';
  import type { GameState, TurnResult, Ship, CityId, GoodId, ShipType } from '../game/state/types.ts';
  import { currentPrice } from '../game/systems/market-system.ts';
  import { isInPort, isInTransit, cargoSpace, cargoTotal } from '../game/systems/fleet-system.ts';
  import { computeNetWorth } from '../game/systems/turn-system.ts';
  import { CITIES } from '../game/data/cities.ts';
  import { GOODS } from '../game/data/goods.ts';
  import { ROUTES } from '../game/data/routes.ts';
  import {
    SHIP_TYPES,
    isShipyardCity,
    repairCost,
    MAX_SHIPS,
    SHIPYARD_CITIES,
    durabilityStatus,
    durabilityTravelTimePenalty,
    canDepart,
    speedRatio,
  } from '../game/data/ships.ts';
  import { GOOD_ICONS } from './icons.ts';
  import MapView from './MapView.svelte';

  export let gameClient: GameClient;

  type Screen = 'new-game' | 'map' | 'port' | 'turn-summary' | 'game-over';

  let screen: Screen = 'new-game';
  let playerName = '';
  let state: GameState = gameClient.getState();
  let lastSummary: TurnResult['summary'] | null = null;
  let selectedShipId: string = state.fleet.ships[0]?.id ?? '';
  let selectedCityId: CityId = 'lubeck';
  let buyQty = 1;
  let sellQty = 1;
  let busyTurn = false;
  let errorMsg = '';
  let pendingDest: Record<string, CityId> = {};
  let fleetCollapsed = false;
  let showSaveMenu = false;
  let saveMsg = '';
  let showSeasonInfo = false;

  const MARITAL_LABEL: Record<string, string> = {
    single: 'Single', married: 'Married', widowed: 'Widowed',
  };

  const GOOD_NAMES: Record<GoodId, string> = {
    salt: 'Salt', grain: 'Grain', timber: 'Timber', furs: 'Furs', herring: 'Herring',
  };

  const SEASON_LABEL: Record<string, string> = {
    spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter',
  };

  const GOOD_IDS = Object.keys(GOODS) as GoodId[];
  const CITY_IDS = Object.keys(CITIES) as CityId[];
  const SHIP_TYPE_IDS = Object.keys(SHIP_TYPES) as ShipType[];

  // Friendly label for the shipyard cards — speedRatio() itself is a raw
  // multiplier relative to the Kogge (1.5 for Hulk, 0.5 for Schnigge);
  // phrase it the way a player thinks about it ("slower"/"faster").
  function speedLabel(type: ShipType): string {
    const ratio = speedRatio(type);
    if (ratio === 1) return 'standard speed';
    if (ratio > 1) return `${ratio}x slower`;
    return `${Math.round((1 / ratio) * 10) / 10}x faster`;
  }

  async function startGame() {
    const name = playerName.trim() || 'Merchant';
    await gameClient.sendAction({ type: 'NEW_GAME', playerName: name });
    state = gameClient.getState();
    pendingDest = {};
    selectedShipId = state.fleet.ships[0]?.id ?? '';
    const city = shipCity(state.fleet.ships.find(s => s.id === selectedShipId));
    if (city) selectedCityId = city;
    screen = 'port';
  }

  function exportSave() {
    gameClient.exportSave();
    saveMsg = 'Save exported.';
  }

  async function importSaveFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-selecting the same file later
    if (!file) return;
    try {
      state = await gameClient.importSave(file);
      pendingDest = {};
      showSaveMenu = false;
      lastSummary = null;
      selectedShipId = state.fleet.ships[0]?.id ?? '';
      const city = shipCity(shipById(selectedShipId));
      if (city) selectedCityId = city;
      screen = 'port';
      errorMsg = '';
      saveMsg = '';
    } catch {
      saveMsg = 'Could not load that save file.';
    }
  }

  function shipById(id: string): Ship | undefined {
    return state.fleet.ships.find(s => s.id === id);
  }

  function shipCity(ship: Ship | undefined): CityId | undefined {
    if (!ship || !isInPort(ship)) return undefined;
    return ship.position as CityId;
  }

  function transitPos(ship: Ship): { from: CityId; to: CityId; turnsRemaining: number } {
    return ship.position as { from: CityId; to: CityId; turnsRemaining: number };
  }

  async function buy(goodId: GoodId) {
    errorMsg = '';
    const ship = shipById(selectedShipId);
    const city = shipCity(ship);
    if (!city || selectedCityId !== city) return;
    const qty = Number(buyQty);
    if (!qty || qty < 1) return;
    const result = await gameClient.sendAction({ type: 'BUY_GOOD', shipId: selectedShipId, cityId: city, goodId, quantity: qty });
    if ('player' in result) state = result as GameState;
    else errorMsg = 'Cannot buy.';
  }

  async function sell(goodId: GoodId) {
    errorMsg = '';
    const ship = shipById(selectedShipId);
    const city = shipCity(ship);
    if (!city || selectedCityId !== city) return;
    const qty = Number(sellQty);
    if (!qty || qty < 1) return;
    const result = await gameClient.sendAction({ type: 'SELL_GOOD', shipId: selectedShipId, cityId: city, goodId, quantity: qty });
    if ('player' in result) state = result as GameState;
    else errorMsg = 'Cannot sell.';
  }

  async function buyShip(shipType: ShipType) {
    errorMsg = '';
    if (!portCity) return;
    const result = await gameClient.sendAction({ type: 'BUY_SHIP', cityId: portCity, shipType });
    if ('player' in result) state = result as GameState;
    else errorMsg = 'Cannot buy ship.';
  }

  async function repairShip() {
    errorMsg = '';
    if (!activeShip) return;
    const result = await gameClient.sendAction({ type: 'REPAIR_SHIP', shipId: activeShip.id });
    if ('player' in result) state = result as GameState;
    else errorMsg = 'Cannot repair ship.';
  }

  function orderDest(shipId: string, destination: CityId) {
    const ship = shipById(shipId);
    if (!ship || !isInPort(ship)) return;
    if (pendingDest[shipId] === destination) {
      cancelOrder(shipId);
      return;
    }
    pendingDest = { ...pendingDest, [shipId]: destination };
  }

  function cancelOrder(shipId: string) {
    const { [shipId]: _drop, ...rest } = pendingDest;
    void _drop;
    pendingDest = rest;
  }

  function selectCityFromMap(event: CustomEvent<CityId>) {
    selectedCityId = event.detail;
    screen = 'port';
  }

  function selectShipFromMap(event: CustomEvent<string>) {
    selectedShipId = event.detail;
    const city = shipCity(shipById(selectedShipId));
    if (city) selectedCityId = city;
    screen = 'port';
  }

  async function endTurn() {
    if (busyTurn) return;
    busyTurn = true;
    errorMsg = '';
    const result = await gameClient.sendAction({ type: 'END_TURN', orders: { destinations: pendingDest } });
    busyTurn = false;
    if (!('summary' in result)) return;
    const turnResult = result as TurnResult;
    state = turnResult.state;
    lastSummary = turnResult.summary;
    pendingDest = {};
    selectedShipId = state.fleet.ships[0]?.id ?? selectedShipId;
    const city = shipCity(shipById(selectedShipId));
    if (city) selectedCityId = city;
    screen = turnResult.summary.outcome ? 'game-over' : 'turn-summary';
  }

  function continuePlaying() {
    screen = 'port';
    const city = shipCity(shipById(selectedShipId));
    if (city) selectedCityId = city;
  }

  function newGame() {
    screen = 'new-game';
    playerName = '';
    lastSummary = null;
  }

  function positionLabel(ship: Ship): string {
    if (isInPort(ship)) return CITIES[ship.position as CityId].name;
    const pos = transitPos(ship);
    return `${CITIES[pos.from].name} → ${CITIES[pos.to].name} (${pos.turnsRemaining}t)`;
  }

  function reachableCities(ship: Ship): CityId[] {
    if (!isInPort(ship)) return [];
    const here = ship.position as CityId;
    const connected = new Set<CityId>();
    for (const r of ROUTES) {
      if (r.from === here) connected.add(r.to);
      if (r.to === here) connected.add(r.from);
    }
    return [...connected];
  }

  function travelTurns(from: CityId | undefined, to: CityId | undefined): number | undefined {
    if (!from || !to) return undefined;
    const route = ROUTES.find(r => (r.from === from && r.to === to) || (r.from === to && r.to === from));
    return route?.turns;
  }

  // Same as travelTurns, but includes the ship's own type speed ratio and
  // +1 Damaged-durability penalty so the preview matches what
  // setDestination (fleet-system.ts) will actually compute.
  function shipTravelTurns(ship: Ship | undefined, from: CityId | undefined, to: CityId | undefined): number | undefined {
    const base = travelTurns(from, to);
    if (base === undefined || !ship) return base;
    const scaled = Math.max(1, Math.round(base * speedRatio(ship.type)));
    return scaled + durabilityTravelTimePenalty(ship.durability);
  }

  const DURABILITY_LABELS: Record<string, string> = {
    seaworthy: 'Seaworthy',
    worn: 'Worn',
    damaged: 'Damaged',
    critical: 'Critical',
    wrecked: 'Wrecked',
  };

  $: activeShip = state.fleet.ships.find((s) => s.id === selectedShipId);
  $: portCity = activeShip && isInPort(activeShip) ? (activeShip.position as CityId) : undefined;
  $: netWorth = computeNetWorth(state);
  $: cityMarket = state.market[selectedCityId];
  $: atShipyard = portCity !== undefined && isShipyardCity(portCity);
  $: shipRepairCost = activeShip ? repairCost(activeShip) : 0;
</script>

{#if screen === 'new-game'}
  <main class="screen center">
    <h1>Hanse – Die Expedition</h1>
    <p class="subtitle">A Hanseatic trading adventure, 14th century</p>
    <form on:submit|preventDefault={startGame}>
      <label>
        Your name
        <input bind:value={playerName} placeholder="Enter merchant name" autocomplete="off" />
      </label>
      <button type="submit">Begin Trading</button>
    </form>
    <p class="subtext">or</p>
    <label class="import-label centered">
      Load a save file
      <input type="file" accept="application/json,.json" on:change={importSaveFile} />
    </label>
    {#if saveMsg}<p class="save-msg">{saveMsg}</p>{/if}
  </main>

{:else if screen === 'port' || screen === 'map' || screen === 'turn-summary'}
  <main class="screen port-screen">
    <header>
      <span class="title">Hanse</span>
      <span class="hdr-info">
        {SEASON_LABEL[state.calendar.season]} {state.calendar.year} · Turn {state.calendar.turn}/{state.calendar.maxTurns}
        <button
          class="info-btn"
          aria-label="Season order and duration"
          on:click={() => { showSeasonInfo = !showSeasonInfo; }}
        >ⓘ</button>
      </span>
      <span class="hdr-player">{state.player.name} · Age {state.player.age} · {MARITAL_LABEL[state.player.maritalStatus]}</span>
      <div class="nav-toggle">
        <button class="nav-btn" class:active={screen === 'map'} on:click={() => { screen = 'map'; }}>🗺️ Map</button>
        <button class="nav-btn" class:active={screen === 'port'} on:click={() => { screen = 'port'; }}>⚓ Port</button>
        <button class="nav-btn" on:click={() => { showSaveMenu = !showSaveMenu; saveMsg = ''; }}>💾 Save</button>
      </div>
      <span class="hdr-cash">{state.player.cash} Mark · Net {netWorth} Mark</span>
    </header>

    {#if showSeasonInfo}
      <div class="season-info">
        Seasons run in order — <strong>Spring → Summer → Autumn → Winter</strong> — each lasting exactly 1 turn. A new year begins right after Winter. At {state.calendar.maxTurns} turns total, this game runs {state.calendar.maxTurns / 4} years.
        <button class="link-btn" on:click={() => { showSeasonInfo = false; }}>close</button>
      </div>
    {/if}

    {#if showSaveMenu}
      <div class="save-menu">
        <button class="shipyard-btn" on:click={exportSave}>Export Save (.json)</button>
        <label class="import-label">
          Import Save
          <input type="file" accept="application/json,.json" on:change={importSaveFile} />
        </label>
        {#if saveMsg}<span class="save-msg">{saveMsg}</span>{/if}
        <button class="link-btn" on:click={() => { showSaveMenu = false; }}>close</button>
      </div>
    {/if}

    <!-- MapView stays mounted across screen switches instead of being torn
         down by an {#if} — recreating the PixiJS Application (WebGL context,
         shader compilation, font textures) on every Map/Port toggle is what
         made the first-open-after-switch noticeably slow. Only its
         container's visibility toggles now; MapScene.update() still runs
         every time state changes so it stays current even while hidden. -->
    <div class="map-wrap" class:hidden={screen !== 'map'}>
      <MapView
        {state}
        {selectedShipId}
        {selectedCityId}
        visible={screen === 'map'}
        on:selectCity={selectCityFromMap}
        on:selectShip={selectShipFromMap}
      />
    </div>
    {#if screen === 'port'}
    <div class="layout">
      <section class="panel fleet-panel" class:collapsed={fleetCollapsed}>
        <div class="fleet-header">
          {#if !fleetCollapsed}
            <h2>Fleet ({state.fleet.ships.length}/{MAX_SHIPS})</h2>
          {/if}
          <button
            class="fold-btn"
            on:click={() => { fleetCollapsed = !fleetCollapsed; }}
            aria-label={fleetCollapsed ? 'Expand fleet panel' : 'Collapse fleet panel'}
          >{fleetCollapsed ? '▶' : '◀'}</button>
        </div>
        {#if !fleetCollapsed}
          {#each state.fleet.ships as s (s.id)}
            <div
              class="ship-card"
              class:selected={s.id === selectedShipId}
              on:click={() => { selectedShipId = s.id; const c = shipCity(s); if (c) selectedCityId = c; }}
              role="button"
              tabindex="0"
              on:keydown={e => { if (e.key === 'Enter') { selectedShipId = s.id; const c = shipCity(s); if (c) selectedCityId = c; } }}
            >
              <strong>{s.name}</strong>
              <span class="tag">{SHIP_TYPES[s.type].name}</span>
              <span class="tag">{positionLabel(s)}</span>
              {#if pendingDest[s.id]}
                <span class="tag order">⚓ → {CITIES[pendingDest[s.id]].name} ({shipTravelTurns(s, shipCity(s), pendingDest[s.id])}t)</span>
              {/if}
              <span class="tag durability-{durabilityStatus(s.durability)}">
                Dur {s.durability}/100 · {DURABILITY_LABELS[durabilityStatus(s.durability)]}
              </span>
              <span class="tag">Cargo {cargoTotal(s)}/{SHIP_TYPES[s.type].cargoCapacity}</span>
            </div>
          {/each}
        {/if}
      </section>

      <section class="panel trade-panel">
        {#if activeShip && portCity}
          <h2>Port of {CITIES[portCity].name}</h2>

          <div class="city-select">
            {#each CITY_IDS as cId}
              <button
                class="city-btn"
                class:active={selectedCityId === cId}
                on:click={() => { selectedCityId = cId; }}
              >{CITIES[cId].name}</button>
            {/each}
          </div>

          <table class="market-table">
            <thead>
              <tr>
                <th>Good</th>
                <th>Price</th>
                <th>Supply</th>
                <th>In hold</th>
                <th colspan="2">Trade</th>
              </tr>
            </thead>
            <tbody>
              {#each GOOD_IDS as goodId}
                <tr>
                  <td>{GOOD_ICONS[goodId]} {GOOD_NAMES[goodId]}</td>
                  <td>{currentPrice(cityMarket[goodId])} M</td>
                  <td>{cityMarket[goodId].supply}</td>
                  <td>{activeShip.cargo[goodId] ?? 0}</td>
                  <td>
                    {#if selectedCityId === portCity}
                      <button
                        class="trade-btn buy"
                        on:click={() => buy(goodId)}
                        disabled={cargoSpace(activeShip) < buyQty || state.player.cash < currentPrice(cityMarket[goodId]) * buyQty}
                      >Buy {buyQty}</button>
                    {/if}
                  </td>
                  <td>
                    {#if selectedCityId === portCity && (activeShip.cargo[goodId] ?? 0) > 0}
                      <button
                        class="trade-btn sell"
                        on:click={() => sell(goodId)}
                        disabled={(activeShip.cargo[goodId] ?? 0) < sellQty}
                      >Sell {sellQty}</button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>

          <div class="qty-row">
            <label>Buy qty <input type="number" bind:value={buyQty} min="1" max="50" /></label>
            <label>Sell qty <input type="number" bind:value={sellQty} min="1" max="50" /></label>
          </div>

          <div class="dest-section">
            <h3>Set Destination</h3>
            {#if !canDepart(activeShip.durability)}
              <p class="order-note critical">
                ⚠️ {activeShip.name} is critically damaged ({activeShip.durability}/100) and cannot depart.
                Repair it at a shipyard before setting sail.
              </p>
            {:else}
              <div class="dest-btns">
                {#each reachableCities(activeShip) as dest}
                  <button
                    class="dest-btn"
                    class:ordered={pendingDest[selectedShipId] === dest}
                    on:click={() => orderDest(selectedShipId, dest)}
                  >{CITIES[dest].name} <span class="dest-turns">({shipTravelTurns(activeShip, portCity, dest)}t)</span></button>
                {/each}
              </div>
              {#if pendingDest[selectedShipId]}
                <p class="order-note">
                  ⚓ Orders: depart for <strong>{CITIES[pendingDest[selectedShipId]].name}</strong>
                  ({shipTravelTurns(activeShip, portCity, pendingDest[selectedShipId])} turn{shipTravelTurns(activeShip, portCity, pendingDest[selectedShipId]) === 1 ? '' : 's'})
                  when you end the turn.
                  <button class="link-btn" on:click={() => cancelOrder(selectedShipId)}>cancel</button>
                </p>
              {:else}
                <p class="order-note muted">This ship stays in port until you give sailing orders.</p>
              {/if}
            {/if}
          </div>

          {#if atShipyard}
            <div class="shipyard-section">
              <h3>Shipyard</h3>
              <div class="shipyard-row">
                <span class="shipyard-info">
                  {#if activeShip.durability >= 100}
                    {activeShip.name} is fully seaworthy.
                  {:else}
                    Repair {activeShip.name} to full ({activeShip.durability}/100) for {shipRepairCost} Mark.
                  {/if}
                </span>
                <button
                  class="shipyard-btn"
                  on:click={repairShip}
                  disabled={activeShip.durability >= 100 || state.player.cash < shipRepairCost}
                >Repair</button>
              </div>
              <div class="ship-buy-grid">
                {#each SHIP_TYPE_IDS as typeId}
                  {@const def = SHIP_TYPES[typeId]}
                  <div class="ship-buy-card">
                    <strong>{def.name}</strong>
                    <span class="ship-buy-stats">{def.cargoCapacity} last · {def.purchasePrice} Mark · {speedLabel(typeId)}</span>
                    <span class="ship-buy-desc">{def.description}</span>
                    <button
                      class="shipyard-btn"
                      on:click={() => buyShip(typeId)}
                      disabled={state.fleet.ships.length >= MAX_SHIPS || state.player.cash < def.purchasePrice}
                    >Buy {def.name}</button>
                  </div>
                {/each}
              </div>
              {#if state.fleet.ships.length >= MAX_SHIPS}
                <p class="order-note muted">Fleet is at the maximum of {MAX_SHIPS} ships.</p>
              {/if}
            </div>
          {:else}
            <div class="shipyard-section">
              <p class="order-note muted">
                {CITIES[portCity].name} has no shipyard. Repairs and new ships are available in
                {SHIPYARD_CITIES.map(c => CITIES[c].name).join(', ')}.
              </p>
            </div>
          {/if}

        {:else if activeShip && isInTransit(activeShip)}
          <h2>{activeShip.name} is at sea</h2>
          <p>Sailing {CITIES[transitPos(activeShip).from].name} → {CITIES[transitPos(activeShip).to].name} · {transitPos(activeShip).turnsRemaining} turn(s) remaining.</p>
          <p class="subtext">Market prices for reference:</p>

          <div class="city-select">
            {#each CITY_IDS as cId}
              <button class="city-btn" class:active={selectedCityId === cId} on:click={() => { selectedCityId = cId; }}>{CITIES[cId].name}</button>
            {/each}
          </div>

          <table class="market-table">
            <thead><tr><th>Good</th><th>Price in {CITIES[selectedCityId].name}</th><th>Supply</th></tr></thead>
            <tbody>
              {#each GOOD_IDS as goodId}
                <tr>
                  <td>{GOOD_ICONS[goodId]} {GOOD_NAMES[goodId]}</td>
                  <td>{currentPrice(cityMarket[goodId])} M</td>
                  <td>{cityMarket[goodId].supply}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p>No ship selected.</p>
        {/if}

        {#if errorMsg}
          <p class="error">{errorMsg}</p>
        {/if}
      </section>
    </div>
    {/if}

    <footer>
      <button class="end-turn-btn" on:click={endTurn} disabled={busyTurn}>
        {busyTurn ? 'Resolving...' : 'End Turn →'}
      </button>
    </footer>

    <!-- Rendered as an overlay on top of the persistent port/map view rather
         than a separate {#if screen === 'turn-summary'} branch (as it used
         to be) — swapping to a whole separate <main> branch on every single
         End Turn unmounted MapView (and destroyed its MapScene/PixiJS
         Application) each time, which meant the ship-glide animation could
         never actually play across a turn: a brand new MapScene always
         starts markers already at their final position, with no "before"
         state to animate from. See map-view.md "Persistent mount". -->
    {#if screen === 'turn-summary'}
      <div class="turn-summary-overlay">
        <div class="turn-summary-card">
          <h2>Turn {state.calendar.turn - 1} Summary</h2>
          {#if lastSummary && lastSummary.events.length > 0}
            <ul class="events">
              {#each lastSummary.events as evt}
                <li>{evt}</li>
              {/each}
            </ul>
          {:else}
            <p>A quiet turn — nothing unusual happened.</p>
          {/if}
          <p class="net-worth">Net worth: {netWorth} Mark</p>
          <button on:click={continuePlaying}>Continue →</button>
        </div>
      </div>
    {/if}
  </main>

{:else if screen === 'game-over'}
  <main class="screen center">
    {#if lastSummary?.outcome === 'win'}
      <h1 class="win">Victory!</h1>
      <p>You accumulated {netWorth} Mark and secured your family's legacy.</p>
    {:else}
      <h1 class="lose">Bankrupt</h1>
      <p>The trading winds turned against you. Final net worth: {netWorth} Mark.</p>
    {/if}
    <button on:click={newGame}>Play Again</button>
  </main>
{/if}

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body) { background: #1a1610; color: #e8dcc8; font-family: 'Georgia', serif; font-size: 15px; }
  :global(button) { cursor: pointer; }

  .screen { min-height: 100vh; }

  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 2rem;
    text-align: center;
  }

  h1 { font-size: 2.2rem; color: #d4a843; }
  h2 { font-size: 1.4rem; color: #c9a040; margin-bottom: 0.75rem; }
  h3 { font-size: 1rem; margin-bottom: 0.4rem; color: #b89030; }

  .subtitle { color: #9a8060; font-style: italic; }
  .subtext { color: #9a8060; font-size: 0.88rem; margin-bottom: 0.6rem; }

  form { display: flex; flex-direction: column; gap: 1rem; min-width: 260px; }
  label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.9rem; color: #b0a090; }
  input[type="text"], input:not([type]) {
    padding: 0.5rem 0.75rem;
    background: #2a2018;
    border: 1px solid #5a4a30;
    color: #e8dcc8;
    font-size: 1rem;
    border-radius: 3px;
  }
  input[type="number"] {
    width: 60px;
    padding: 0.3rem 0.4rem;
    background: #2a2018;
    border: 1px solid #5a4a30;
    color: #e8dcc8;
    font-size: 0.9rem;
    border-radius: 3px;
  }

  button {
    padding: 0.5rem 1.2rem;
    background: #8a6020;
    border: 1px solid #c09040;
    color: #f0dca0;
    font-size: 0.95rem;
    border-radius: 3px;
    transition: background 0.15s;
  }
  button:hover:not(:disabled) { background: #a07030; }
  button:disabled { opacity: 0.4; cursor: default; }

  .port-screen { display: flex; flex-direction: column; height: 100vh; }

  header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0.6rem 1.2rem;
    background: #110e08;
    border-bottom: 1px solid #3a2e18;
    flex-shrink: 0;
  }
  .title { font-size: 1.1rem; color: #d4a843; font-weight: bold; }
  .hdr-info { font-size: 0.85rem; color: #9a8060; }
  .hdr-player { font-size: 0.85rem; color: #9a8060; }
  .hdr-cash { margin-left: auto; font-size: 0.9rem; color: #c8a840; }

  .info-btn {
    background: none;
    border: none;
    color: #9a8060;
    padding: 0 0.2rem;
    font-size: 0.85rem;
    line-height: 1;
  }
  .info-btn:hover { background: none; color: #d4a843; }

  .season-info {
    padding: 0.6rem 1.2rem;
    background: #1c1508;
    border-bottom: 1px solid #3a2e18;
    font-size: 0.85rem;
    color: #c0a880;
  }
  .season-info strong { color: #f0dca0; }

  .nav-toggle { display: flex; gap: 0.3rem; }
  .nav-btn {
    padding: 0.25rem 0.6rem;
    font-size: 0.8rem;
    background: #201810;
    border-color: #4a3a20;
    color: #c0a880;
  }
  .nav-btn.active { background: #3a2810; border-color: #c09040; color: #f0dca0; }

  .layout { display: flex; flex: 1; overflow: hidden; }

  .map-wrap { flex: 1; overflow: hidden; background: #0d1b2a; }
  .map-wrap.hidden { display: none; }

  .panel { padding: 1rem 1.2rem; overflow-y: auto; }

  .fleet-panel {
    width: 220px;
    flex-shrink: 0;
    border-right: 1px solid #3a2e18;
    background: #141008;
    transition: width 0.18s ease;
  }
  .fleet-panel.collapsed {
    width: 40px;
    padding: 1rem 0.4rem;
    overflow: hidden;
  }

  .fleet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .fleet-header h2 { margin-bottom: 0; }
  .fold-btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    background: #201810;
    border-color: #4a3a20;
    color: #c0a880;
    flex-shrink: 0;
  }
  .fleet-panel.collapsed .fold-btn { margin: 0 auto; }

  .trade-panel { flex: 1; background: #1a1610; }

  .ship-card {
    border: 1px solid #3a2e18;
    border-radius: 4px;
    padding: 0.6rem 0.8rem;
    margin-bottom: 0.6rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    background: #201810;
  }
  .ship-card.selected { border-color: #c09040; background: #2a1e0c; }
  .ship-card strong { color: #d4a843; font-size: 0.95rem; }
  .tag { font-size: 0.75rem; color: #8a7a60; }
  .tag.order { color: #d4a843; }
  .tag.durability-seaworthy { color: #8a7a60; }
  .tag.durability-worn { color: #d4b843; }
  .tag.durability-damaged { color: #d48a43; }
  .tag.durability-critical { color: #e06060; font-weight: bold; }

  .city-select { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.8rem; }
  .city-btn {
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
    background: #201810;
    border-color: #4a3a20;
    color: #c0a880;
  }
  .city-btn.active { background: #3a2810; border-color: #c09040; color: #f0dca0; }

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

  .qty-row {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 1rem;
    font-size: 0.85rem;
    color: #9a8a70;
  }
  .qty-row label { flex-direction: row; align-items: center; gap: 0.5rem; }

  .dest-section { margin-top: 1rem; }
  .dest-btns { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .dest-btn { font-size: 0.82rem; padding: 0.3rem 0.8rem; }
  .dest-turns { font-size: 0.72rem; color: #9a8060; }
  .dest-btn.ordered .dest-turns { color: #d4c090; }
  .dest-btn.ordered { background: #3a2810; border-color: #d4a843; color: #f0dca0; }

  .order-note { margin-top: 0.7rem; font-size: 0.85rem; color: #c8a840; }
  .order-note.muted { color: #7a6a50; font-style: italic; }
  .order-note.critical { color: #e06060; font-weight: bold; }
  .order-note strong { color: #f0dca0; }
  .link-btn {
    background: none;
    border: none;
    color: #b08a50;
    text-decoration: underline;
    padding: 0 0.2rem;
    font-size: 0.85rem;
  }
  .link-btn:hover { background: none; color: #d4a843; }

  .save-menu {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.8rem;
    padding: 0.6rem 1.2rem;
    background: #1c1508;
    border-bottom: 1px solid #3a2e18;
    font-size: 0.85rem;
  }
  .import-label {
    display: inline-flex;
    flex-direction: row !important;
    align-items: center;
    gap: 0.5rem;
    color: #c0a880;
    cursor: pointer;
  }
  .import-label.centered { justify-content: center; }
  .import-label input[type="file"] {
    font-size: 0.78rem;
    color: #c0a880;
    max-width: 220px;
  }
  .save-msg { color: #d4a843; font-size: 0.82rem; }

  .shipyard-section {
    margin-top: 1.2rem;
    padding-top: 1rem;
    border-top: 1px solid #3a2e18;
  }
  .shipyard-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
  }
  .shipyard-info { color: #b0a090; }
  .shipyard-btn {
    padding: 0.3rem 0.9rem;
    font-size: 0.82rem;
    background: #2a2810;
    border-color: #8a7830;
    color: #e0d090;
    flex-shrink: 0;
  }
  .shipyard-btn:hover:not(:disabled) { background: #3a3810; }

  .ship-buy-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.7rem;
    margin-top: 0.4rem;
  }
  .ship-buy-card {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.6rem 0.7rem;
    border: 1px solid #3a2e18;
    border-radius: 4px;
    background: #1c1508;
  }
  .ship-buy-card strong { color: #d4a843; font-size: 0.9rem; }
  .ship-buy-stats { font-size: 0.75rem; color: #9a8a70; }
  .ship-buy-desc { font-size: 0.72rem; color: #7a6a50; flex: 1; }
  .ship-buy-card .shipyard-btn { align-self: stretch; text-align: center; }

  footer {
    padding: 0.8rem 1.2rem;
    border-top: 1px solid #3a2e18;
    background: #110e08;
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
  }

  .end-turn-btn {
    padding: 0.6rem 1.8rem;
    font-size: 1rem;
    background: #5a3010;
    border-color: #d4a843;
    color: #f0dca0;
  }
  .end-turn-btn:hover:not(:disabled) { background: #7a4820; }

  .error { color: #e06060; font-size: 0.85rem; margin-top: 0.5rem; }

  .events { text-align: left; max-width: 480px; }
  .events li { padding: 0.4rem 0; border-bottom: 1px solid #2a2018; list-style: none; }

  .turn-summary-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(10, 8, 4, 0.82);
    z-index: 20;
  }
  .turn-summary-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding: 2rem;
    text-align: center;
    background: #1a1408;
    border: 1px solid #4a3a20;
    border-radius: 6px;
    max-width: 520px;
  }

  .net-worth { font-size: 1.1rem; color: #c8a840; }
  .win { color: #70c870; }
  .lose { color: #c86060; }

  /* Mobile: below this width the two-column port layout (fixed-width
     fleet sidebar + trade panel) squeezes the trade panel too narrow for
     its 6-column market table -- the Buy/Sell columns become inaccessible.
     Stack the panels instead, and let the fold button collapse the fleet
     panel's height rather than its width once it's already full-width. */
  @media (max-width: 700px) {
    header {
      flex-wrap: wrap;
      row-gap: 0.35rem;
      padding: 0.5rem 0.8rem;
    }
    .hdr-info { flex-basis: 100%; order: 3; font-size: 0.8rem; }
    .hdr-player { flex-basis: 100%; order: 4; font-size: 0.8rem; }
    .hdr-cash { flex-basis: 100%; order: 5; margin-left: 0; font-size: 0.85rem; }
    .nav-toggle { order: 2; margin-left: auto; }

    .layout { flex-direction: column; overflow-y: auto; }

    .fleet-panel {
      width: 100% !important;
      max-height: 190px;
      overflow-y: auto;
      border-right: none;
      border-bottom: 1px solid #3a2e18;
    }
    .fleet-panel.collapsed {
      max-height: 44px;
      padding: 0.5rem 0.8rem;
    }
    .fleet-panel.collapsed .fold-btn { margin: 0 0 0 auto; }

    .qty-row { flex-wrap: wrap; row-gap: 0.5rem; }

    /* Slightly larger touch targets. */
    .trade-btn, .dest-btn, .city-btn, .shipyard-btn { padding: 0.45rem 0.7rem; }
  }
</style>
