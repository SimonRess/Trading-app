# Design: MVP Scope

**Status:** Draft  
**Last updated:** 2026-07-13

## Purpose

Define the smallest playable version of the game that validates the core loop. The MVP is not a demo — it is the first releasable build that a player can sit down with and experience the fundamental tension of the game: find profitable trade routes, grow a fleet, accumulate wealth. Everything else is layered on top in subsequent versions.

**The test for whether something belongs in MVP:** Can the core trade loop be played, enjoyed, and balanced without it? If yes, it is post-MVP.

---

## What the MVP Must Prove

1. The trade loop is fun — buying low, sailing, selling high, reinvesting profit
2. The market feels alive — prices shift in ways that create decisions
3. The sailing map feels meaningful — route choice and travel time matter
4. The game has a visible progression arc — the player can see themselves getting richer or poorer
5. The game can reach an end state — win, lose, or run out of meaningful moves

---

## In Scope for MVP

### Cities — 5 cities
A minimal but geographically meaningful slice of the Hanseatic world.

| City | Role |
|------|------|
| Lübeck | Starting city; political home base |
| Hamburg | Western hub; wine and salt |
| Danzig | Eastern hub; grain and timber |
| Riga | Far north-east; furs |
| Malmö | North; herring |

Five cities give the player three to five viable trade routes with meaningfully different travel times.

### Goods — 5 goods
One per city as the primary export; all cities buy all goods at varying prices.

| Good | Primary source |
|------|---------------|
| Salt | Lübeck / Hamburg |
| Grain | Danzig |
| Timber | Danzig / Riga |
| Furs | Riga |
| Herring | Malmö |

### Ships — 1 type
**Kogge only.** 50 last cargo capacity, slow speed. The player starts with one and can buy more. Multiple ship types are post-MVP.

### Fleet
- Player starts with 1 Kogge
- Can buy additional Kogges (max 3 in MVP to keep balance manageable)
- Ships have cargo capacity and durability only — crew and speed modifiers are post-MVP

### Trade System
- Buy and sell goods at each city at the current market price
- Prices fluctuate each turn based on a supply/demand formula (see design/market-formula.md when created)
- No stores, no agents, no bulk-purchase price bumps — direct buy/sell only

### Sailing
- Player assigns a destination to each ship per turn
- Travel takes 1–3 turns depending on route distance (see design/city-graph.md when created)
- Ships arrive at the start of the turn after the required travel turns elapse

### Turn Structure
- Each turn = one season (Spring / Summer / Autumn / Winter)
- Player phase: assign ship destinations, buy/sell at current city, end turn
- Resolution phase: ships move one leg, market prices update, one random event may trigger

### Random Events — 3 events only
The minimum to make the world feel unpredictable.

| Event | Effect |
|-------|--------|
| Storm | All ships in transit take 10 durability damage |
| Bumper harvest | Grain supply in Danzig +30 (price collapses toward floor) |
| Pirate raid | One random ship loses 15% of its cargo proportionally |

### Win / Lose Conditions
- **Win:** Accumulate 10,000 Mark within 40 turns (10 years)
- **Lose:** Net worth (cash + ship value) drops to zero, or 40 turns elapse without reaching the win threshold
- No generational play, no Mayor track — those are post-MVP

### Starting State
- Player name: entered at new game screen
- Starting city: Lübeck
- Starting cash: 500 Mark
- Starting fleet: 1 Kogge (50 last capacity, 100 durability)
- Starting cargo: 20 last of Salt (worth ~200 Mark at market)
- Starting turn: Spring, Year 1

### UI Screens Required
1. **New game** — name entry, brief intro text
2. **Map view** — 5 cities on a stylised North Sea / Baltic map; player's ships shown with current position or route
3. **Port view** — current city; buy/sell panel with current prices; option to set next destination
4. **End turn summary** — what happened this turn (ships moved, event triggered, market shifted)
5. **Game over** — win or lose screen with final score (total wealth accumulated)

---

## Explicitly Out of Scope for MVP

| Feature | Target version |
|---------|---------------|
| Multiple ship types (Hulk, Schnigge) | v1.1 |
| Stores & agents in cities | v1.1 |
| Bulk-purchase price pressure | v1.1 |
| Crew management | v1.1 |
| Ship repair / shipyard | v1.1 |
| Banking & loans | v1.1 |
| Insurance | v1.1 |
| City reputation system | v1.1 |
| Political milestones / Mayor track | v2 |
| Family, marriage, children | v2 |
| Generational inheritance | v2 |
| Expeditions & city discovery | v2 |
| Combat (pirates, rival fleets) | v2 |
| Full random event table (8 events) | v1.1 |
| NPC portrait dialogs | v1.1 |
| Audio / music | v1.1 |
| Save / load | v1.1 |
| Hotseat multiplayer | v3 |

---

## MVP Definition of Done

The MVP is complete when:

- [ ] A new game can be started with the defined starting state
- [ ] The player can buy and sell all 5 goods in all 5 cities
- [ ] Ships sail between cities and arrive after the correct number of turns
- [ ] Market prices shift each turn and respond to the supply/demand formula
- [ ] At least 3 random events can trigger and visibly affect game state
- [ ] The game reaches a win or lose screen at turn 40 or when the wealth threshold is hit
- [ ] The full turn loop (player phase → resolution → summary) runs without errors
- [ ] All game logic in `src/game/` has unit test coverage for the happy path

---

## Open Questions

- What is the exact price range for each good at each city? (Blocks design/market-formula.md)
- What are the turn distances between each city pair? (Blocks design/city-graph.md)
- Is 10,000 Mark in 40 turns the right win threshold, or does it need playtesting to calibrate?
- Should the player see all city prices on the map view, or only discover them by visiting?

## Related

- ADR-006 (Turn-based gameplay — defines the turn structure this MVP is built on)
- ADR-007 (Multiplayer — single-player only for MVP, confirmed)
- docs/design/game-mechanics.md (full feature design; MVP is a strict subset)
- docs/design/market-formula.md (missing — blocks trade system implementation)
- docs/design/city-graph.md (missing — blocks sailing implementation)
