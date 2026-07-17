<script lang="ts">
  import type { GameClient } from '../game/client/game-client.ts';
  import type { GameState, TurnResult, Ship, CityId, GoodId } from '../game/state/types.ts';
  import { currentPrice } from '../game/systems/market-system.ts';
  import { isInPort, isInTransit, cargoSpace, cargoTotal } from '../game/systems/fleet-system.ts';
  import { computeNetWorth } from '../game/systems/turn-system.ts';
  import { CITIES } from '../game/data/cities.ts';
  import { GOODS } from '../game/data/goods.ts';
  import { ROUTES } from '../game/data/routes.ts';
  import { SHIP_TYPES, isShipyardCity, repairCost, MAX_SHIPS } from '../game/data/ships.ts';

  export let gameClient: GameClient;

  type Screen = 'new-game' | 'port' | 'turn-summary' | 'game-over';

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

  const GOOD_NAMES: Record<GoodId, string> = {
    salt: 'Salt', grain: 'Grain', timber: 'Timber', furs: 'Furs', herring: 'Herring',
  };

  const SEASON_LABEL: Record<string, string> = {
    spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter',
  };

  const GOOD_IDS = Object.keys(GOODS) as GoodId[];
  const CITY_IDS = Object.keys(CITIES) as CityId[];

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

  async function buyShip() {
    errorMsg = '';
    if (!portCity) return;
    const result = await gameClient.sendAction({ type: 'BUY_SHIP', cityId: portCity });
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
  </main>

{:else if screen === 'port'}
  <main class="screen port-screen">
    <header>
      <span class="title">Hanse</span>
      <span class="hdr-info">{SEASON_LABEL[state.calendar.season]} {state.calendar.year} · Turn {state.calendar.turn}/{state.calendar.maxTurns}</span>
      <span class="hdr-cash">{state.player.cash} Mark · Net {netWorth} Mark</span>
    </header>

    <div class="layout">
      <section class="panel fleet-panel">
        <h2>Fleet ({state.fleet.ships.length}/{MAX_SHIPS})</h2>
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
            <span class="tag">{positionLabel(s)}</span>
            {#if pendingDest[s.id]}
              <span class="tag order">⚓ → {CITIES[pendingDest[s.id]].name}</span>
            {/if}
            <span class="tag">Dur {s.durability}/100</span>
            <span class="tag">Cargo {cargoTotal(s)}/{SHIP_TYPES[s.type].cargoCapacity}</span>
          </div>
        {/each}
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
                  <td>{GOOD_NAMES[goodId]}</td>
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
            <div class="dest-btns">
              {#each reachableCities(activeShip) as dest}
                <button
                  class="dest-btn"
                  class:ordered={pendingDest[selectedShipId] === dest}
                  on:click={() => orderDest(selectedShipId, dest)}
                >{CITIES[dest].name} <span class="dest-turns">({travelTurns(portCity, dest)}t)</span></button>
              {/each}
            </div>
            {#if pendingDest[selectedShipId]}
              <p class="order-note">
                ⚓ Orders: depart for <strong>{CITIES[pendingDest[selectedShipId]].name}</strong>
                ({travelTurns(portCity, pendingDest[selectedShipId])} turn{travelTurns(portCity, pendingDest[selectedShipId]) === 1 ? '' : 's'})
                when you end the turn.
                <button class="link-btn" on:click={() => cancelOrder(selectedShipId)}>cancel</button>
              </p>
            {:else}
              <p class="order-note muted">This ship stays in port until you give sailing orders.</p>
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
              <div class="shipyard-row">
                <span class="shipyard-info">Buy a new Kogge for {SHIP_TYPES.kogge.purchasePrice} Mark.</span>
                <button
                  class="shipyard-btn"
                  on:click={buyShip}
                  disabled={state.fleet.ships.length >= MAX_SHIPS || state.player.cash < SHIP_TYPES.kogge.purchasePrice}
                >Buy Ship</button>
              </div>
              {#if state.fleet.ships.length >= MAX_SHIPS}
                <p class="order-note muted">Fleet is at the maximum of {MAX_SHIPS} ships.</p>
              {/if}
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
                  <td>{GOOD_NAMES[goodId]}</td>
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

    <footer>
      <button class="end-turn-btn" on:click={endTurn} disabled={busyTurn}>
        {busyTurn ? 'Resolving...' : 'End Turn →'}
      </button>
    </footer>
  </main>

{:else if screen === 'turn-summary'}
  <main class="screen center">
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
  .hdr-cash { margin-left: auto; font-size: 0.9rem; color: #c8a840; }

  .layout { display: flex; flex: 1; overflow: hidden; }

  .panel { padding: 1rem 1.2rem; overflow-y: auto; }

  .fleet-panel {
    width: 220px;
    flex-shrink: 0;
    border-right: 1px solid #3a2e18;
    background: #141008;
  }

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
  .events li { padding: 0.3rem 0; border-bottom: 1px solid #2a2018; list-style: none; }
  .events li::before { content: '▸ '; color: #c09040; }

  .net-worth { font-size: 1.1rem; color: #c8a840; }
  .win { color: #70c870; }
  .lose { color: #c86060; }
</style>
