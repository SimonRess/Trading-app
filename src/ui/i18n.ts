// In-app UI localisation (English/German). Scope: everything in the static
// UI chrome — screen titles, buttons, table headers, popovers, tooltips,
// and the game's own display-only vocabulary (seasons, goods, ship
// postures, marital status, durability, building names, political ranks,
// child traits).
//
// Deliberately OUT of scope for this first pass: the narrative turn-summary
// log lines generated deep inside src/game/systems/*.ts (event messages,
// succession/death messages, rank-up announcements, etc). Those are plain
// English strings returned by pure game-logic functions today; localising
// them correctly means changing those functions to return a message key +
// params instead of a formatted string, so the UI layer can translate them
// — a real refactor touching ~10 system files and the ~50 existing tests
// that assert on message substrings, not a small addition. Tracked as a
// follow-up rather than attempted half-heartedly here (see CLAUDE.md's
// architecture rule: src/game/ must not know about the UI/locale).
import { writable } from 'svelte/store';
import type { GoodId, Ship, PoliticalRank, TraitId } from '../game/state/types.ts';
import type { BuildingId } from '../render/city-scene.ts';

export type Locale = 'en' | 'de';

const STORAGE_KEY = 'hanse-locale';

function detectDefaultLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'de') return stored;
  } catch {
    // localStorage unavailable (e.g. privacy mode) — fall through to browser language.
  }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export const locale = writable<Locale>(detectDefaultLocale());

locale.subscribe((value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore — persistence is a nicety, not required for the switch to work this session
  }
});

export interface Translation {
  // Header / nav
  appTitle: string;
  versionAndChangelog: string;
  seasonInfoLabel: string;
  turnLabel: string;
  navMap: string;
  navPort: string;
  navCity: string;
  navSave: string;
  navSettings: string;
  netLabel: string;
  close: string;

  // Settings panel
  settingsTitle: string;
  settingsLanguage: string;
  settingsLanguageEnglish: string;
  settingsLanguageGerman: string;

  // Season info popover
  seasonInfoText: (maxTurns: number) => string;

  // Save menu
  exportSave: string;
  importSave: string;
  loadSaveFile: string;
  saveExported: string;

  // New game screen
  newGameSubtitle: string;
  yourName: string;
  namePlaceholder: string;
  beginTrading: string;
  orWord: string;

  // Seasons
  season: Record<'spring' | 'summer' | 'autumn' | 'winter', string>;

  // Goods
  good: Record<GoodId, string>;

  // Marital status
  marital: Record<'single' | 'married' | 'widowed', string>;

  // Durability
  durability: Record<'seaworthy' | 'worn' | 'damaged' | 'critical' | 'wrecked', string>;

  // Ship posture
  posture: Record<Ship['posture'], string>;
  postureDescription: Record<Ship['posture'], string>;

  // Buildings
  building: Record<BuildingId, string>;

  // Political ranks
  rank: Record<PoliticalRank, string>;

  // Traits
  trait: Record<TraitId, { label: string; description: string }>;

  // Map legend
  legendCalm: string;
  legendDangerous: string;
  legendShipEnRoute: string;

  // Shared table/column headers
  colGood: string;
  colPrice: string;
  colStock: string;
  colSupply: string;
  colDemand: string;
  colInHold: string;
  colTrade: string;
  priceInCity: (city: string) => string;
  noShipToTrade: string;

  // Trade actions
  buyQty: string;
  sellQty: string;
  buyBtn: (qty: number, total: number) => string;
  sellBtn: (qty: number, total: number) => string;
  tradePreviewTitle: (avg: string, spot: number) => string;

  // Destination / sailing
  setDestination: string;
  criticalDamageNote: (name: string, durability: number) => string;
  repairCooldownNote: (name: string) => string;
  cancel: string;
  stayInPortNote: string;
  shipAtSea: (name: string) => string;
  atSea: string;
  atSeaNote: (name: string) => string;
  sailingNote: (from: string, to: string, turns: number) => string;
  durLabel: string;
  cargoLabel: string;
  cargoUsedByCannons: (n: number) => string;
  ordersDepart: string;
  turnsSuffix: (turns: number) => string;

  // Shipyard
  shipyard: string;
  shipName: string;
  rename: string;
  fullySeaworthy: string;
  repairTo: (durability: number, cost: number) => string;
  repair: string;
  crewLine: (crew: number, max: number, hireCost: number, wage: number) => string;
  underCrewed: string;
  cannonLine: (cannons: number, max: number, price: number, sellValue: number) => string;
  postureLine: string;
  auctionLine: (price: number, base: number, durability: number) => string;
  auction: string;
  noShipyardNote: (here: string, cities: string) => string;
  selectShipForShipyard: string;
  fleetMax: (max: number) => string;
  buyShipBtn: (name: string) => string;

  // Church
  churchOf: (city: string) => string;
  churchComplete: string;
  churchPledgedNote: (mark: number, turns: number) => string;
  churchDoneNote: string;
  donate: string;
  churchHint: (city: string) => string;

  // Counting House
  countingHouse: string;
  loanActive: (amount: number, rate: number) => string;
  repay: string;
  loanNone: (cap: number, rate: number) => string;
  borrow: string;
  shipInsurance: string;
  insuranceHint: (premium: number, payoutPct: number) => string;
  insured: string;
  notInsured: string;
  insure: string;
  cancelInsurance: string;

  // Warehouse District
  warehouseOf: (city: string) => string;
  ownedHere: (owned: number, max: number, income: number) => string;
  sellFor: (mark: number) => string;
  buyFor: (mark: number) => string;

  // Town Hall
  townHall: string;
  currentRank: string;
  nextRank: (label: string) => string;
  topRankNote: string;
  cityStatus: (city: string) => string;
  population: (n: string) => string;
  reputation: (n: number) => string;
  reputationInCity: (city: string) => string;
  noActiveEffects: string;
  supplyDemandHeading: string;
  effectEmbargo: (good: string, turns: number) => string;
  effectPlague: (turns: number) => string;
  effectBoom: (good: string, turns: number) => string;

  // Merchant's House
  merchantsHouse: string;
  playerStatusLine: (name: string, age: number, health: number, marital: string) => string;
  traitsLabel: string;
  marriedTo: (title: string, age: number) => string;
  seekMarriageOffer: (title: string, cost: number) => string;
  seekMarriage: string;
  tooYoungToMarry: (min: number) => string;
  childrenLabel: string;
  noChildren: string;
  age: string;
  health: string;
  heirEligible: string;
  hireTutor: (cost: number) => string;
  tutored: string;

  // Coming-soon fallback
  comingSoon: string;

  // Harbor / fleet
  harbor: string;
  fleetLabel: (count: number, max: number) => string;
  portOf: (city: string) => string;
  expandFleetPanel: string;
  collapseFleetPanel: string;
  noShipSelected: string;

  // Footer / turn actions
  endTurn: string;
  resolving: string;
  chooseHeirFirst: string;

  // Auction popup
  shipAuction: (date: string) => string;
  soldTo: (name: string, price: number) => string;

  // Succession
  passedAway: (name: string) => string;
  successionPrompt: (age: number) => string;
  choose: (name: string) => string;

  // Turn summary
  victory: string;
  victoryText: (net: number) => string;
  turnSummary: (n: number) => string;
  quietTurn: string;
  netWorthLabel: (net: number) => string;
  continuePlaying: string;
  retirePlayAgain: string;
  continueBtn: string;

  // Game over
  dynastyEnded: string;
  dynastyEndedText: (name: string, net: number) => string;
  timesUp: string;
  timesUpText: (net: number) => string;
  bankrupt: string;
  bankruptText: (net: number) => string;
  playAgain: string;

  // Errors (client-side action-rejected messages)
  err: {
    buy: string; sell: string; buyShip: string; repairShip: string; auctionShip: string;
    setPosture: string; renameShip: string; hireCrew: string; releaseCrew: string;
    buyCannon: string; sellCannon: string; insurance: string; buyWarehouse: string;
    sellWarehouse: string; marriage: string; heir: string; tutor: string; loan: string;
    repay: string; donate: string; saveFile: string;
  };
}

function speedLabelEn(ratio: number): string {
  if (ratio === 1) return 'standard speed';
  if (ratio > 1) return `${String(ratio)}x slower`;
  return `${String(Math.round((1 / ratio) * 10) / 10)}x faster`;
}
function speedLabelDe(ratio: number): string {
  if (ratio === 1) return 'Standardgeschwindigkeit';
  if (ratio > 1) return `${String(ratio)}x langsamer`;
  return `${String(Math.round((1 / ratio) * 10) / 10)}x schneller`;
}

export const speedLabel: Record<Locale, (ratio: number) => string> = {
  en: speedLabelEn,
  de: speedLabelDe,
};

const en: Translation = {
  appTitle: 'Hanse',
  versionAndChangelog: 'Version and changelog',
  seasonInfoLabel: 'Season order and duration',
  turnLabel: 'Turn',
  navMap: '🗺️ Map',
  navPort: '⚓ Port',
  navCity: '🏙️ City',
  navSave: '💾 Save',
  navSettings: '⚙️ Settings',
  netLabel: 'Net',
  close: 'Close',

  settingsTitle: 'Settings',
  settingsLanguage: 'Language',
  settingsLanguageEnglish: 'English',
  settingsLanguageGerman: 'Deutsch',

  seasonInfoText: (maxTurns) =>
    `Seasons run in order — Spring → Summer → Autumn → Winter — each lasting exactly 1 turn. A new year begins right after Winter. At ${String(maxTurns)} turns total, this game runs ${String(maxTurns / 4)} years.`,

  exportSave: 'Export Save (.json)',
  importSave: 'Import Save',
  loadSaveFile: 'Load a save file',
  saveExported: 'Save exported.',

  newGameSubtitle: 'A Hanseatic trading adventure, 14th century',
  yourName: 'Your name',
  namePlaceholder: 'Enter merchant name',
  beginTrading: 'Begin Trading',
  orWord: 'or',

  season: { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' },
  good: { salt: 'Salt', grain: 'Grain', timber: 'Timber', furs: 'Furs', herring: 'Herring' },
  marital: { single: 'Single', married: 'Married', widowed: 'Widowed' },
  durability: { seaworthy: 'Seaworthy', worn: 'Worn', damaged: 'Damaged', critical: 'Critical', wrecked: 'Wrecked' },
  posture: { aggressive: 'Aggressive', defensive: 'Defensive', flee: 'Flee' },
  postureDescription: {
    aggressive: 'fight back at full strength; better odds, cannons and crew matter most.',
    defensive: 'fight back cautiously; the safe default.',
    flee: 'always escape, but jettison some cargo doing it.',
  },
  building: {
    harbor: 'Harbor',
    'trading-post': 'Trading Post',
    shipyard: 'Shipyard',
    church: 'Church',
    'counting-house': 'Counting House',
    'merchants-house': "Merchant's House",
    'town-hall': 'Town Hall',
    'warehouse-district': 'Warehouse District',
  },
  rank: { 0: 'Citizen', 1: 'Guild Member', 2: 'Council Member', 3: 'Mayor of Lübeck' },
  trait: {
    'penny-pincher': { label: 'Penny-pincher', description: 'Purchase prices 5% lower.' },
    simpleton: { label: 'Simpleton', description: 'Purchase prices 5% higher.' },
    charismatic: { label: 'Charismatic', description: 'Reputation gains +10%, losses -10%.' },
    'hot-tempered': { label: 'Hot-tempered', description: 'Reputation losses +10%.' },
  },

  legendCalm: 'Calm route',
  legendDangerous: 'Dangerous route',
  legendShipEnRoute: 'Ship en route',

  colGood: 'Good', colPrice: 'Price', colStock: 'Stock', colSupply: 'Supply', colDemand: 'Demand',
  colInHold: 'In hold', colTrade: 'Trade',
  priceInCity: (city) => `Price in ${city}`,
  noShipToTrade: "No ship currently in this port to trade with — showing prices for reference.",

  buyQty: 'Buy qty', sellQty: 'Sell qty',
  buyBtn: (qty, total) => `Buy ${String(qty)} (${String(total)} M)`,
  sellBtn: (qty, total) => `Sell ${String(qty)} (${String(total)} M)`,
  tradePreviewTitle: (avg, spot) => `avg ${avg} M/unit (spot ${String(spot)} M)`,

  setDestination: 'Set Destination',
  criticalDamageNote: (name, durability) =>
    `⚠️ ${name} is critically damaged (${String(durability)}/100) and cannot depart. Repair it at a shipyard before setting sail.`,
  repairCooldownNote: (name) => `⚠️ ${name} is still in dock being repaired and cannot depart this turn.`,
  cancel: 'cancel',
  stayInPortNote: 'This ship stays in port until you give sailing orders.',
  shipAtSea: (name) => `${name} is at sea`,
  atSea: 'Market prices for reference:',
  atSeaNote: (name) => `${name} is at sea — select a ship in port to give sailing orders.`,
  sailingNote: (from, to, turns) => `Sailing ${from} → ${to} · ${String(turns)} turn(s) remaining.`,
  durLabel: 'Dur',
  cargoLabel: 'Cargo',
  cargoUsedByCannons: (n) => ` (${String(n)} used by cannons)`,
  ordersDepart: '⚓ Orders: depart for',
  turnsSuffix: (turns) => `(${String(turns)} turn${turns === 1 ? '' : 's'}) when you end the turn.`,

  shipyard: 'Shipyard',
  shipName: 'Ship name:',
  rename: 'Rename',
  fullySeaworthy: 'Fully seaworthy.',
  repairTo: (durability, cost) => `Repair to full (${String(durability)}/100) for ${String(cost)} Mark.`,
  repair: 'Repair',
  crewLine: (crew, max, hireCost, wage) =>
    `Crew: ${String(crew)}/${String(max)} · ${String(hireCost)} Mark to hire, ${String(wage)} Mark/sailor/turn wages.`,
  underCrewed: '(under-crewed, +1 turn travel time)',
  cannonLine: (cannons, max, price, sellValue) =>
    `Cannons: ${String(cannons)}/${String(max)} (−${String(cannons * 2)} last cargo) · ${String(price)} Mark to buy, ${String(sellValue)} Mark on sale.`,
  postureLine: 'Posture if pirates strike:',
  auctionLine: (price, base, durability) =>
    `Auction this ship to the highest bidder for ${String(price)} Mark (${String(base)} Mark base × 80% × ${String(durability)}/100 health).`,
  auction: 'Auction',
  noShipyardNote: (here, cities) => `${here} has no shipyard. Repairs and new ships are available in ${cities}.`,
  selectShipForShipyard: "Select a ship that's currently in port to use the Shipyard.",
  fleetMax: (max) => `Fleet is at the maximum of ${String(max)} ships.`,
  buyShipBtn: (name) => `Buy ${name}`,

  churchOf: (city) => `Church of ${city}`,
  churchComplete: '% complete',
  churchPledgedNote: (mark, turns) => `${String(mark)} Mark pledged, arriving at up to 1% per turn (~${String(turns)} more turn${turns === 1 ? '' : 's'}).`,
  churchDoneNote: '⛪ This church is fully built, thanks in part to your generosity.',
  donate: 'Donate',
  churchHint: (city) => `500 Mark ≈ 1% completion (arrives gradually, up to 1%/turn) · 1000 Mark ≈ 1 reputation in ${city} (right away).`,

  countingHouse: 'Counting House',
  loanActive: (amount, rate) => `Outstanding loan: ${String(amount)} Mark, accruing ${String(rate)}% interest per turn.`,
  repay: 'Repay',
  loanNone: (cap, rate) => `No active loan. Borrow up to ${String(cap)} Mark, repayable any time, at ${String(rate)}% compounding interest per turn.`,
  borrow: 'Borrow',
  shipInsurance: 'Ship Insurance',
  insuranceHint: (premium, payoutPct) => `${String(premium)} Mark/turn per insured ship · pays ${String(payoutPct)}% of storm damage or lost cargo value.`,
  insured: 'Insured',
  notInsured: 'Not insured',
  insure: 'Insure',
  cancelInsurance: 'Cancel',

  warehouseOf: (city) => `Warehouse District of ${city}`,
  ownedHere: (owned, max, income) => `Owned here: ${String(owned)}/${String(max)} · each generates ${String(income)} Mark/turn, no upkeep.`,
  sellFor: (mark) => `Sell (${String(mark)} Mark)`,
  buyFor: (mark) => `Buy (${String(mark)} Mark)`,

  townHall: 'Town Hall',
  currentRank: 'Current rank:',
  nextRank: (label) => `Next: ${label}`,
  topRankNote: 'You have reached the highest rank: Mayor of Lübeck.',
  cityStatus: (city) => `City Status — ${city}`,
  population: (n) => `Inhabitants: ${n}`,
  reputation: (n) => `Reputation: ${String(n)}`,
  reputationInCity: (city) => `reputation in ${city}`,
  noActiveEffects: 'No active effects.',
  supplyDemandHeading: 'Supply & Demand',
  effectEmbargo: (good, turns) => `⚖️ Embargo on ${good} (${String(turns)} turn${turns === 1 ? '' : 's'} left)`,
  effectPlague: (turns) => `☠️ Plague (${String(turns)} turn${turns === 1 ? '' : 's'} left)`,
  effectBoom: (good, turns) => `📈 Trade boom in ${good} (${String(turns)} turn${turns === 1 ? '' : 's'} left)`,

  merchantsHouse: "Merchant's House",
  playerStatusLine: (name, age, health, marital) => `${name} · Age ${String(age)} · Health ${String(health)} · ${marital}`,
  traitsLabel: 'Traits',
  marriedTo: (title, age) => `Married to ${title} (age ${String(age)}).`,
  seekMarriageOffer: (title, cost) => `Seek marriage to ${title} for ${String(cost)} Mark.`,
  seekMarriage: 'Seek Marriage',
  tooYoungToMarry: (min) => `Too young to marry (minimum age ${String(min)}).`,
  childrenLabel: 'Children',
  noChildren: 'No children yet.',
  age: 'Age',
  health: 'Health',
  heirEligible: 'Heir-eligible',
  hireTutor: (cost) => `Hire Tutor (${String(cost)} Mark)`,
  tutored: 'Tutored',

  comingSoon: "Coming soon — this building isn't wired to any actions yet.",

  harbor: 'Harbor',
  fleetLabel: (count, max) => `Fleet (${String(count)}/${String(max)})`,
  portOf: (city) => `Port of ${city}`,
  expandFleetPanel: 'Expand fleet panel',
  collapseFleetPanel: 'Collapse fleet panel',
  noShipSelected: 'No ship selected.',

  endTurn: 'End Turn →',
  resolving: 'Resolving...',
  chooseHeirFirst: 'Choose an heir first',

  shipAuction: (date) => `⚖️ Ship Auction — ${date}`,
  soldTo: (name, price) => `${name} was sold to the highest bidder for ${String(price)} Mark.`,

  passedAway: (name) => `⚱️ ${name} has passed away`,
  successionPrompt: (age) => `At age ${String(age)}, with more than one child old enough to inherit. Choose who takes up the family trade:`,
  choose: (name) => `Choose ${name}`,

  victory: 'Victory!',
  victoryText: (net) => `You accumulated ${String(net)} Mark and secured your family's legacy. The game continues — keep trading, or retire here.`,
  turnSummary: (n) => `Turn ${String(n)} Summary`,
  quietTurn: 'A quiet turn — nothing unusual happened.',
  netWorthLabel: (net) => `Net worth: ${String(net)} Mark`,
  continuePlaying: 'Continue Playing →',
  retirePlayAgain: 'Retire & Play Again',
  continueBtn: 'Continue →',

  dynastyEnded: 'The Dynasty Has Ended',
  dynastyEndedText: (name, net) => `${name} has passed away with no heir old enough to carry on the family trade. Final net worth: ${String(net)} Mark.`,
  timesUp: "Time's Up",
  timesUpText: (net) => `The trading winds turned against you. Final net worth: ${String(net)} Mark.`,
  bankrupt: 'Bankrupt',
  bankruptText: (net) => `The trading house has gone under. Final net worth: ${String(net)} Mark.`,
  playAgain: 'Play Again',

  err: {
    buy: 'Cannot buy.', sell: 'Cannot sell.', buyShip: 'Cannot buy ship.', repairShip: 'Cannot repair ship.',
    auctionShip: 'Cannot auction ship.', setPosture: 'Cannot set posture.', renameShip: 'Cannot rename ship.',
    hireCrew: 'Cannot hire crew.', releaseCrew: 'Cannot release crew.', buyCannon: 'Cannot buy cannon.',
    sellCannon: 'Cannot sell cannon.', insurance: 'Cannot change insurance.', buyWarehouse: 'Cannot buy warehouse.',
    sellWarehouse: 'Cannot sell warehouse.', marriage: 'Cannot marry right now.', heir: 'Cannot choose that heir.',
    tutor: 'Cannot hire a tutor right now.', loan: 'Cannot take loan.', repay: 'Cannot repay loan.',
    donate: 'Cannot donate.', saveFile: 'Could not load that save file.',
  },
};

const de: Translation = {
  appTitle: 'Hanse',
  versionAndChangelog: 'Version und Änderungsprotokoll',
  seasonInfoLabel: 'Reihenfolge und Dauer der Jahreszeiten',
  turnLabel: 'Runde',
  navMap: '🗺️ Karte',
  navPort: '⚓ Hafen',
  navCity: '🏙️ Stadt',
  navSave: '💾 Speichern',
  navSettings: '⚙️ Einstellungen',
  netLabel: 'Netto',
  close: 'Schließen',

  settingsTitle: 'Einstellungen',
  settingsLanguage: 'Sprache',
  settingsLanguageEnglish: 'English',
  settingsLanguageGerman: 'Deutsch',

  seasonInfoText: (maxTurns) =>
    `Die Jahreszeiten folgen der Reihe nach — Frühling → Sommer → Herbst → Winter — jede dauert genau 1 Runde. Nach dem Winter beginnt ein neues Jahr. Bei insgesamt ${String(maxTurns)} Runden dauert dieses Spiel ${String(maxTurns / 4)} Jahre.`,

  exportSave: 'Speicherstand exportieren (.json)',
  importSave: 'Speicherstand importieren',
  loadSaveFile: 'Speicherstand laden',
  saveExported: 'Speicherstand exportiert.',

  newGameSubtitle: 'Ein hanseatisches Handelsabenteuer, 14. Jahrhundert',
  yourName: 'Euer Name',
  namePlaceholder: 'Namen des Kaufmanns eingeben',
  beginTrading: 'Handel beginnen',
  orWord: 'oder',

  season: { spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst', winter: 'Winter' },
  good: { salt: 'Salz', grain: 'Getreide', timber: 'Holz', furs: 'Pelze', herring: 'Hering' },
  marital: { single: 'Ledig', married: 'Verheiratet', widowed: 'Verwitwet' },
  durability: { seaworthy: 'Seetüchtig', worn: 'Abgenutzt', damaged: 'Beschädigt', critical: 'Kritisch', wrecked: 'Wrack' },
  posture: { aggressive: 'Aggressiv', defensive: 'Defensiv', flee: 'Flucht' },
  postureDescription: {
    aggressive: 'kämpft mit voller Kraft zurück; bessere Chancen, Kanonen und Besatzung zählen am meisten.',
    defensive: 'kämpft vorsichtig zurück; die sichere Standardwahl.',
    flee: 'entkommt immer, wirft dabei aber etwas Ladung über Bord.',
  },
  building: {
    harbor: 'Hafen',
    'trading-post': 'Handelsposten',
    shipyard: 'Werft',
    church: 'Kirche',
    'counting-house': 'Kontor',
    'merchants-house': 'Kaufmannshaus',
    'town-hall': 'Rathaus',
    'warehouse-district': 'Lagerhausviertel',
  },
  rank: { 0: 'Bürger', 1: 'Gildemitglied', 2: 'Ratsmitglied', 3: 'Bürgermeister von Lübeck' },
  trait: {
    'penny-pincher': { label: 'Pfennigfuchser', description: 'Einkaufspreise 5% niedriger.' },
    simpleton: { label: 'Einfaltspinsel', description: 'Einkaufspreise 5% höher.' },
    charismatic: { label: 'Charismatisch', description: 'Ansehensgewinn +10%, -verlust -10%.' },
    'hot-tempered': { label: 'Jähzornig', description: 'Ansehensverlust +10%.' },
  },

  legendCalm: 'Ruhige Route',
  legendDangerous: 'Gefährliche Route',
  legendShipEnRoute: 'Schiff unterwegs',

  colGood: 'Ware', colPrice: 'Preis', colStock: 'Bestand', colSupply: 'Angebot', colDemand: 'Nachfrage',
  colInHold: 'Im Laderaum', colTrade: 'Handel',
  priceInCity: (city) => `Preis in ${city}`,
  noShipToTrade: 'Kein Schiff in diesem Hafen zum Handeln — Preise werden nur zur Orientierung angezeigt.',

  buyQty: 'Kaufmenge', sellQty: 'Verkaufsmenge',
  buyBtn: (qty, total) => `Kaufen ${String(qty)} (${String(total)} M)`,
  sellBtn: (qty, total) => `Verkaufen ${String(qty)} (${String(total)} M)`,
  tradePreviewTitle: (avg, spot) => `Ø ${avg} M/Einheit (aktuell ${String(spot)} M)`,

  setDestination: 'Ziel festlegen',
  criticalDamageNote: (name, durability) =>
    `⚠️ ${name} ist schwer beschädigt (${String(durability)}/100) und kann nicht auslaufen. Repariert es in einer Werft, bevor ihr in See sticht.`,
  repairCooldownNote: (name) => `⚠️ ${name} liegt noch im Trockendock zur Reparatur und kann diese Runde nicht auslaufen.`,
  cancel: 'abbrechen',
  stayInPortNote: 'Dieses Schiff bleibt im Hafen, bis ihr Segelbefehle erteilt.',
  shipAtSea: (name) => `${name} ist auf See`,
  atSea: 'Marktpreise zur Orientierung:',
  atSeaNote: (name) => `${name} ist auf See — wählt ein Schiff im Hafen, um Segelbefehle zu erteilen.`,
  sailingNote: (from, to, turns) => `Unterwegs ${from} → ${to} · noch ${String(turns)} Runde(n).`,
  durLabel: 'Zustand',
  cargoLabel: 'Ladung',
  cargoUsedByCannons: (n) => ` (${String(n)} durch Kanonen belegt)`,
  ordersDepart: '⚓ Befehl: Auslaufen nach',
  turnsSuffix: (turns) => `(${String(turns)} Runde${turns === 1 ? '' : 'n'}), sobald ihr die Runde beendet.`,

  shipyard: 'Werft',
  shipName: 'Schiffsname:',
  rename: 'Umbenennen',
  fullySeaworthy: 'Voll seetüchtig.',
  repairTo: (durability, cost) => `Volle Reparatur (${String(durability)}/100) für ${String(cost)} Mark.`,
  repair: 'Reparieren',
  crewLine: (crew, max, hireCost, wage) =>
    `Besatzung: ${String(crew)}/${String(max)} · ${String(hireCost)} Mark zum Anheuern, ${String(wage)} Mark/Matrose/Runde Lohn.`,
  underCrewed: '(unterbesetzt, +1 Runde Reisezeit)',
  cannonLine: (cannons, max, price, sellValue) =>
    `Kanonen: ${String(cannons)}/${String(max)} (−${String(cannons * 2)} Last Ladung) · ${String(price)} Mark zum Kauf, ${String(sellValue)} Mark beim Verkauf.`,
  postureLine: 'Haltung bei Piratenangriff:',
  auctionLine: (price, base, durability) =>
    `Dieses Schiff an den Höchstbietenden versteigern für ${String(price)} Mark (${String(base)} Mark Grundpreis × 80% × ${String(durability)}/100 Zustand).`,
  auction: 'Versteigern',
  noShipyardNote: (here, cities) => `${here} hat keine Werft. Reparaturen und neue Schiffe gibt es in ${cities}.`,
  selectShipForShipyard: 'Wählt ein Schiff, das sich gerade im Hafen befindet, um die Werft zu nutzen.',
  fleetMax: (max) => `Die Flotte hat die Höchstzahl von ${String(max)} Schiffen erreicht.`,
  buyShipBtn: (name) => `${name} kaufen`,

  churchOf: (city) => `Kirche von ${city}`,
  churchComplete: '% fertiggestellt',
  churchPledgedNote: (mark, turns) => `${String(mark)} Mark gestiftet, es fließen bis zu 1% pro Runde ein (~noch ${String(turns)} Runde${turns === 1 ? '' : 'n'}).`,
  churchDoneNote: '⛪ Diese Kirche ist vollständig erbaut, auch dank eurer Großzügigkeit.',
  donate: 'Spenden',
  churchHint: (city) => `500 Mark ≈ 1% Baufortschritt (fließt allmählich ein, bis zu 1%/Runde) · 1000 Mark ≈ 1 Ansehen in ${city} (sofort).`,

  countingHouse: 'Kontor',
  loanActive: (amount, rate) => `Offener Kredit: ${String(amount)} Mark, verzinst sich mit ${String(rate)}% pro Runde.`,
  repay: 'Tilgen',
  loanNone: (cap, rate) => `Kein aktiver Kredit. Leiht euch bis zu ${String(cap)} Mark, jederzeit rückzahlbar, zu ${String(rate)}% Zinseszins pro Runde.`,
  borrow: 'Leihen',
  shipInsurance: 'Schiffsversicherung',
  insuranceHint: (premium, payoutPct) => `${String(premium)} Mark/Runde je versichertem Schiff · zahlt ${String(payoutPct)}% des Sturmschadens oder verlorener Ladung.`,
  insured: 'Versichert',
  notInsured: 'Nicht versichert',
  insure: 'Versichern',
  cancelInsurance: 'Kündigen',

  warehouseOf: (city) => `Lagerhausviertel von ${city}`,
  ownedHere: (owned, max, income) => `Hier im Besitz: ${String(owned)}/${String(max)} · jedes bringt ${String(income)} Mark/Runde, keine Unterhaltskosten.`,
  sellFor: (mark) => `Verkaufen (${String(mark)} Mark)`,
  buyFor: (mark) => `Kaufen (${String(mark)} Mark)`,

  townHall: 'Rathaus',
  currentRank: 'Aktueller Rang:',
  nextRank: (label) => `Nächster Rang: ${label}`,
  topRankNote: 'Ihr habt den höchsten Rang erreicht: Bürgermeister von Lübeck.',
  cityStatus: (city) => `Stadtstatus — ${city}`,
  population: (n) => `Einwohner: ${n}`,
  reputation: (n) => `Ansehen: ${String(n)}`,
  reputationInCity: (city) => `Ansehen in ${city}`,
  noActiveEffects: 'Keine aktiven Effekte.',
  supplyDemandHeading: 'Angebot & Nachfrage',
  effectEmbargo: (good, turns) => `⚖️ Embargo auf ${good} (noch ${String(turns)} Runde${turns === 1 ? '' : 'n'})`,
  effectPlague: (turns) => `☠️ Pest (noch ${String(turns)} Runde${turns === 1 ? '' : 'n'})`,
  effectBoom: (good, turns) => `📈 Handelsboom bei ${good} (noch ${String(turns)} Runde${turns === 1 ? '' : 'n'})`,

  merchantsHouse: 'Kaufmannshaus',
  playerStatusLine: (name, age, health, marital) => `${name} · Alter ${String(age)} · Gesundheit ${String(health)} · ${marital}`,
  traitsLabel: 'Eigenschaften',
  marriedTo: (title, age) => `Verheiratet mit ${title} (Alter ${String(age)}).`,
  seekMarriageOffer: (title, cost) => `Um die Hand von ${title} anhalten für ${String(cost)} Mark.`,
  seekMarriage: 'Um Hand anhalten',
  tooYoungToMarry: (min) => `Zu jung zum Heiraten (Mindestalter ${String(min)}).`,
  childrenLabel: 'Kinder',
  noChildren: 'Noch keine Kinder.',
  age: 'Alter',
  health: 'Gesundheit',
  heirEligible: 'Erbberechtigt',
  hireTutor: (cost) => `Hauslehrer anstellen (${String(cost)} Mark)`,
  tutored: 'Unterrichtet',

  comingSoon: 'Demnächst — dieses Gebäude ist noch nicht mit Funktionen verknüpft.',

  harbor: 'Hafen',
  fleetLabel: (count, max) => `Flotte (${String(count)}/${String(max)})`,
  portOf: (city) => `Hafen von ${city}`,
  expandFleetPanel: 'Flottenpanel ausklappen',
  collapseFleetPanel: 'Flottenpanel einklappen',
  noShipSelected: 'Kein Schiff ausgewählt.',

  endTurn: 'Runde beenden →',
  resolving: 'Wird ausgeführt...',
  chooseHeirFirst: 'Erst einen Erben wählen',

  shipAuction: (date) => `⚖️ Schiffsversteigerung — ${date}`,
  soldTo: (name, price) => `${name} wurde an den Höchstbietenden verkauft für ${String(price)} Mark.`,

  passedAway: (name) => `⚱️ ${name} ist verstorben`,
  successionPrompt: (age) => `Im Alter von ${String(age)}, mit mehr als einem erbfähigen Kind. Wählt, wer das Familiengeschäft übernimmt:`,
  choose: (name) => `${name} wählen`,

  victory: 'Sieg!',
  victoryText: (net) => `Ihr habt ${String(net)} Mark angehäuft und das Erbe eurer Familie gesichert. Das Spiel geht weiter — handelt weiter oder zieht euch hier zurück.`,
  turnSummary: (n) => `Zusammenfassung Runde ${String(n)}`,
  quietTurn: 'Eine ruhige Runde — nichts Ungewöhnliches geschah.',
  netWorthLabel: (net) => `Nettovermögen: ${String(net)} Mark`,
  continuePlaying: 'Weiterspielen →',
  retirePlayAgain: 'Zurückziehen & neu spielen',
  continueBtn: 'Weiter →',

  dynastyEnded: 'Die Dynastie ist erloschen',
  dynastyEndedText: (name, net) => `${name} ist verstorben, ohne einen Erben im passenden Alter zu hinterlassen, der das Familiengeschäft fortführen könnte. Endgültiges Nettovermögen: ${String(net)} Mark.`,
  timesUp: 'Die Zeit ist um',
  timesUpText: (net) => `Der Handelswind hat sich gegen euch gewandt. Endgültiges Nettovermögen: ${String(net)} Mark.`,
  bankrupt: 'Bankrott',
  bankruptText: (net) => `Das Handelshaus ist untergegangen. Endgültiges Nettovermögen: ${String(net)} Mark.`,
  playAgain: 'Neues Spiel',

  err: {
    buy: 'Kauf nicht möglich.', sell: 'Verkauf nicht möglich.', buyShip: 'Schiffskauf nicht möglich.',
    repairShip: 'Reparatur nicht möglich.', auctionShip: 'Versteigerung nicht möglich.',
    setPosture: 'Haltung kann nicht geändert werden.', renameShip: 'Umbenennen nicht möglich.',
    hireCrew: 'Anheuern nicht möglich.', releaseCrew: 'Entlassen nicht möglich.',
    buyCannon: 'Kanonenkauf nicht möglich.', sellCannon: 'Kanonenverkauf nicht möglich.',
    insurance: 'Versicherung kann nicht geändert werden.', buyWarehouse: 'Lagerhauskauf nicht möglich.',
    sellWarehouse: 'Lagerhausverkauf nicht möglich.', marriage: 'Heirat momentan nicht möglich.',
    heir: 'Dieser Erbe kann nicht gewählt werden.', tutor: 'Hauslehrer momentan nicht verfügbar.',
    loan: 'Kredit nicht möglich.', repay: 'Tilgung nicht möglich.', donate: 'Spende nicht möglich.',
    saveFile: 'Diese Speicherdatei konnte nicht geladen werden.',
  },
};

export const TRANSLATIONS: Record<Locale, Translation> = { en, de };
