import { describe, it, expect } from 'vitest';
import {
  durabilityStatus,
  durabilityStormChancePenalty,
  durabilityTravelTimePenalty,
  canDepart,
  shipNetWorth,
  repairCost,
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
