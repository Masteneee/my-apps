import { describe, it, expect } from 'vitest';
import BlockerCounter from '../src/counter.js';

const { localDayKey, countsForDay, addBlocked } = BlockerCounter;

describe('localDayKey', () => {
  it('formats the local date as YYYY-MM-DD with leading zeros', () => {
    // new Date(year, monthIndex, day) uses LOCAL time; months start at 0.
    expect(localDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localDayKey(new Date(2026, 10, 4))).toBe('2026-11-04');
  });

  it('uses the local day even late at night (no UTC jump to tomorrow)', () => {
    expect(localDayKey(new Date(2026, 10, 4, 23, 59))).toBe('2026-11-04');
    expect(localDayKey(new Date(2026, 10, 5, 0, 0))).toBe('2026-11-05');
  });
});

describe('countsForDay', () => {
  it('starts at zero when nothing is saved yet (first run)', () => {
    expect(countsForDay(undefined, '2026-11-04')).toEqual({
      day: '2026-11-04',
      today: 0,
      allTime: 0,
    });
  });

  it('keeps both counts on the same day', () => {
    const saved = { day: '2026-11-04', today: 3, allTime: 50 };
    expect(countsForDay(saved, '2026-11-04')).toEqual(saved);
  });

  it('resets "today" on a new day but keeps "all time"', () => {
    const saved = { day: '2026-11-03', today: 7, allTime: 50 };
    expect(countsForDay(saved, '2026-11-04')).toEqual({
      day: '2026-11-04',
      today: 0,
      allTime: 50,
    });
  });

  it('turns broken saved values into 0 instead of crashing', () => {
    const junk = { day: '2026-11-04', today: 'lots', allTime: -5 };
    expect(countsForDay(junk, '2026-11-04')).toEqual({ day: '2026-11-04', today: 0, allTime: 0 });
    expect(countsForDay('not an object', '2026-11-04').allTime).toBe(0);
    expect(countsForDay({ day: '2026-11-04', today: 2.5, allTime: NaN }, '2026-11-04').today).toBe(0);
  });
});

describe('addBlocked', () => {
  it('adds to both counts', () => {
    const saved = { day: '2026-11-04', today: 3, allTime: 50 };
    expect(addBlocked(saved, 2, '2026-11-04')).toEqual({
      day: '2026-11-04',
      today: 5,
      allTime: 52,
    });
  });

  it('starts "today" from zero on a new day', () => {
    const saved = { day: '2026-11-03', today: 9, allTime: 50 };
    expect(addBlocked(saved, 1, '2026-11-04')).toEqual({
      day: '2026-11-04',
      today: 1,
      allTime: 51,
    });
  });

  it('works on the very first block', () => {
    expect(addBlocked(undefined, 1, '2026-11-04')).toEqual({
      day: '2026-11-04',
      today: 1,
      allTime: 1,
    });
  });

  it('ignores amounts that are not a positive whole number', () => {
    const saved = { day: '2026-11-04', today: 3, allTime: 50 };
    expect(addBlocked(saved, -4, '2026-11-04').allTime).toBe(50);
    expect(addBlocked(saved, 'x', '2026-11-04').allTime).toBe(50);
    expect(addBlocked(saved, 1.5, '2026-11-04').allTime).toBe(50);
  });

  it('returns a new object instead of changing the saved one', () => {
    const saved = { day: '2026-11-04', today: 3, allTime: 50 };
    addBlocked(saved, 1, '2026-11-04');
    expect(saved).toEqual({ day: '2026-11-04', today: 3, allTime: 50 });
  });
});
