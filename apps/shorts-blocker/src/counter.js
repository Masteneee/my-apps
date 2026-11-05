// Pure counter logic for "blocked today / all time".
// No chrome.* calls and no DOM here, so Vitest can test it. Same
// globalThis/module.exports trick as url-logic.js (see the top of that file).
//
// What is stored (in chrome.storage.local, under COUNTS_KEY):
//   { day: "2026-11-04", today: 12, allTime: 340 }
// "today" only means something together with "day": if the saved day is not
// today's date anymore, today's count starts again from 0.

(function () {
  const COUNTS_KEY = 'blockedCounts';

  // "2026-11-04" for the LOCAL date (your computer's time zone), not UTC.
  // Why not date.toISOString()? That gives the UTC date, so in Montreal the
  // "today" counter would reset at 7 or 8 PM instead of at midnight.
  function localDayKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // months start at 0
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // A count must be a whole number, 0 or more. Anything else (missing, text,
  // negative, NaN) becomes 0, so a bad saved value can't break the popup.
  function cleanCount(value) {
    return Number.isInteger(value) && value >= 0 ? value : 0;
  }

  // Takes whatever was stored and returns clean counts for `todayKey`.
  // If the saved day is another day (yesterday, or nothing saved yet),
  // "today" goes back to 0 but "all time" is kept.
  function countsForDay(stored, todayKey) {
    const safe = stored && typeof stored === 'object' ? stored : {};
    const sameDay = safe.day === todayKey;
    return {
      day: todayKey,
      today: sameDay ? cleanCount(safe.today) : 0,
      allTime: cleanCount(safe.allTime),
    };
  }

  // Returns NEW counts with `amount` more blocked items (old object untouched).
  // Amounts that aren't a positive whole number add nothing.
  function addBlocked(stored, amount, todayKey) {
    const counts = countsForDay(stored, todayKey);
    const add = cleanCount(amount);
    return {
      day: todayKey,
      today: counts.today + add,
      allTime: counts.allTime + add,
    };
  }

  const BlockerCounter = {
    COUNTS_KEY,
    localDayKey,
    countsForDay,
    addBlocked,
  };

  globalThis.BlockerCounter = BlockerCounter;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlockerCounter;
  }
})();
