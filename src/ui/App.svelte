<script lang="ts">
  import type { GameClient } from '../game/client/game-client.ts';
  import type { GameState, TurnResult, Ship, CityId, GoodId, ShipType } from '../game/state/types.ts';
  import { resolveTradeStepped, currentPrice } from '../game/systems/market-system.ts';
  import { isInPort, isInTransit, cargoTotal, cargoCapacity } from '../game/systems/fleet-system.ts';
  import { computeNetWorth } from '../game/systems/turn-system.ts';
  import { DONATION_COST_PER_PERCENT, REPUTATION_COST_PER_POINT, MAX_MARK_PER_TURN, PROGRESS_CAP_PER_TURN } from '../game/systems/church-system.ts';
  import { RANK_THRESHOLDS } from '../game/systems/political-system.ts';
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
    CREW_MAX,
    CREW_HIRE_COST,
    WAGE_PER_SAILOR_PER_TURN,
    isUndercrewed,
    CANNON_MAX,
    CANNON_PRICE,
    cannonSellValue,
    auctionSaleValue,
  } from '../game/data/ships.ts';
  import { LOAN_CAP, LOAN_INTEREST_RATE } from '../game/systems/banking-system.ts';
  import { INSURANCE_PREMIUM_PER_TURN, INSURANCE_PAYOUT_RATE } from '../game/systems/insurance-system.ts';
  import {
    WAREHOUSE_PRICE,
    WAREHOUSE_INCOME_PER_TURN,
    MAX_WAREHOUSES_PER_CITY,
    warehouseSellValue,
  } from '../game/systems/warehouse-system.ts';
  import { PARTNER_TYPES, MIN_MARRIAGE_AGE, HIRE_TUTOR_COST, HEIR_MIN_AGE } from '../game/data/family.ts';
  import { traitPurchasePriceFactor } from '../game/systems/family-system.ts';
  import { GOOD_ICONS } from './icons.ts';
  import MapView from './MapView.svelte';
  import CityView from './CityView.svelte';
  import TradeTable from './TradeTable.svelte';
  import Sparkline from './Sparkline.svelte';
  import type { BuildingId } from '../render/city-scene.ts';
  import pkg from '../../package.json';
  import CHANGELOG_RAW from '../../CHANGELOG.md?raw';
  import { renderMarkdown } from './markdown.ts';
  import { locale, TRANSLATIONS, speedLabel as localizedSpeedLabel } from './i18n.ts';

  export let gameClient: GameClient;
  const APP_VERSION = pkg.version;
  const CHANGELOG_HTML = renderMarkdown(CHANGELOG_RAW);
  $: T = TRANSLATIONS[$locale];

  type Screen = 'new-game' | 'map' | 'port' | 'city' | 'turn-summary' | 'game-over';

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
  let showChangelog = false;
  let showSettings = false;
  let selectedBuilding: BuildingId | undefined;
  let donationAmount = 100;
  let loanAmount = 500;
  let repayAmount = 100;
  let renameDrafts: Record<string, string> = {};
  let auctionResult: { shipName: string; price: number; date: string } | null = null;

  // Step 1 of the city-view rollout (ADR-018, docs/design/city-view.md):
  // building clicks just show a placeholder label for now — no building is
  // wired to real logic yet.
  //
  // These dictionaries are reactive on T (locale) rather than static consts
  // — every existing template usage below (BUILDING_LABELS[...],
  // SEASON_LABEL[...], etc.) picks up the current language automatically,
  // with no further changes needed at each call site.
  $: BUILDING_LABELS = T.building;

  function selectBuilding(event: CustomEvent<BuildingId>): void {
    selectedBuilding = event.detail;
  }

  $: MARITAL_LABEL = T.marital;
  $: GOOD_NAMES = T.good;
  $: SEASON_LABEL = T.season;
  $: RANK_LABELS = T.rank;
  $: TRAIT_LABELS = T.trait;
  $: ACHIEVEMENT_LABELS = T.achievement;

  const GOOD_IDS = Object.keys(GOODS) as GoodId[];
  const CITY_IDS = Object.keys(CITIES) as CityId[];
  const SHIP_TYPE_IDS = Object.keys(SHIP_TYPES) as ShipType[];

  // Price-history sparkline (feature-brainstorm.md #3): client-side only,
  // remembers the last PRICE_HISTORY_LENGTH turns' prices per city/good in
  // the UI layer. Deliberately not GameState — "how many turns to
  // remember for a UI trend graph" isn't something save files or game
  // logic need to know about, and keeping it here avoids a schema bump for
  // a display-only concern. Recorded once per resolved turn (guarded by
  // lastHistoryTurn), not on every reactive re-render, since state also
  // changes on every buy/sell/etc — recording those too would make the
  // "last N turns" window actually cover far fewer real turns.
  const PRICE_HISTORY_LENGTH = 10;
  // Rebuilt with fresh array/object references on every recorded turn
  // (never mutated in place) and reassigned via `priceHistory = ...` below
  // — this project has twice been bitten by Svelte not noticing in-place
  // mutation of a value referenced elsewhere in the template (the
  // bulk-price and City-view label-overlap bugs, both in git history), so
  // this follows the same immutable-update discipline CLAUDE.md requires
  // for GameState, even though price history itself is UI-local.
  let priceHistory: Record<CityId, Record<GoodId, number[]>> = Object.fromEntries(
    CITY_IDS.map(cityId => [cityId, Object.fromEntries(GOOD_IDS.map(goodId => [goodId, [] as number[]]))]),
  ) as Record<CityId, Record<GoodId, number[]>>;
  let lastHistoryTurn = 0;
  $: if (state.calendar.turn !== lastHistoryTurn) {
    lastHistoryTurn = state.calendar.turn;
    priceHistory = Object.fromEntries(
      CITY_IDS.map(cityId => [
        cityId,
        Object.fromEntries(
          GOOD_IDS.map(goodId => {
            const next = [...priceHistory[cityId][goodId], currentPrice(state.market[cityId][goodId])];
            return [goodId, next.length > PRICE_HISTORY_LENGTH ? next.slice(-PRICE_HISTORY_LENGTH) : next];
          }),
        ),
      ]),
    ) as Record<CityId, Record<GoodId, number[]>>;
  }

  const POSTURE_IDS: Ship['posture'][] = ['aggressive', 'defensive', 'flee'];
  $: POSTURE_LABELS = T.posture;
  $: POSTURE_DESCRIPTIONS = T.postureDescription;

  // Bulk orders move the price against the trader as they fill (see
  // resolveTradeStepped, market-system.ts) — these compute the same
  // preview client-side, against the current market, so the Buy/Sell
  // buttons can show the real total/avg-per-unit cost before committing,
  // not just today's single-unit spot price.
  //
  // gameState is taken as an explicit parameter (rather than closing over
  // the outer `state` var, as an earlier version did) so that every call
  // site is forced to reference `state` directly in its own template
  // expression. Svelte's per-node dirty-check for a bare `{@const}` value's
  // *own* interpolations (e.g. a lone `{preview.totalCost}` with nothing
  // else in that mustache) is derived only from identifiers textually
  // present in the `{@const}` declaration itself — it cannot see reads
  // inside a called function's body. Without `state` visibly referenced
  // there, Svelte only re-writes the button text when `buyQty` changes,
  // not when a purchase changes `state.market` — so the price silently
  // went stale after every buy/sell while the button's `title` and
  // `disabled` attributes (which separately reference `state`/`cityMarket`
  // directly) kept updating correctly. Same root cause as the `activeShip`
  // reactivity bug fixed earlier in this file — see git history.
  function buyPreview(gameState: GameState, cityId: CityId, goodId: GoodId, qty: number) {
    return resolveTradeStepped(gameState.market[cityId][goodId], qty, 1, traitPurchasePriceFactor(gameState.player.traits));
  }
  function sellPreview(gameState: GameState, cityId: CityId, goodId: GoodId, qty: number) {
    return resolveTradeStepped(gameState.market[cityId][goodId], qty, -1);
  }

  // Friendly label for the shipyard cards — speedRatio() itself is a raw
  // multiplier relative to the Kogge (1.5 for Hulk, 0.5 for Schnigge);
  // phrase it the way a player thinks about it ("slower"/"faster").
  function speedLabel(type: ShipType): string {
    return localizedSpeedLabel[$locale](speedRatio(type));
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
    saveMsg = T.saveExported;
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
      saveMsg = T.err.saveFile;
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
    else errorMsg = T.err.buy;
  }

  async function sell(goodId: GoodId, qtyOverride?: number) {
    errorMsg = '';
    const ship = shipById(selectedShipId);
    const city = shipCity(ship);
    if (!city || selectedCityId !== city) return;
    const qty = qtyOverride ?? Number(sellQty);
    if (!qty || qty < 1) return;
    const result = await gameClient.sendAction({ type: 'SELL_GOOD', shipId: selectedShipId, cityId: city, goodId, quantity: qty });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.sell;
  }

  function sellAll(goodId: GoodId): void {
    const ship = shipById(selectedShipId);
    const held = ship?.cargo[goodId] ?? 0;
    if (held > 0) void sell(goodId, held);
  }

  async function buyShip(shipType: ShipType) {
    errorMsg = '';
    if (!portCity) return;
    const result = await gameClient.sendAction({ type: 'BUY_SHIP', cityId: portCity, shipType });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.buyShip;
  }

  async function repairShip(shipId: string) {
    errorMsg = '';
    const result = await gameClient.sendAction({ type: 'REPAIR_SHIP', shipId });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.repairShip;
  }

  // No real waiting period is simulated yet — the auction resolves the
  // moment it's created, so the price shown here (computed from state
  // before dispatch) is exactly what the ship sells for. See
  // docs/design/ship-stats.md "Auctioning Ships".
  async function auctionShip(shipId: string) {
    errorMsg = '';
    const ship = state.fleet.ships.find(s => s.id === shipId);
    if (!ship) return;
    const price = auctionSaleValue(SHIP_TYPES[ship.type].purchasePrice, ship.durability);
    const date = `${SEASON_LABEL[state.calendar.season]} ${state.calendar.year}`;
    const result = await gameClient.sendAction({ type: 'AUCTION_SHIP', shipId });
    if ('player' in result) {
      state = result as GameState;
      auctionResult = { shipName: ship.name, price, date };
    } else {
      errorMsg = T.err.auctionShip;
    }
  }

  async function setPosture(shipId: string, posture: Ship['posture']) {
    errorMsg = '';
    const result = await gameClient.sendAction({ type: 'SET_POSTURE', shipId, posture });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.setPosture;
  }

  function setRenameDraft(shipId: string, value: string) {
    renameDrafts = { ...renameDrafts, [shipId]: value };
  }

  function handleRenameInput(event: Event, shipId: string) {
    const target = event.currentTarget as HTMLInputElement;
    setRenameDraft(shipId, target.value);
  }

  async function renameShip(shipId: string) {
    errorMsg = '';
    const name = (renameDrafts[shipId] ?? '').trim();
    if (!name) return;
    const result = await gameClient.sendAction({ type: 'RENAME_SHIP', shipId, name });
    if ('player' in result) {
      state = result as GameState;
      const { [shipId]: _drop, ...rest } = renameDrafts;
      void _drop;
      renameDrafts = rest;
    } else {
      errorMsg = T.err.renameShip;
    }
  }

  async function hireCrew(shipId: string) {
    errorMsg = '';
    const result = await gameClient.sendAction({ type: 'HIRE_CREW', shipId });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.hireCrew;
  }

  async function releaseCrew(shipId: string) {
    errorMsg = '';
    const result = await gameClient.sendAction({ type: 'RELEASE_CREW', shipId });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.releaseCrew;
  }

  async function buyCannon(shipId: string) {
    errorMsg = '';
    const result = await gameClient.sendAction({ type: 'BUY_CANNON', shipId });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.buyCannon;
  }

  async function sellCannon(shipId: string) {
    errorMsg = '';
    const result = await gameClient.sendAction({ type: 'SELL_CANNON', shipId });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.sellCannon;
  }

  async function toggleInsurance(shipId: string) {
    errorMsg = '';
    const result = await gameClient.sendAction({ type: 'TOGGLE_INSURANCE', shipId });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.insurance;
  }

  async function buyWarehouse(cityId: CityId) {
    errorMsg = '';
    const result = await gameClient.sendAction({ type: 'BUY_WAREHOUSE', cityId });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.buyWarehouse;
  }

  async function sellWarehouse(cityId: CityId) {
    errorMsg = '';
    const result = await gameClient.sendAction({ type: 'SELL_WAREHOUSE', cityId });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.sellWarehouse;
  }

  async function seekMarriage() {
    errorMsg = '';
    const result = await gameClient.sendAction({ type: 'SEEK_MARRIAGE' });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.marriage;
  }

  async function chooseHeir(childId: string) {
    errorMsg = '';
    const result = await gameClient.sendAction({ type: 'CHOOSE_HEIR', childId });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.heir;
  }

  async function hireTutor(childId: string) {
    errorMsg = '';
    const result = await gameClient.sendAction({ type: 'HIRE_TUTOR', childId });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.tutor;
  }

  async function takeLoan() {
    errorMsg = '';
    const amount = Number(loanAmount);
    if (!amount || amount < 1) return;
    const result = await gameClient.sendAction({ type: 'TAKE_LOAN', amount });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.loan;
  }

  async function repayLoan() {
    errorMsg = '';
    const amount = Number(repayAmount);
    if (!amount || amount < 1) return;
    const result = await gameClient.sendAction({ type: 'REPAY_LOAN', amount });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.repay;
  }

  async function donateToChurch(cityId: CityId) {
    errorMsg = '';
    const amount = Number(donationAmount);
    if (!amount || amount < 1) return;
    // Pledged Mark converts to completion gradually (at most 1%/turn) during
    // turn resolution, not instantly — see church-system.ts's
    // advanceChurchProgress and resolveTurn's own turn-summary event for
    // when a church actually finishes.
    const result = await gameClient.sendAction({ type: 'DONATE_CHURCH', cityId, amount });
    if ('player' in result) state = result as GameState;
    else errorMsg = T.err.donate;
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
    // Winning no longer ends the session (the player can keep playing), so
    // it's surfaced through the same persistent turn-summary overlay as a
    // normal turn — only losing (bankruptcy, out of turns) is an actual
    // session-ending 'game-over' screen. A pending multi-heir choice has
    // its own dedicated overlay (rendered whenever state.pendingSuccession
    // is set, regardless of screen), so skip the normal turn-summary here
    // to avoid stacking two overlays.
    if (state.pendingSuccession) {
      screen = 'port';
    } else {
      screen = turnResult.summary.outcome === 'lose' ? 'game-over' : 'turn-summary';
    }
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

  $: DURABILITY_LABELS = T.durability;

  $: activeShip = state.fleet.ships.find((s) => s.id === selectedShipId);
  $: portCity = activeShip && isInPort(activeShip) ? (activeShip.position as CityId) : undefined;
  $: netWorth = computeNetWorth(state);
  $: cityMarket = state.market[selectedCityId];
  $: atShipyard = portCity !== undefined && isShipyardCity(portCity);
  // All of the player's ships docked at this shipyard city, not just the
  // currently selected one — repair/crew are per-ship, and a player with
  // multiple ships in the same port should be able to manage each without
  // switching selection first (reported by a player as "I only see one
  // ship in the repair and crew list" after buying a second ship).
  $: shipyardShips = portCity === undefined ? [] : state.fleet.ships.filter(s => isInPort(s) && s.position === portCity);
</script>

{#if screen === 'new-game'}
  <main class="screen center">
    <h1>Hanse – Die Expedition</h1>
    <p class="subtitle">{T.newGameSubtitle}</p>
    <form on:submit|preventDefault={startGame}>
      <label>
        {T.yourName}
        <input bind:value={playerName} placeholder={T.namePlaceholder} autocomplete="off" />
      </label>
      <button type="submit">{T.beginTrading}</button>
    </form>
    <p class="subtext">{T.orWord}</p>
    <label class="import-label centered">
      {T.loadSaveFile}
      <input type="file" accept="application/json,.json" on:change={importSaveFile} />
    </label>
    {#if saveMsg}<p class="save-msg">{saveMsg}</p>{/if}
  </main>

{:else if screen === 'port' || screen === 'map' || screen === 'city' || screen === 'turn-summary'}
  <main class="screen port-screen">
    <header>
      <span class="title">{T.appTitle}</span>
      <button
        class="version-btn"
        aria-label={T.versionAndChangelog}
        on:click={() => { showChangelog = !showChangelog; }}
      >v{APP_VERSION} ⓘ</button>
      <span class="hdr-info">
        {SEASON_LABEL[state.calendar.season]} {state.calendar.year} · {T.turnLabel} {state.calendar.turn}
        <button
          class="info-btn"
          aria-label={T.seasonInfoLabel}
          on:click={() => { showSeasonInfo = !showSeasonInfo; }}
        >ⓘ</button>
      </span>
      <span class="hdr-player">{state.player.name} · {T.age} {state.player.age} · {T.health} {Math.round(state.player.health)} · {MARITAL_LABEL[state.player.maritalStatus]} · {RANK_LABELS[state.player.politicalRank]}</span>
      <div class="nav-toggle">
        <button class="nav-btn" class:active={screen === 'map'} on:click={() => { screen = 'map'; }}>{T.navMap}</button>
        <button class="nav-btn" class:active={screen === 'port'} on:click={() => { screen = 'port'; }}>{T.navPort}</button>
        <button class="nav-btn" class:active={screen === 'city'} on:click={() => { screen = 'city'; }}>{T.navCity}</button>
        <button class="nav-btn" on:click={() => { showSaveMenu = !showSaveMenu; saveMsg = ''; }}>{T.navSave}</button>
        <button class="nav-btn" on:click={() => { showSettings = !showSettings; }}>{T.navSettings}</button>
      </div>
      <span class="hdr-cash">{state.player.cash} Mark · {T.netLabel} {netWorth} Mark</span>
    </header>

    {#if showSettings}
      <div class="save-menu">
        <span class="shipyard-info">{T.settingsLanguage}:</span>
        <div class="posture-btns">
          <button class="nav-btn" class:active={$locale === 'en'} on:click={() => { locale.set('en'); }}>{T.settingsLanguageEnglish}</button>
          <button class="nav-btn" class:active={$locale === 'de'} on:click={() => { locale.set('de'); }}>{T.settingsLanguageGerman}</button>
        </div>
        <button class="link-btn" on:click={() => { showSettings = false; }}>{T.close.toLowerCase()}</button>
      </div>
    {/if}

    {#if showSeasonInfo}
      <div class="season-info">
        {T.seasonInfoText}
        <button class="link-btn" on:click={() => { showSeasonInfo = false; }}>{T.close.toLowerCase()}</button>
      </div>
    {/if}

    {#if showChangelog}
      <div class="save-menu changelog-panel">
        <div class="changelog-text">{@html CHANGELOG_HTML}</div>
        <button class="link-btn" on:click={() => { showChangelog = false; }}>{T.close.toLowerCase()}</button>
      </div>
    {/if}

    {#if showSaveMenu}
      <div class="save-menu">
        <button class="shipyard-btn" on:click={exportSave}>{T.exportSave}</button>
        <label class="import-label">
          {T.importSave}
          <input type="file" accept="application/json,.json" on:change={importSaveFile} />
        </label>
        {#if saveMsg}<span class="save-msg">{saveMsg}</span>{/if}
        <button class="link-btn" on:click={() => { showSaveMenu = false; }}>{T.close.toLowerCase()}</button>
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
        legendLabels={[T.legendCalm, T.legendDangerous, T.legendShipEnRoute]}
        on:selectCity={selectCityFromMap}
        on:selectShip={selectShipFromMap}
      />
    </div>

    <!-- Same persistent-mount reasoning as MapView above (ADR-017) — the
         city view will grow its own nested scenes (docs/design/city-view.md
         "Scene Navigation Model"), so recreating its Application on every
         Port/City toggle would be even more costly to undo later than the
         Map's was. -->
    <div class="map-wrap" class:hidden={screen !== 'city'}>
      <CityView cityId={selectedCityId} labels={BUILDING_LABELS} on:selectBuilding={selectBuilding} />
    </div>

    <!-- Harbor and Trading Post (ADR-018 rollout step 2): the same fleet/
         destination and buy/sell markup and functions already used by the
         List View port screen below, just reached through the City view
         instead — pure UI migration, no new game logic. The remaining
         buildings still show the "Coming soon" placeholder from step 1. -->
    {#if screen === 'city' && selectedBuilding}
      <div class="turn-summary-overlay">
        <div class="turn-summary-card building-panel">
          {#if selectedBuilding === 'harbor'}
            <h2>{T.harbor}</h2>
            <div class="fleet-list">
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
                    {T.durLabel} {s.durability}/100 · {DURABILITY_LABELS[durabilityStatus(s.durability)]}
                  </span>
                  <span class="tag">{T.cargoLabel} {cargoTotal(s)}/{cargoCapacity(s)}{s.cannons > 0 ? T.cargoUsedByCannons(s.cannons * 2) : ''}</span>
                </div>
              {/each}
            </div>

            {#if activeShip && portCity}
              <div class="dest-section">
                <h3>{T.setDestination}</h3>
                {#if !canDepart(activeShip.durability)}
                  <p class="order-note critical">
                    {T.criticalDamageNote(activeShip.name, activeShip.durability)}
                  </p>
                  {#if !isShipyardCity(portCity)}
                    <!-- A critical/wrecked ship can't depart (canDepart) and
                         can't be repaired away from a shipyard city
                         (executeRepairShip) — without this, it would be
                         permanently stranded with no available action at
                         all. Auctioning was already implemented to work
                         from any port (executeAuctionShip's own comment
                         says so), but the only UI entry point was buried
                         inside the Shipyard building panel, which doesn't
                         even exist at a non-shipyard city. Surfacing it
                         here, specifically for this stuck case, closes
                         that soft-lock without changing canDepart or
                         executeRepairShip's shipyard restriction, both of
                         which are deliberate (ship-stats.md). -->
                    <p class="order-note muted">
                      {T.auctionLine(auctionSaleValue(SHIP_TYPES[activeShip.type].purchasePrice, activeShip.durability), SHIP_TYPES[activeShip.type].purchasePrice, activeShip.durability)}
                    </p>
                    <button class="shipyard-btn" on:click={() => auctionShip(activeShip.id)}>{T.auction}</button>
                  {/if}
                {:else if activeShip.repairCooldown > 0}
                  <p class="order-note critical">
                    {T.repairCooldownNote(activeShip.name)}
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
                      {T.ordersDepart} <strong>{CITIES[pendingDest[selectedShipId]].name}</strong>
                      {T.turnsSuffix(shipTravelTurns(activeShip, portCity, pendingDest[selectedShipId]) ?? 0)}
                      <button class="link-btn" on:click={() => cancelOrder(selectedShipId)}>{T.cancel}</button>
                    </p>
                  {:else}
                    <p class="order-note muted">{T.stayInPortNote}</p>
                  {/if}
                {/if}
              </div>
            {:else if activeShip && isInTransit(activeShip)}
              <p class="order-note muted">{T.atSeaNote(activeShip.name)}</p>
            {/if}

          {:else if selectedBuilding === 'trading-post'}
            <h2>{T.building['trading-post']}</h2>
            <div class="city-select">
              {#each CITY_IDS as cId}
                <button class="city-btn" class:active={selectedCityId === cId} on:click={() => { selectedCityId = cId; }}>{CITIES[cId].name}</button>
              {/each}
            </div>

            {#if activeShip && portCity}
              <TradeTable
                {T}
                goodIds={GOOD_IDS}
                goodNames={GOOD_NAMES}
                {cityMarket}
                {state}
                {selectedCityId}
                {portCity}
                priceHeader={T.colPrice}
                ship={activeShip}
                {buyQty}
                {sellQty}
                {buyPreview}
                {sellPreview}
                on:buy={(e) => buy(e.detail)}
                on:sell={(e) => sell(e.detail)}
                on:sellAll={(e) => sellAll(e.detail)}
              />
              <div class="qty-row">
                <label>{T.buyQty} <input type="number" bind:value={buyQty} min="1" max="50" /></label>
                <label>{T.sellQty} <input type="number" bind:value={sellQty} min="1" max="50" /></label>
              </div>
            {:else}
              <TradeTable
                {T}
                goodIds={GOOD_IDS}
                goodNames={GOOD_NAMES}
                {cityMarket}
                {state}
                {selectedCityId}
                {portCity}
                priceHeader={T.priceInCity(CITIES[selectedCityId].name)}
              />
              <p class="order-note muted">{T.noShipToTrade}</p>
            {/if}

            {#if errorMsg}
              <p class="error">{errorMsg}</p>
            {/if}

          {:else if selectedBuilding === 'shipyard'}
            <h2>{T.shipyard}</h2>
            {#if atShipyard && shipyardShips.length > 0}
              {#each shipyardShips as s (s.id)}
                {@const cost = repairCost(s)}
                {@const renameDraft = renameDrafts[s.id] ?? s.name}
                <div class="shipyard-ship-block">
                  <h3 class="shipyard-ship-name">{s.name} <span class="tag">{SHIP_TYPES[s.type].name}</span></h3>
                  <div class="shipyard-row">
                    <span class="shipyard-info">{T.shipName}</span>
                    <input
                      type="text"
                      class="rename-input"
                      value={renameDraft}
                      on:input={(e) => handleRenameInput(e, s.id)}
                      maxlength="30"
                    />
                    <button
                      class="shipyard-btn"
                      on:click={() => renameShip(s.id)}
                      disabled={!renameDraft.trim() || renameDraft.trim() === s.name}
                    >{T.rename}</button>
                  </div>
                  <div class="shipyard-row">
                    <span class="shipyard-info">
                      {#if s.durability >= 100}
                        {T.fullySeaworthy}
                      {:else}
                        {T.repairTo(s.durability, cost)}
                      {/if}
                    </span>
                    <button
                      class="shipyard-btn"
                      on:click={() => repairShip(s.id)}
                      disabled={s.durability >= 100 || state.player.cash < cost}
                    >{T.repair}</button>
                  </div>
                  <div class="shipyard-row">
                    <span class="shipyard-info">
                      {T.crewLine(s.crew, CREW_MAX[s.type], CREW_HIRE_COST, WAGE_PER_SAILOR_PER_TURN)}
                      {#if isUndercrewed(s.type, s.crew)}
                        {T.underCrewed}
                      {/if}
                    </span>
                    <button class="shipyard-btn" on:click={() => releaseCrew(s.id)} disabled={s.crew <= 0}>-1</button>
                    <button
                      class="shipyard-btn"
                      on:click={() => hireCrew(s.id)}
                      disabled={s.crew >= CREW_MAX[s.type] || state.player.cash < CREW_HIRE_COST}
                    >+1</button>
                  </div>
                  <div class="shipyard-row">
                    <span class="shipyard-info">
                      {T.cannonLine(s.cannons, CANNON_MAX[s.type], CANNON_PRICE, cannonSellValue())}
                    </span>
                    <button class="shipyard-btn" on:click={() => sellCannon(s.id)} disabled={s.cannons <= 0}>-1</button>
                    <button
                      class="shipyard-btn"
                      on:click={() => buyCannon(s.id)}
                      disabled={s.cannons >= CANNON_MAX[s.type] || state.player.cash < CANNON_PRICE || cargoTotal(s) > cargoCapacity(s) - 2}
                    >+1</button>
                  </div>
                  <div class="shipyard-row">
                    <span class="shipyard-info">
                      {T.postureLine} <strong>{POSTURE_LABELS[s.posture]}</strong> — {POSTURE_DESCRIPTIONS[s.posture]}
                    </span>
                    <div class="posture-btns">
                      {#each POSTURE_IDS as postureId}
                        <button
                          class="nav-btn"
                          class:active={s.posture === postureId}
                          on:click={() => setPosture(s.id, postureId)}
                        >{POSTURE_LABELS[postureId]}</button>
                      {/each}
                    </div>
                  </div>
                  <div class="shipyard-row">
                    <span class="shipyard-info">
                      {T.auctionLine(auctionSaleValue(SHIP_TYPES[s.type].purchasePrice, s.durability), SHIP_TYPES[s.type].purchasePrice, s.durability)}
                    </span>
                    <button class="shipyard-btn" on:click={() => auctionShip(s.id)}>{T.auction}</button>
                  </div>
                </div>
              {/each}
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
                    >{T.buyShipBtn(def.name)}</button>
                  </div>
                {/each}
              </div>
              {#if state.fleet.ships.length >= MAX_SHIPS}
                <p class="order-note muted">{T.fleetMax(MAX_SHIPS)}</p>
              {/if}
            {:else if portCity}
              <p class="order-note muted">
                {T.noShipyardNote(CITIES[portCity].name, SHIPYARD_CITIES.map(c => CITIES[c].name).join(', '))}
              </p>
            {:else}
              <p class="order-note muted">{T.selectShipForShipyard}</p>
            {/if}

            {#if errorMsg}
              <p class="error">{errorMsg}</p>
            {/if}

          {:else if selectedBuilding === 'church'}
            {@const church = state.cities[selectedCityId]}
            {@const pledgedPercent = Math.min(100 - church.churchCompletion, church.churchPledged / DONATION_COST_PER_PERCENT)}
            {@const turnsRemaining = Math.ceil(church.churchPledged / MAX_MARK_PER_TURN)}
            <h2>{T.churchOf(CITIES[selectedCityId].name)}</h2>
            <div class="city-select">
              {#each CITY_IDS as cId}
                <button class="city-btn" class:active={selectedCityId === cId} on:click={() => { selectedCityId = cId; }}>{CITIES[cId].name}</button>
              {/each}
            </div>

            <div class="church-progress">
              <div class="church-progress-bar">
                <div class="church-progress-fill" style="width: {church.churchCompletion}%"></div>
                <div class="church-progress-pledged" style="width: {pledgedPercent}%; left: {church.churchCompletion}%"></div>
              </div>
              <span class="church-progress-label">{Math.round(church.churchCompletion)}{T.churchComplete}</span>
            </div>

            {#if church.churchPledged > 0}
              <p class="order-note muted">
                {T.churchPledgedNote(church.churchPledged, PROGRESS_CAP_PER_TURN, turnsRemaining)}
              </p>
            {/if}

            {#if church.churchCompletion >= 100}
              <p class="order-note">{T.churchDoneNote}</p>
            {:else}
              <div class="qty-row">
                <label>{T.donate} <input type="number" bind:value={donationAmount} min="1" max={state.player.cash} /> Mark</label>
                <button
                  class="shipyard-btn"
                  on:click={() => donateToChurch(selectedCityId)}
                  disabled={!donationAmount || donationAmount < 1 || state.player.cash < donationAmount}
                >{T.donate}</button>
              </div>
              <p class="order-note muted">{T.churchHint(CITIES[selectedCityId].name, DONATION_COST_PER_PERCENT, REPUTATION_COST_PER_POINT)}</p>
            {/if}

            {#if errorMsg}
              <p class="error">{errorMsg}</p>
            {/if}

          {:else if selectedBuilding === 'counting-house'}
            <h2>{T.countingHouse}</h2>
            {#if state.player.loan > 0}
              <p class="order-note">
                {T.loanActive(state.player.loan, Math.round(LOAN_INTEREST_RATE * 100))}
              </p>
              <div class="qty-row">
                <label>{T.repay} <input type="number" bind:value={repayAmount} min="1" max={Math.min(state.player.cash, state.player.loan)} /> Mark</label>
                <button
                  class="shipyard-btn"
                  on:click={repayLoan}
                  disabled={!repayAmount || repayAmount < 1 || state.player.cash < 1}
                >{T.repay}</button>
              </div>
            {:else}
              <p class="order-note muted">{T.loanNone(LOAN_CAP, Math.round(LOAN_INTEREST_RATE * 100))}</p>
              <div class="qty-row">
                <label>{T.borrow} <input type="number" bind:value={loanAmount} min="1" max={LOAN_CAP} /> Mark</label>
                <button
                  class="shipyard-btn"
                  on:click={takeLoan}
                  disabled={!loanAmount || loanAmount < 1 || loanAmount > LOAN_CAP}
                >{T.borrow}</button>
              </div>
            {/if}

            <h3 class="counting-house-subhead">{T.shipInsurance}</h3>
            <p class="order-note muted">
              {T.insuranceHint(INSURANCE_PREMIUM_PER_TURN, Math.round(INSURANCE_PAYOUT_RATE * 100))}
            </p>
            <div class="fleet-list">
              {#each state.fleet.ships as s (s.id)}
                <div class="ship-card static">
                  <strong>{s.name}</strong>
                  <span class="tag">{SHIP_TYPES[s.type].name}</span>
                  <span class="tag">{s.insured ? T.insured : T.notInsured}</span>
                  <button class="shipyard-btn" on:click={() => toggleInsurance(s.id)}>{s.insured ? T.cancelInsurance : T.insure}</button>
                </div>
              {/each}
            </div>

            {#if errorMsg}
              <p class="error">{errorMsg}</p>
            {/if}

          {:else if selectedBuilding === 'warehouse-district'}
            {@const owned = state.warehouses[selectedCityId] ?? 0}
            <h2>{T.warehouseOf(CITIES[selectedCityId].name)}</h2>
            <div class="city-select">
              {#each CITY_IDS as cId}
                <button class="city-btn" class:active={selectedCityId === cId} on:click={() => { selectedCityId = cId; }}>{CITIES[cId].name}</button>
              {/each}
            </div>

            <p class="order-note">
              {T.ownedHere(owned, MAX_WAREHOUSES_PER_CITY, WAREHOUSE_INCOME_PER_TURN)}
            </p>
            <div class="qty-row">
              <button
                class="shipyard-btn"
                on:click={() => sellWarehouse(selectedCityId)}
                disabled={owned <= 0}
              >{T.sellFor(warehouseSellValue())}</button>
              <button
                class="shipyard-btn"
                on:click={() => buyWarehouse(selectedCityId)}
                disabled={owned >= MAX_WAREHOUSES_PER_CITY || state.player.cash < WAREHOUSE_PRICE}
              >{T.buyFor(WAREHOUSE_PRICE)}</button>
            </div>

            {#if errorMsg}
              <p class="error">{errorMsg}</p>
            {/if}

          {:else if selectedBuilding === 'town-hall'}
            {@const nextThreshold = RANK_THRESHOLDS.find(t => t.rank === state.player.politicalRank + 1)}
            <h2>{T.townHall}</h2>
            <p class="order-note">
              {T.currentRank} <strong>{RANK_LABELS[state.player.politicalRank]}</strong>
            </p>
            {#if nextThreshold}
              <p class="order-note muted">{T.nextRank(RANK_LABELS[nextThreshold.rank])}</p>
              <div class="church-progress">
                <div class="church-progress-bar">
                  <div class="church-progress-fill" style="width: {Math.min(100, (netWorth / nextThreshold.netWorth) * 100)}%"></div>
                </div>
                <span class="church-progress-label">{netWorth} / {nextThreshold.netWorth} Mark</span>
              </div>
              <div class="church-progress">
                <div class="church-progress-bar">
                  <div class="church-progress-fill" style="width: {Math.min(100, (state.player.reputation.lubeck / nextThreshold.lubeckReputation) * 100)}%"></div>
                </div>
                <span class="church-progress-label">{state.player.reputation.lubeck} / {nextThreshold.lubeckReputation} {T.reputationInCity('Lübeck')}</span>
              </div>
            {:else}
              <p class="order-note">{T.topRankNote}</p>
            {/if}

            <h3 class="counting-house-subhead">{T.cityStatus(CITIES[selectedCityId].name)}</h3>
            <div class="city-select">
              {#each CITY_IDS as cId}
                <button class="city-btn" class:active={selectedCityId === cId} on:click={() => { selectedCityId = cId; }}>{CITIES[cId].name}</button>
              {/each}
            </div>
            <p class="order-note muted">{T.population(CITIES[selectedCityId].population.toLocaleString())}</p>
            <p class="order-note muted">{T.reputation(state.player.reputation[selectedCityId])}</p>
            {@const activeEffects = state.cityEffects.filter(e => e.cityId === selectedCityId)}
            {#if activeEffects.length === 0}
              <p class="order-note muted">{T.noActiveEffects}</p>
            {:else}
              <ul class="effect-list">
                {#each activeEffects as effect}
                  <li>
                    {#if effect.type === 'embargo'}
                      {T.effectEmbargo(effect.goodId ? GOOD_NAMES[effect.goodId] : '', effect.turnsRemaining)}
                    {:else if effect.type === 'plague'}
                      {T.effectPlague(effect.turnsRemaining)}
                    {:else}
                      {T.effectBoom(effect.goodId ? GOOD_NAMES[effect.goodId] : '', effect.turnsRemaining)}
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}

            <h3 class="counting-house-subhead">{T.supplyDemandHeading}</h3>
            <table class="supply-demand-table">
              <thead>
                <tr><th>{T.colGood}</th><th>{T.colSupply}</th><th>{T.colDemand}</th><th>{T.colPriceTrend}</th></tr>
              </thead>
              <tbody>
                {#each GOOD_IDS as goodId}
                  <tr>
                    <td>{GOOD_ICONS[goodId]} {GOOD_NAMES[goodId]}</td>
                    <td>{cityMarket[goodId].production}</td>
                    <td>{cityMarket[goodId].consumption}</td>
                    <td><Sparkline values={priceHistory[selectedCityId][goodId]} /></td>
                  </tr>
                {/each}
              </tbody>
            </table>

          {:else if selectedBuilding === 'merchants-house'}
            <h2>{T.merchantsHouse}</h2>
            <p class="order-note">
              {T.playerStatusLine(state.player.name, state.player.age, Math.round(state.player.health), MARITAL_LABEL[state.player.maritalStatus])}
              {#if state.player.traits.length > 0}
                · {T.traitsLabel}: {state.player.traits.map(t => TRAIT_LABELS[t].label).join(', ')}
              {/if}
            </p>

            {#if state.player.maritalStatus === 'married' && state.player.partner}
              <p class="order-note muted">{T.marriedTo(state.player.partner.title, state.player.partner.age)}</p>
            {:else if state.player.age >= MIN_MARRIAGE_AGE}
              <div class="qty-row">
                <span class="shipyard-info">{T.seekMarriageOffer(PARTNER_TYPES[0]?.title ?? '', PARTNER_TYPES[0]?.buyoutCost ?? 0)}</span>
                <button
                  class="shipyard-btn"
                  on:click={seekMarriage}
                  disabled={state.player.cash < (PARTNER_TYPES[0]?.buyoutCost ?? 0)}
                >{T.seekMarriage}</button>
              </div>
            {:else}
              <p class="order-note muted">{T.tooYoungToMarry(MIN_MARRIAGE_AGE)}</p>
            {/if}

            <h3 class="counting-house-subhead">{T.childrenLabel}</h3>
            {#if state.player.children.length === 0}
              <p class="order-note muted">{T.noChildren}</p>
            {:else}
              <div class="fleet-list">
                {#each state.player.children as child (child.id)}
                  <div class="ship-card static">
                    <strong>{child.name}</strong>
                    <span class="tag">{T.age} {child.age}</span>
                    <span class="tag">{T.health} {Math.round(child.health)}/100</span>
                    {#if child.traits.length > 0}
                      <span class="tag">{child.traits.map(t => TRAIT_LABELS[t].label).join(', ')}</span>
                    {/if}
                    {#if child.age < HEIR_MIN_AGE}
                      <button
                        class="shipyard-btn"
                        on:click={() => hireTutor(child.id)}
                        disabled={child.tutoredThisYear || child.traits.length >= 2 || state.player.cash < HIRE_TUTOR_COST}
                      >{child.tutoredThisYear ? T.tutored : T.hireTutor(HIRE_TUTOR_COST)}</button>
                    {:else}
                      <span class="tag">{T.heirEligible}</span>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}

            <h3 class="counting-house-subhead">{T.achievementsHeading}</h3>
            {#if state.achievements.length === 0}
              <p class="order-note muted">{T.noAchievements}</p>
            {:else}
              <div class="achievement-badges">
                {#each state.achievements as id (id)}
                  <span class="achievement-badge">🏆 {ACHIEVEMENT_LABELS[id]}</span>
                {/each}
              </div>
            {/if}

            <h3 class="counting-house-subhead">{T.chronicleHeading}</h3>
            <ul class="chronicle-list">
              {#each [...state.chronicle].reverse() as entry, i (state.chronicle.length - i)}
                <li>{entry}</li>
              {/each}
            </ul>

            {#if errorMsg}
              <p class="error">{errorMsg}</p>
            {/if}

          {:else}
            <h2>{BUILDING_LABELS[selectedBuilding]}</h2>
            <p>{T.comingSoon}</p>
          {/if}
          <button class="close-building-btn" on:click={() => { selectedBuilding = undefined; }}>{T.close}</button>
        </div>
      </div>
    {/if}

    {#if screen === 'port'}
    <div class="layout">
      <section class="panel fleet-panel" class:collapsed={fleetCollapsed}>
        <div class="fleet-header">
          {#if !fleetCollapsed}
            <h2>{T.fleetLabel(state.fleet.ships.length, MAX_SHIPS)}</h2>
          {/if}
          <button
            class="fold-btn"
            on:click={() => { fleetCollapsed = !fleetCollapsed; }}
            aria-label={fleetCollapsed ? T.expandFleetPanel : T.collapseFleetPanel}
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
                {T.durLabel} {s.durability}/100 · {DURABILITY_LABELS[durabilityStatus(s.durability)]}
              </span>
              <span class="tag">{T.cargoLabel} {cargoTotal(s)}/{cargoCapacity(s)}{s.cannons > 0 ? T.cargoUsedByCannons(s.cannons * 2) : ''}</span>
            </div>
          {/each}
        {/if}
      </section>

      <section class="panel trade-panel">
        {#if activeShip && portCity}
          <h2>{T.portOf(CITIES[portCity].name)}</h2>

          <div class="city-select">
            {#each CITY_IDS as cId}
              <button
                class="city-btn"
                class:active={selectedCityId === cId}
                on:click={() => { selectedCityId = cId; }}
              >{CITIES[cId].name}</button>
            {/each}
          </div>

          <TradeTable
            {T}
            goodIds={GOOD_IDS}
            goodNames={GOOD_NAMES}
            {cityMarket}
            {state}
            {selectedCityId}
            {portCity}
            priceHeader={T.colPrice}
            ship={activeShip}
            {buyQty}
            {sellQty}
            {buyPreview}
            {sellPreview}
            on:buy={(e) => buy(e.detail)}
            on:sell={(e) => sell(e.detail)}
            on:sellAll={(e) => sellAll(e.detail)}
          />

          <div class="qty-row">
            <label>{T.buyQty} <input type="number" bind:value={buyQty} min="1" max="50" /></label>
            <label>{T.sellQty} <input type="number" bind:value={sellQty} min="1" max="50" /></label>
          </div>

          <div class="dest-section">
            <h3>{T.setDestination}</h3>
            {#if !canDepart(activeShip.durability)}
              <p class="order-note critical">
                {T.criticalDamageNote(activeShip.name, activeShip.durability)}
              </p>
              {#if portCity && !isShipyardCity(portCity)}
                <p class="order-note muted">
                  {T.auctionLine(auctionSaleValue(SHIP_TYPES[activeShip.type].purchasePrice, activeShip.durability), SHIP_TYPES[activeShip.type].purchasePrice, activeShip.durability)}
                </p>
                <button class="shipyard-btn" on:click={() => auctionShip(activeShip.id)}>{T.auction}</button>
              {/if}
            {:else if activeShip.repairCooldown > 0}
              <p class="order-note critical">
                {T.repairCooldownNote(activeShip.name)}
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
                  {T.ordersDepart} <strong>{CITIES[pendingDest[selectedShipId]].name}</strong>
                  {T.turnsSuffix(shipTravelTurns(activeShip, portCity, pendingDest[selectedShipId]) ?? 0)}
                  <button class="link-btn" on:click={() => cancelOrder(selectedShipId)}>{T.cancel}</button>
                </p>
              {:else}
                <p class="order-note muted">{T.stayInPortNote}</p>
              {/if}
            {/if}
          </div>

          {#if atShipyard}
            <div class="shipyard-section">
              <h3>{T.shipyard}</h3>
              {#each shipyardShips as s (s.id)}
                {@const cost = repairCost(s)}
                {@const renameDraft = renameDrafts[s.id] ?? s.name}
                <div class="shipyard-ship-block">
                  <h4 class="shipyard-ship-name">{s.name} <span class="tag">{SHIP_TYPES[s.type].name}</span></h4>
                  <div class="shipyard-row">
                    <span class="shipyard-info">{T.shipName}</span>
                    <input
                      type="text"
                      class="rename-input"
                      value={renameDraft}
                      on:input={(e) => handleRenameInput(e, s.id)}
                      maxlength="30"
                    />
                    <button
                      class="shipyard-btn"
                      on:click={() => renameShip(s.id)}
                      disabled={!renameDraft.trim() || renameDraft.trim() === s.name}
                    >{T.rename}</button>
                  </div>
                  <div class="shipyard-row">
                    <span class="shipyard-info">
                      {#if s.durability >= 100}
                        {T.fullySeaworthy}
                      {:else}
                        {T.repairTo(s.durability, cost)}
                      {/if}
                    </span>
                    <button
                      class="shipyard-btn"
                      on:click={() => repairShip(s.id)}
                      disabled={s.durability >= 100 || state.player.cash < cost}
                    >{T.repair}</button>
                  </div>
                  <div class="shipyard-row">
                    <span class="shipyard-info">
                      {T.crewLine(s.crew, CREW_MAX[s.type], CREW_HIRE_COST, WAGE_PER_SAILOR_PER_TURN)}
                      {#if isUndercrewed(s.type, s.crew)}
                        {T.underCrewed}
                      {/if}
                    </span>
                    <button class="shipyard-btn" on:click={() => releaseCrew(s.id)} disabled={s.crew <= 0}>-1</button>
                    <button
                      class="shipyard-btn"
                      on:click={() => hireCrew(s.id)}
                      disabled={s.crew >= CREW_MAX[s.type] || state.player.cash < CREW_HIRE_COST}
                    >+1</button>
                  </div>
                  <div class="shipyard-row">
                    <span class="shipyard-info">
                      {T.cannonLine(s.cannons, CANNON_MAX[s.type], CANNON_PRICE, cannonSellValue())}
                    </span>
                    <button class="shipyard-btn" on:click={() => sellCannon(s.id)} disabled={s.cannons <= 0}>-1</button>
                    <button
                      class="shipyard-btn"
                      on:click={() => buyCannon(s.id)}
                      disabled={s.cannons >= CANNON_MAX[s.type] || state.player.cash < CANNON_PRICE || cargoTotal(s) > cargoCapacity(s) - 2}
                    >+1</button>
                  </div>
                  <div class="shipyard-row">
                    <span class="shipyard-info">
                      {T.postureLine} <strong>{POSTURE_LABELS[s.posture]}</strong> — {POSTURE_DESCRIPTIONS[s.posture]}
                    </span>
                    <div class="posture-btns">
                      {#each POSTURE_IDS as postureId}
                        <button
                          class="nav-btn"
                          class:active={s.posture === postureId}
                          on:click={() => setPosture(s.id, postureId)}
                        >{POSTURE_LABELS[postureId]}</button>
                      {/each}
                    </div>
                  </div>
                  <div class="shipyard-row">
                    <span class="shipyard-info">
                      {T.auctionLine(auctionSaleValue(SHIP_TYPES[s.type].purchasePrice, s.durability), SHIP_TYPES[s.type].purchasePrice, s.durability)}
                    </span>
                    <button class="shipyard-btn" on:click={() => auctionShip(s.id)}>{T.auction}</button>
                  </div>
                </div>
              {/each}
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
                    >{T.buyShipBtn(def.name)}</button>
                  </div>
                {/each}
              </div>
              {#if state.fleet.ships.length >= MAX_SHIPS}
                <p class="order-note muted">{T.fleetMax(MAX_SHIPS)}</p>
              {/if}
            </div>
          {:else}
            <div class="shipyard-section">
              <p class="order-note muted">
                {T.noShipyardNote(CITIES[portCity].name, SHIPYARD_CITIES.map(c => CITIES[c].name).join(', '))}
              </p>
            </div>
          {/if}

        {:else if activeShip && isInTransit(activeShip)}
          <h2>{T.shipAtSea(activeShip.name)}</h2>
          <p>{T.sailingNote(CITIES[transitPos(activeShip).from].name, CITIES[transitPos(activeShip).to].name, transitPos(activeShip).turnsRemaining)}</p>
          <p class="subtext">{T.atSea}</p>

          <div class="city-select">
            {#each CITY_IDS as cId}
              <button class="city-btn" class:active={selectedCityId === cId} on:click={() => { selectedCityId = cId; }}>{CITIES[cId].name}</button>
            {/each}
          </div>

          <TradeTable
            {T}
            goodIds={GOOD_IDS}
            goodNames={GOOD_NAMES}
            {cityMarket}
            {state}
            {selectedCityId}
            {portCity}
            priceHeader={T.priceInCity(CITIES[selectedCityId].name)}
          />
        {:else}
          <p>{T.noShipSelected}</p>
        {/if}

        {#if errorMsg}
          <p class="error">{errorMsg}</p>
        {/if}
      </section>
    </div>
    {/if}

    <footer>
      <button class="end-turn-btn" on:click={endTurn} disabled={busyTurn || !!state.pendingSuccession}>
        {state.pendingSuccession ? T.chooseHeirFirst : busyTurn ? T.resolving : T.endTurn}
      </button>
    </footer>

    {#if auctionResult}
      <div class="turn-summary-overlay">
        <div class="turn-summary-card">
          <h2>{T.shipAuction(auctionResult.date)}</h2>
          <p class="order-note">{T.soldTo(auctionResult.shipName, auctionResult.price)}</p>
          <button class="shipyard-btn" on:click={() => { auctionResult = null; }}>{T.close}</button>
        </div>
      </div>
    {/if}

    {#if state.pendingSuccession}
      <div class="turn-summary-overlay">
        <div class="turn-summary-card">
          <h2>{T.passedAway(state.pendingSuccession.deceasedName)}</h2>
          <p class="order-note">{T.successionPrompt(state.pendingSuccession.deceasedAge)}</p>
          <div class="fleet-list">
            {#each state.pendingSuccession.candidates as child (child.id)}
              <div class="ship-card static">
                <strong>{child.name}</strong>
                <span class="tag">{T.age} {child.age}</span>
                <span class="tag">{T.health} {Math.round(child.health)}/100</span>
                {#if child.traits.length > 0}
                  <span class="tag">{child.traits.map(t => TRAIT_LABELS[t].label).join(', ')}</span>
                {/if}
                <button class="shipyard-btn" on:click={() => chooseHeir(child.id)}>{T.choose(child.name)}</button>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

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
          {#if lastSummary?.outcome === 'win'}
            <h2 class="win">{T.victory}</h2>
            <p>{T.victoryText(netWorth)}</p>
          {:else}
            <h2>{T.turnSummary(state.calendar.turn - 1)}</h2>
          {/if}
          {#if lastSummary && lastSummary.events.length > 0}
            <ul class="events">
              {#each lastSummary.events as evt}
                <li>{evt}</li>
              {/each}
            </ul>
          {:else if lastSummary?.outcome !== 'win'}
            <p>{T.quietTurn}</p>
          {/if}
          <p class="net-worth">{T.netWorthLabel(netWorth)}</p>
          {#if lastSummary?.outcome === 'win'}
            <div class="turn-summary-actions">
              <button on:click={continuePlaying}>{T.continuePlaying}</button>
              <button class="link-btn" on:click={newGame}>{T.retirePlayAgain}</button>
            </div>
          {:else}
            <button on:click={continuePlaying}>{T.continueBtn}</button>
          {/if}
        </div>
      </div>
    {/if}
  </main>

{:else if screen === 'game-over'}
  <main class="screen center">
    {#if lastSummary?.loseReason === 'no-heir'}
      <h1 class="lose">{T.dynastyEnded}</h1>
      <p>{T.dynastyEndedText(state.player.name, netWorth)}</p>
    {:else if lastSummary?.loseReason === 'out-of-turns'}
      <h1 class="lose">{T.timesUp}</h1>
      <p>{T.timesUpText(netWorth)}</p>
    {:else}
      <h1 class="lose">{T.bankrupt}</h1>
      <p>{T.bankruptText(netWorth)}</p>
    {/if}
    <button on:click={newGame}>{T.playAgain}</button>
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

  .version-btn {
    background: none;
    border: none;
    color: #9a8060;
    padding: 0 0.4rem;
    font-size: 0.75rem;
    line-height: 1;
  }
  .version-btn:hover { background: none; color: #d4a843; }

  .changelog-panel {
    display: block;
    max-height: 40vh;
    overflow-y: auto;
  }
  .changelog-text {
    font-family: inherit;
    font-size: 0.8rem;
    color: #c0a880;
    margin: 0 0 0.6rem 0;
  }
  .changelog-text :global(h1) { font-size: 1.1rem; color: #f0dca0; margin: 0.4rem 0; }
  .changelog-text :global(h2) { font-size: 1rem; color: #e8c878; margin: 0.8rem 0 0.3rem; border-bottom: 1px solid #3a2e18; padding-bottom: 0.2rem; }
  .changelog-text :global(h3) { font-size: 0.9rem; color: #d4a843; margin: 0.6rem 0 0.2rem; }
  .changelog-text :global(h4) { font-size: 0.85rem; color: #c0a880; margin: 0.5rem 0 0.2rem; }
  .changelog-text :global(p) { margin: 0.3rem 0; line-height: 1.4; }
  .changelog-text :global(ul) { margin: 0.2rem 0 0.5rem; padding-left: 1.2rem; }
  .changelog-text :global(li) { margin: 0.2rem 0; line-height: 1.4; }
  .changelog-text :global(strong) { color: #f0dca0; }
  .changelog-text :global(code) { background: #1c1508; padding: 0.05rem 0.3rem; border-radius: 3px; font-size: 0.75rem; }
  .changelog-text :global(a) { color: #d4a843; }
  .changelog-text :global(hr) { border: none; border-top: 1px solid #3a2e18; margin: 0.6rem 0; }

  .season-info {
    padding: 0.6rem 1.2rem;
    background: #1c1508;
    border-bottom: 1px solid #3a2e18;
    font-size: 0.85rem;
    color: #c0a880;
  }

  .nav-toggle { display: flex; gap: 0.3rem; }
  .nav-btn {
    padding: 0.25rem 0.6rem;
    font-size: 0.8rem;
    background: #201810;
    border-color: #4a3a20;
    color: #c0a880;
  }
  .nav-btn.active { background: #3a2810; border-color: #c09040; color: #f0dca0; }

  .posture-btns { display: flex; gap: 0.3rem; }

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
  .ship-card.static {
    cursor: default;
    flex-direction: row;
    align-items: center;
    gap: 0.6rem;
  }
  .ship-card.static .shipyard-btn { margin-left: auto; }
  .ship-card strong { color: #d4a843; font-size: 0.95rem; }
  .counting-house-subhead {
    margin: 1.2rem 0 0.4rem;
    padding-top: 1rem;
    border-top: 1px solid #3a2e18;
    color: #e0d090;
    font-size: 1rem;
  }
  .effect-list { list-style: none; padding: 0; margin: 0.4rem 0; display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; color: #d4a843; }
  .achievement-badges { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.4rem 0; }
  .achievement-badge {
    background: #241c10;
    border: 1px solid #4a3a20;
    color: #f0dca0;
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    font-size: 0.8rem;
  }
  .chronicle-list {
    list-style: none;
    padding: 0;
    margin: 0.4rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: #c8b090;
    max-height: 220px;
    overflow-y: auto;
  }
  .chronicle-list li { border-bottom: 1px solid #2a2018; padding-bottom: 0.4rem; }
  .chronicle-list li:last-child { border-bottom: none; }
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
  .rename-input { flex: 1; min-width: 0; }
  .shipyard-ship-block {
    margin-bottom: 1rem;
    padding-bottom: 0.8rem;
    border-bottom: 1px dashed #3a2e18;
  }
  .shipyard-ship-name {
    margin: 0 0 0.4rem;
    font-size: 0.95rem;
    color: #e0d090;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
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

  .turn-summary-actions { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; }

  .building-panel {
    align-items: stretch;
    text-align: left;
    max-width: 700px;
    max-height: 85vh;
    overflow-y: auto;
    gap: 1rem;
  }
  .building-panel h2 { text-align: center; }
  .building-panel .fleet-list { display: flex; flex-direction: column; gap: 0.5rem; }

  .supply-demand-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
    margin-bottom: 0.8rem;
  }
  .supply-demand-table th {
    text-align: left;
    padding: 0.3rem 0.5rem;
    color: #8a7a60;
    border-bottom: 1px solid #3a2e18;
    font-weight: normal;
    font-size: 0.78rem;
  }
  .supply-demand-table td { padding: 0.3rem 0.5rem; border-bottom: 1px solid #2a2018; }

  .church-progress { display: flex; align-items: center; gap: 0.8rem; margin: 0.6rem 0; }
  .church-progress-bar {
    position: relative;
    flex: 1;
    height: 12px;
    background: #241c10;
    border: 1px solid #4a3a20;
    border-radius: 6px;
    overflow: hidden;
  }
  .church-progress-fill { position: absolute; top: 0; left: 0; height: 100%; background: #c8a860; }
  .church-progress-pledged { position: absolute; top: 0; height: 100%; background: repeating-linear-gradient(45deg, #6a5838, #6a5838 4px, #524128 4px, #524128 8px); }
  .church-progress-label { font-size: 0.85rem; color: #c8a840; white-space: nowrap; }
  .close-building-btn { align-self: center; }

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
    .dest-btn, .city-btn, .shipyard-btn { padding: 0.45rem 0.7rem; }
  }
</style>
