import type { CalendarState, Season } from '../state/types.ts';

const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export function advanceCalendar(calendar: CalendarState): CalendarState {
  const idx = SEASON_ORDER.indexOf(calendar.season);
  const nextIdx = (idx + 1) % 4;
  const nextSeason = SEASON_ORDER[nextIdx] as Season;
  const nextYear = nextIdx === 0 ? calendar.year + 1 : calendar.year;
  return {
    ...calendar,
    season: nextSeason,
    year: nextYear,
    turn: calendar.turn + 1,
  };
}
