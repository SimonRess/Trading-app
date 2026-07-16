import { describe, it, expect } from 'vitest';
import { advanceCalendar } from './calendar-system.ts';
import type { CalendarState } from '../state/types.ts';

const base: CalendarState = { year: 1320, season: 'spring', turn: 1, maxTurns: 40 };

describe('advanceCalendar', () => {
  it('advances spring to summer', () => {
    expect(advanceCalendar({ ...base, season: 'spring' }).season).toBe('summer');
  });

  it('advances winter to spring and increments year', () => {
    const result = advanceCalendar({ ...base, season: 'winter', year: 1320 });
    expect(result.season).toBe('spring');
    expect(result.year).toBe(1321);
  });

  it('increments turn counter', () => {
    expect(advanceCalendar({ ...base, turn: 5 }).turn).toBe(6);
  });

  it('does not mutate input', () => {
    const cal = { ...base };
    advanceCalendar(cal);
    expect(cal.season).toBe('spring');
  });
});
