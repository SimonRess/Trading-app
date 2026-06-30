# Game Mechanics

Inspired by Hanse – Die Expedition (1994, Ascon). This document describes the core mechanics to implement, organized by system.

---

## 1. Core Goal

The player starts as a small merchant in Lübeck with one ship and limited funds. The long-term goal is to become **Mayor of Lübeck** by accumulating wealth, reputation, and political influence. The game spans multiple in-game generations.

---

## 2. Turn Structure

Each turn represents a **season** (Spring, Summer, Autumn, Winter). On each turn the player:

1. Issues orders (sail to a city, buy/sell goods, hire crew, open a store, etc.)
2. Ends the turn
3. The game resolves: ships sail, markets update, events trigger, family ages

---

## 3. Trade System

### Goods
Each city produces and consumes different goods. Supply/demand drives prices — high supply lowers price, high demand raises it.

Example goods:
| Good | Primary Source Cities |
|------|-----------------------|
| Wool | England, Bruges |
| Furs | Novgorod, Riga |
| Honey & Wax | Novgorod, Krakow |
| Herring | Malmö, Bergen |
| Timber | Riga, Danzig |
| Cloth | Bruges, London |
| Salt | Lübeck, Hamburg |
| Wine | Cologne, Hamburg |
| Grain | Danzig, Stettin |

### Buying & Selling
- Prices fluctuate each turn based on supply, demand, and random events
- The player negotiates with the local merchant guild (represented by a portrait NPC dialog)
- Bulk purchases may trigger a price increase mid-transaction

### Stores
- The player can open a permanent store in a city
- Stores hold inventory between visits and can be managed by a hired agent
- Agents have a loyalty/skill rating that affects how well they manage the store unsupervised

---

## 4. Fleet Management

### Ships
Ships have stats:
- **Cargo capacity** (last, a unit of volume)
- **Speed** (affects turns to travel between cities)
- **Durability** (degrades through storms and combat; repaired at a shipyard)
- **Crew requirement** (minimum sailors to sail; more crew = faster)

Ship types (examples):
| Type | Capacity | Speed | Notes |
|------|----------|-------|-------|
| Kogge | 50 last | Slow | Workhorse of the Hanse |
| Hulk | 100 last | Very slow | Large cargo hauler |
| Schnigge | 20 last | Fast | Good for short routes |

### Sailing
- Travel between cities takes a number of turns based on distance and ship speed
- Storms can damage ships or delay arrival (seasonal probability — higher in Winter)
- Ships travel one leg at a time; the player plots the next destination when the ship arrives

---

## 5. Combat

Triggered when a ship is intercepted by pirates or a rival city's fleet.

### Mechanics
- Player places **cannons** on a grid representing the ship's deck
- Combat resolves automatically based on cannon placement, crew count, and enemy strength
- Outcomes: victory (capture enemy cargo), flight (lose some cargo), defeat (ship sunk or captured)
- Captured pirates can be ransomed or handed to city authorities for reputation gain

---

## 6. Family & Generational Play

### Marriage
- The player can court and marry a woman from a noble or merchant family
- Marriage brings a one-time dowry and may unlock trade connections in her home city
- Spouse's family background affects social standing

### Children
- Children are born over time; each has randomized base stats (intelligence, charisma, health)
- The player must hire **tutors** to educate children, improving their stats
- Educated children can be assigned roles:
  - **Heir** — takes over the trading empire on the player's death
  - **Captain** — commands a ship
  - **Agent** — manages a store in a city
  - **Explorer** — sent on an expedition to discover new trade cities

### Expeditions
- An expedition takes several turns and has a success probability based on the child's stats and equipped supplies
- Success: a new city is added to the map, unlocking new trade routes
- Failure: the child is lost or returns empty-handed

### Death & Inheritance
- The player character ages and eventually dies
- One child must be present in Lübeck at the time of death to inherit the estate
- If no heir is in Lübeck, assets are partially lost
- The player continues as the heir character

---

## 7. City Relations & Reputation

### Reputation Score
Each city tracks the player's reputation (0–100). It rises through:
- Completing trade deals
- Donating to the city (church, fortifications)
- Handing over pirates
- Paying debts on time

It falls through:
- Defaulting on loans
- Smuggling
- Undercutting the local guild's prices aggressively

### Political Standing in Lübeck
A separate track toward becoming Mayor. Milestones:
1. Citizen
2. Guild Member
3. Council Seat
4. Mayor (win condition)

Each milestone requires minimum wealth, reputation, and age.

---

## 8. Banking & Finance

### Loans
- The player can take loans from the city bank
- Loans have a fixed term (in turns) and interest rate
- Missing a repayment damages reputation; default triggers legal consequences (assets seized)

### Insurance
- Ships and cargo can be insured at a premium
- Insured ships that sink are reimbursed at a percentage of value

---

## 9. Random Events

Events trigger at turn end and create dynamic situations:

| Event | Effect |
|-------|--------|
| Storm | Ship delayed or damaged |
| Plague in city | Trade suspended for 1–3 turns; goods prices spike |
| City fire | A store is damaged; repair cost required |
| Bumper harvest | Grain price drops sharply |
| War between cities | Certain trade routes blocked |
| Guild dispute | Forced to choose a side; affects relations with both cities |
| Pirate raid on a city | Coastal city goods are scarcer |
| Rival merchant | An NPC competitor undercuts your prices in a city |

---

## 10. Win & Lose Conditions

### Win
- Reach the rank of **Mayor of Lübeck** within a set number of generations

### Lose (soft)
- Bankruptcy: no money, no ships, no stores, no heir — game over
- Dying without an heir in Lübeck: estate is lost, game over

### Scoring
At game end, a score is calculated from: total wealth, number of cities with stores, reputation in Lübeck, generations played, and discoveries made.
