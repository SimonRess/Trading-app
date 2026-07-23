import { describe, it, expect } from 'vitest';
import {
  durabilityStatus,
  durabilityStormChancePenalty,
  durabilityTravelTimePenalty,
  canDepart,
  shipNetWorth,
  repairCost,
  speedRatio,
  SHIP_TYPES,
  CREW_MAX,
  defaultCrew,
  isUndercrewed,
  crewTravelTimePenalty,
} from './ships.ts';

describe('durabilityStatus', () => {
  it('classifies each threshold band', () => {
    expect(durabilityStatus(100)).toBe('seaworthy');
    expect(durabilityStatus(76)).toBe('seaworthy');
    expect(durabilityStatus(75)).toBe('worn');
    expect(durabilityStatus(51)).toBe('worn');
    expect(durabilityStatus(50)).toBe('damaged');
    expect(durabilityStatus(26)).toBe('damaged');
    expect(durabilityStatus(25)).toBe('critical');
    expect(durabilityStatus(1)).toBe('critical');
    expect(durabilityStatus(0)).toBe('wrecked');
  });
});

describe('durabilityStormChancePenalty', () => {
  it('is 0 when seaworthy', () => {
    expect(durabilityStormChancePenalty(100)).toBe(0);
  });
  it('is 0.05 when worn', () => {
    expect(durabilityStormChancePenalty(60)).toBe(0.05);
  });
  it('is 0.10 when damaged', () => {
    expect(durabilityStormChancePenalty(30)).toBe(0.1);
  });
});

describe('durabilityTravelTimePenalty', () => {
  it('is 0 unless damaged', () => {
    expect(durabilityTravelTimePenalty(100)).toBe(0);
    expect(durabilityTravelTimePenalty(60)).toBe(0);
    expect(durabilityTravelTimePenalty(10)).toBe(0);
  });
  it('is 1 when damaged', () => {
    expect(durabilityTravelTimePenalty(30)).toBe(1);
  });
});

describe('canDepart', () => {
  it('allows seaworthy, worn, and damaged ships to depart', () => {
    expect(canDepart(100)).toBe(true);
    expect(canDepart(60)).toBe(true);
    expect(canDepart(30)).toBe(true);
  });
  it('blocks critical and wrecked ships', () => {
    expect(canDepart(25)).toBe(false);
    expect(canDepart(1)).toBe(false);
    expect(canDepart(0)).toBe(false);
  });
});

describe('shipNetWorth', () => {
  it('scales linearly with durability', () => {
    expect(shipNetWorth(400, 100)).toBe(400);
    expect(shipNetWorth(400, 25)).toBe(100);
    expect(shipNetWorth(400, 0)).toBe(0);
  });
});

describe('repairCost', () => {
  it('is proportional to missing durability', () => {
    expect(repairCost({ type: 'kogge', durability: 100 })).toBe(0);
    expect(repairCost({ type: 'kogge', durability: 60 })).toBe(80);
  });
});

describe('speedRatio', () => {
  it('is exactly 1.0 for the Kogge (route.turns is Kogge-calibrated)', () => {
    expect(speedRatio('kogge')).toBe(1);
  });
  it('is 1.5 for the Hulk (slower)', () => {
    expect(speedRatio('hulk')).toBe(1.5);
  });
  it('is 0.5 for the Schnigge (faster)', () => {
    expect(speedRatio('schnigge')).toBe(0.5);
  });
});

describe('defaultCrew', () => {
  it('is half of each type\'s max, rounded', () => {
    expect(defaultCrew('kogge')).toBe(4);
    expect(defaultCrew('hulk')).toBe(6);
    expect(defaultCrew('schnigge')).toBe(3);
  });
});

describe('isUndercrewed', () => {
  it('is true below half of max', () => {
    expect(isUndercrewed('kogge', 3)).toBe(true);
  });
  it('is false at or above half of max', () => {
    expect(isUndercrewed('kogge', 4)).toBe(false);
    expect(isUndercrewed('kogge', 8)).toBe(false);
  });
});

describe('crewTravelTimePenalty', () => {
  it('is 0 when adequately crewed', () => {
    expect(crewTravelTimePenalty('kogge', 8)).toBe(0);
    expect(crewTravelTimePenalty('kogge', 4)).toBe(0);
  });
  it('is 1 when under-crewed', () => {
    expect(crewTravelTimePenalty('kogge', 3)).toBe(1);
    expect(crewTravelTimePenalty('kogge', 0)).toBe(1);
  });
});

describe('CREW_MAX', () => {
  it('scales roughly with cargo capacity', () => {
    expect(CREW_MAX.hulk).toBeGreaterThan(CREW_MAX.kogge);
    expect(CREW_MAX.kogge).toBeGreaterThan(CREW_MAX.schnigge);
  });
});

describe('SHIP_TYPES', () => {
  it('defines all three MVP ship types with distinct capacity/price', () => {
    expect(SHIP_TYPES.kogge.cargoCapacity).toBe(50);
    expect(SHIP_TYPES.hulk.cargoCapacity).toBe(100);
    expect(SHIP_TYPES.schnigge.cargoCapacity).toBe(20);
    expect(SHIP_TYPES.hulk.purchasePrice).toBeGreaterThan(SHIP_TYPES.kogge.purchasePrice);
    expect(SHIP_TYPES.schnigge.purchasePrice).toBeLessThan(SHIP_TYPES.kogge.purchasePrice);
  });
});
