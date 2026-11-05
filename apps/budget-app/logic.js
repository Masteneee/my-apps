// logic.js: pure functions only.
// "Pure" means: they take inputs and return an output. They never touch the page
// (the DOM) or localStorage. That is what makes them easy to test in tests.js.
//
// All money is in CENTS, as whole numbers (1250 means $12.50).
// Computers store decimals like 0.1 slightly wrong, so 0.1 + 0.2 gives
// 0.30000000000000004. Whole numbers never have that problem.

// ---------- Categories ----------

// Expense categories, in the order the buttons appear on the page.
const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Fun', 'School', 'Bills', 'Other'];

// Income categories (task 1.4): job pay, gifts, anything else.
const INCOME_CATEGORIES = ['Job', 'Gift', 'Other'];

// A small picture for each category, so the list is easy to scan.
const CATEGORY_ICONS = {
  Food: '🍔',
  Transport: '🚌',
  Fun: '🎉',
  School: '📚',
  Bills: '🧾',
  Other: '✨',
  Job: '💼',
  Gift: '🎁',
};

// One calm colour per expense category (task 2.1), used by the chart AND by
// the bars in the "Where it went" list, so the list works as the chart's legend.
// No red on purpose: spending isn't an emergency.
const CATEGORY_COLORS = {
  Food: '#2f6f6a',      // teal
  Transport: '#4a7fb0', // blue
  Fun: '#8a6bb8',       // purple
  School: '#c49a3a',    // sand
  Bills: '#6b7b85',     // slate grey
  Other: '#8fb8a8',     // sage
};
const FALLBACK_COLOR = '#9cc5bf'; // for a category we don't know (shouldn't happen)

// Returns the list of category names for 'expense' or 'income'.
function categoriesFor(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

// ---------- Money ----------

// The biggest amount we accept in one entry: $1,000,000. Anything bigger is
// almost surely a typo (an extra zero or two).
const MAX_AMOUNT_CENTS = 100000000;

// Turns what the person typed into whole cents, or null if it isn't a valid amount.
// Accepts "12", "12.5", "12,50" (Quebec style), "$12", "12 $" and "1 234,56".
// We never use parseFloat(text) * 100 because 0.29 * 100 = 28.999999999999996.
// Instead we split the text into the dollars part and the cents part, as text.
function parseAmountToCents(text) {
  if (typeof text !== 'string') return null;

  // Remove dollar signs and every kind of space (\s also matches the special
  // non-breaking space that French keyboards and copy-paste sometimes insert).
  const cleaned = text.replace(/[$\s]/g, '');

  // Allowed shape: some digits, then optionally ONE "." or "," and 0 to 2 digits.
  // ^ and $ mean "the whole text must match", not just part of it.
  const match = cleaned.match(/^(\d*)(?:[.,](\d{0,2}))?$/);
  if (match === null) return null;

  const dollarsText = match[1];
  const centsText = match[2] || '';
  if (dollarsText === '' && centsText === '') return null; // empty, or only "$" / "."

  // "5" after the separator means 50 cents, not 5 cents, so pad it to 2 digits.
  const cents = Number(dollarsText || '0') * 100 + Number(centsText.padEnd(2, '0'));

  if (cents <= 0 || cents > MAX_AMOUNT_CENTS) return null;
  return cents;
}

// 1250 -> "$12.50", 123456 -> "$1,234.56", -500 -> "-$5.00"
function formatCents(cents) {
  const sign = cents < 0 ? '-' : '';
  const positive = Math.abs(cents);
  const dollars = Math.floor(positive / 100);
  const rest = positive % 100;
  // toLocaleString('en-US') adds the thousands commas: 1234 -> "1,234".
  return sign + '$' + dollars.toLocaleString('en-US') + '.' + String(rest).padStart(2, '0');
}

// 1250 -> "12.50". Used to fill the amount box when editing an entry.
function centsToInputValue(cents) {
  const dollars = Math.floor(cents / 100);
  const rest = cents % 100;
  return dollars + '.' + String(rest).padStart(2, '0');
}

// ---------- Dates ----------
// Dates are stored as text like "2026-11-05" (year-month-day).
// That format sorts correctly as plain text: "2026-11-05" > "2026-10-31".

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Adds a zero in front of single digits: 5 -> "05".
function twoDigits(number) {
  return String(number).padStart(2, '0');
}

// Today's date as "YYYY-MM-DD" in the person's LOCAL time.
// We don't use new Date().toISOString() because that gives UTC time:
// at 9 pm in Montreal it is already tomorrow in UTC.
function todayISO(now = new Date()) {
  return now.getFullYear() + '-' + twoDigits(now.getMonth() + 1) + '-' + twoDigits(now.getDate());
}

// "2026-11-05" -> "2026-11". Two entries are in the same month if this matches.
function monthKey(isoDate) {
  return isoDate.slice(0, 7);
}

// "2026-11" -> "November 2026"
function monthLabel(key) {
  const year = key.slice(0, 4);
  const monthIndex = Number(key.slice(5, 7)) - 1;
  return MONTH_NAMES[monthIndex] + ' ' + year;
}

// Moves a date by a number of days: addDays("2026-11-01", -1) -> "2026-10-31".
// new Date(year, month, day) fixes overflow for us (day 0 = last day of previous month).
function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return todayISO(new Date(year, month - 1, day + days));
}

// "Today", "Yesterday", or a short date like "Nov 3".
function friendlyDate(isoDate, todayIsoDate) {
  if (isoDate === todayIsoDate) return 'Today';
  if (isoDate === addDays(todayIsoDate, -1)) return 'Yesterday';
  const monthIndex = Number(isoDate.slice(5, 7)) - 1;
  const day = Number(isoDate.slice(8, 10));
  return MONTH_NAMES[monthIndex].slice(0, 3) + ' ' + day;
}

// ---------- Entries ----------
// An entry looks like:
// { id: 'k3x9a', type: 'expense', amountCents: 1250, category: 'Food',
//   note: 'Lunch', date: '2026-11-05', createdAt: 1793900000000 }

// Checks that something loaded from storage really looks like an entry,
// so one broken item can't crash the whole page.
function isValidEntry(entry) {
  return (
    typeof entry === 'object' && entry !== null &&
    typeof entry.id === 'string' && entry.id !== '' &&
    (entry.type === 'expense' || entry.type === 'income') &&
    Number.isInteger(entry.amountCents) && entry.amountCents > 0 &&
    typeof entry.category === 'string' &&
    typeof entry.note === 'string' &&
    typeof entry.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
    typeof entry.createdAt === 'number'
  );
}

// Only the entries whose date is in the given month ("2026-11").
function entriesInMonth(entries, key) {
  return entries.filter((entry) => monthKey(entry.date) === key);
}

// Newest date first. Two entries on the same day: the one added last comes first.
// We copy the array first ([...entries]) because .sort() changes the array it's
// called on, and we don't want to scramble the caller's data by surprise.
function sortNewestFirst(entries) {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.createdAt - a.createdAt;
  });
}

// Returns a NEW list where the entry with this id has the changes applied.
// The id itself can never change.
function updateEntry(entries, id, changes) {
  return entries.map((entry) => (entry.id === id ? { ...entry, ...changes, id: entry.id } : entry));
}

// Returns a NEW list without the entry that has this id.
function deleteEntry(entries, id) {
  return entries.filter((entry) => entry.id !== id);
}

// ---------- Totals ----------

// Money in, money out and what's left, for whatever entries you pass in
// (usually this month's).
function monthTotals(entries) {
  let inCents = 0;
  let outCents = 0;
  for (const entry of entries) {
    if (entry.type === 'income') inCents += entry.amountCents;
    else outCents += entry.amountCents;
  }
  return { inCents, outCents, leftCents: inCents - outCents };
}

// How much went to each expense category, biggest first.
// Returns [{ category: 'Food', cents: 4200, percent: 60 }, ...]
// percent = share of all spending, rounded, used to draw a small bar.
// Categories with nothing spent are left out.
function totalsByCategory(entries) {
  const sums = {};
  let totalOut = 0;
  for (const entry of entries) {
    if (entry.type !== 'expense') continue; // income isn't spending
    sums[entry.category] = (sums[entry.category] || 0) + entry.amountCents;
    totalOut += entry.amountCents;
  }

  const rows = Object.keys(sums).map((category) => ({
    category,
    cents: sums[category],
    percent: Math.round((sums[category] * 100) / totalOut),
  }));

  // Biggest first. On a tie, keep the same order as the category buttons,
  // so the list doesn't jump around randomly.
  rows.sort((a, b) => {
    if (b.cents !== a.cents) return b.cents - a.cents;
    return categoryOrder(a.category) - categoryOrder(b.category);
  });
  return rows;
}

// Position of a category in the button order (unknown ones go last).
function categoryOrder(category) {
  const index = EXPENSE_CATEGORIES.indexOf(category);
  return index === -1 ? EXPENSE_CATEGORIES.length : index;
}

// ---------- 2.1 Chart ----------

// Turns the rows from totalsByCategory into the three lists a chart needs:
// names, amounts and colours, all in the same order (item 0 of each list
// belongs together). Amounts stay in cents; app.js formats them for tooltips.
function chartSlices(rows) {
  return {
    labels: rows.map((row) => row.category),
    cents: rows.map((row) => row.cents),
    colors: rows.map((row) => CATEGORY_COLORS[row.category] || FALLBACK_COLOR),
  };
}

// A sentence describing the chart, for people using a screen reader
// (a chart is a picture, so it needs words too).
function chartDescription(rows) {
  if (rows.length === 0) return 'Nothing spent yet.';
  const parts = rows.map((row) => row.category + ' ' + formatCents(row.cents) + ' (' + row.percent + '%)');
  return 'Spending by category: ' + parts.join(', ') + '.';
}

// ---------- 2.2 Month switcher and comparison ----------

// Moves a month key by some months: shiftMonth("2026-01", -1) -> "2025-12".
// Like addDays, new Date(year, monthIndex, 1) fixes overflow for us
// (month index -1 means December of the year before).
function shiftMonth(key, delta) {
  const year = Number(key.slice(0, 4));
  const monthIndex = Number(key.slice(5, 7)) - 1;
  const date = new Date(year, monthIndex + delta, 1);
  return date.getFullYear() + '-' + twoDigits(date.getMonth() + 1);
}

// The months the switcher can show: from the oldest entry's month to the
// newest one, and always including this month. Month keys compare correctly
// as text ("2026-09" < "2026-11"), so < and > work here.
function monthRange(entries, todayKey) {
  let first = todayKey;
  let last = todayKey; // an entry dated in the future stretches this
  for (const entry of entries) {
    const key = monthKey(entry.date);
    if (key < first) first = key;
    if (key > last) last = key;
  }
  return { first, last };
}

// Keeps a month inside the range (for example after deleting the only entry
// of an old month, that month may no longer be in the range).
function clampMonth(key, range) {
  if (key < range.first) return range.first;
  if (key > range.last) return range.last;
  return key;
}

// What to call the month we compare with: "last month" when looking at this
// month, or "in September" when looking back at October.
function previousMonthName(viewedKey, todayKey) {
  if (viewedKey === todayKey) return 'last month';
  const previousKey = shiftMonth(viewedKey, -1);
  return 'in ' + MONTH_NAMES[Number(previousKey.slice(5, 7)) - 1];
}

// Whole dollars without ".00": 4000 -> "$40", 1250 -> "$12.50".
// Easier to read inside a sentence.
function formatCentsShort(cents) {
  return cents % 100 === 0 ? formatCents(cents).slice(0, -3) : formatCents(cents);
}

// Spending per category in two months, side by side. Expenses only.
// Returns [{ category, cents, previousCents, diffCents }], where diffCents is
// this month minus the other month (below zero = spent less). A category
// shows up if it had spending in EITHER month. Biggest this month first.
function compareCategories(monthEntries, previousEntries) {
  const now = {};
  const before = {};
  for (const entry of monthEntries) {
    if (entry.type === 'expense') now[entry.category] = (now[entry.category] || 0) + entry.amountCents;
  }
  for (const entry of previousEntries) {
    if (entry.type === 'expense') before[entry.category] = (before[entry.category] || 0) + entry.amountCents;
  }

  // Every category that appears in either month, without duplicates.
  // A Set is a list that ignores repeats.
  const categories = new Set([...Object.keys(now), ...Object.keys(before)]);
  const rows = [...categories].map((category) => {
    const cents = now[category] || 0;
    const previousCents = before[category] || 0;
    return { category, cents, previousCents, diffCents: cents - previousCents };
  });

  rows.sort((a, b) => {
    if (b.cents !== a.cents) return b.cents - a.cents;
    if (b.previousCents !== a.previousCents) return b.previousCents - a.previousCents;
    return categoryOrder(a.category) - categoryOrder(b.category);
  });
  return rows;
}

// A calm sentence for a difference: "$40 less than last month",
// "$12.50 more than in September", "the same as last month".
// Just facts, no judging words like "over" or "too much".
function comparisonText(diffCents, otherMonthName) {
  if (diffCents === 0) return 'the same as ' + otherMonthName;
  const word = diffCents < 0 ? ' less than ' : ' more than ';
  return formatCentsShort(Math.abs(diffCents)) + word + otherMonthName;
}

// ---------- 2.3 Hours of work ----------

// The biggest hourly wage we accept: $1,000 an hour (in cents per hour).
// More is almost surely a typo, like an extra zero.
const MAX_HOURLY_WAGE_CENTS = 100000;

// True if this is a wage we can use: whole cents per hour, above zero.
function isValidHourlyWage(wageCents) {
  return Number.isInteger(wageCents) && wageCents > 0 && wageCents <= MAX_HOURLY_WAGE_CENTS;
}

// How long you'd work to earn this amount, as short text:
// "under 1 min", "12 min", "1 h", "1.5 h", "1,250 h". Empty text if no wage is set.
// Integer math only: amount * 60 / wage gives minutes, amount * 10 / wage
// gives tenths of an hour, then Math.round makes them whole numbers.
function workTimeText(amountCents, wageCents) {
  if (!isValidHourlyWage(wageCents)) return '';
  const minutes = Math.round((amountCents * 60) / wageCents);
  if (minutes < 1) return 'under 1 min';
  if (minutes < 60) return minutes + ' min';

  const tenths = Math.round((amountCents * 10) / wageCents); // 15 means 1.5 h
  const wholeHours = Math.floor(tenths / 10);
  const tenth = tenths % 10;
  return wholeHours.toLocaleString('en-US') + (tenth === 0 ? '' : '.' + tenth) + ' h';
}

// ---------- 2.4 Export and import ----------
// A backup file is JSON text shaped like:
// { "app": "pocket-budget", "version": 1, "exportedAt": "2026-11-05T14:03:00.000Z",
//   "hourlyWageCents": 1575, "entries": [ ...entries... ] }
// "app" and "version" let us recognise our own files and refuse anything else.

const BACKUP_APP = 'pocket-budget';
const BACKUP_VERSION = 1;
const MAX_NOTE_LENGTH = 80; // same as maxlength on the note box
const MAX_ID_LENGTH = 64; // our ids are about 13 characters; this is plenty
const MAX_BACKUP_BYTES = 5 * 1024 * 1024; // 5 MB: tens of thousands of entries

// The object we turn into the backup file. exportedAt is passed in (instead of
// calling new Date() here) so the function stays pure and easy to test.
function buildBackup(entries, hourlyWageCents, exportedAt) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt,
    hourlyWageCents: isValidHourlyWage(hourlyWageCents) ? hourlyWageCents : null,
    entries,
  };
}

// "pocket-budget-backup-2026-11-05.json": the date helps find the newest one.
function backupFileName(todayIsoDate) {
  return 'pocket-budget-backup-' + todayIsoDate + '.json';
}

// True for a date that exists on the calendar. "2026-02-30" has the right
// shape but isn't a real day: new Date would quietly turn it into March 2,
// so we check that going through a Date gives back the same text.
function isRealDate(isoDate) {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  return addDays(isoDate, 0) === isoDate;
}

// Checks one entry from a backup file and returns a CLEAN copy, or null if it
// doesn't look right. A file can come from anywhere, so we're stricter than
// isValidEntry: real date, known category, amount in range, short note.
// We copy only the fields we know, so anything extra in the file is dropped.
function cleanImportedEntry(raw) {
  if (!isValidEntry(raw)) return null; // shape, whole positive cents, type...
  if (raw.amountCents > MAX_AMOUNT_CENTS) return null;
  if (!isRealDate(raw.date)) return null;
  if (!categoriesFor(raw.type).includes(raw.category)) return null;
  if (!Number.isFinite(raw.createdAt)) return null;
  if (raw.id.length > MAX_ID_LENGTH) return null;
  return {
    id: raw.id,
    type: raw.type,
    amountCents: raw.amountCents,
    category: raw.category,
    note: raw.note.trim().slice(0, MAX_NOTE_LENGTH),
    date: raw.date,
    createdAt: raw.createdAt,
  };
}

// Reads the text of a backup file. Never throws.
// Returns { ok: false, message } when the file can't be used (nothing changes),
// or { ok: true, entries, skippedCount, hourlyWageCents } when it can.
// skippedCount = entries in the file that didn't look right (or were repeated).
function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { ok: false, message: 'This file couldn\'t be read as a backup. Pick a .json file made with "Export backup". Nothing was changed.' };
  }

  // typeof [] is also 'object', so arrays need their own check.
  const isObject = typeof data === 'object' && data !== null && !Array.isArray(data);
  if (!isObject || data.app !== BACKUP_APP) {
    return { ok: false, message: 'This file isn\'t a Pocket Budget backup. Nothing was changed.' };
  }
  if (data.version !== BACKUP_VERSION) {
    const isNewer = Number.isInteger(data.version) && data.version > BACKUP_VERSION;
    return {
      ok: false,
      message: isNewer
        ? 'This backup was made by a newer version of Pocket Budget. Nothing was changed.'
        : 'This backup\'s version isn\'t one this app knows. Nothing was changed.',
    };
  }
  if (!Array.isArray(data.entries)) {
    return { ok: false, message: 'This backup has no list of entries. Nothing was changed.' };
  }

  const entries = [];
  const seenIds = new Set();
  let skippedCount = 0;
  for (const raw of data.entries) {
    const entry = cleanImportedEntry(raw);
    // Two entries with the same id would confuse edit and delete: keep the first.
    if (entry === null || seenIds.has(entry.id)) {
      skippedCount += 1;
      continue;
    }
    seenIds.add(entry.id);
    entries.push(entry);
  }

  return {
    ok: true,
    entries,
    skippedCount,
    hourlyWageCents: isValidHourlyWage(data.hourlyWageCents) ? data.hourlyWageCents : null,
  };
}

// Adds the backup's entries to the ones already here. Never deletes anything:
// if an entry with the same id is already here, the one here is kept.
// Loading the same backup twice therefore changes nothing the second time.
function mergeEntries(currentEntries, importedEntries) {
  const idsHere = new Set(currentEntries.map((entry) => entry.id));
  const newOnes = importedEntries.filter((entry) => !idsHere.has(entry.id));
  return {
    entries: [...currentEntries, ...newOnes],
    addedCount: newOnes.length,
    alreadyHereCount: importedEntries.length - newOnes.length,
  };
}

// "1 entry", "3 entries"
function countEntries(count) {
  return count + (count === 1 ? ' entry' : ' entries');
}

// The calm message shown after loading a backup.
function importSummary(addedCount, alreadyHereCount, skippedCount, wageRestored) {
  const parts = [];
  if (addedCount > 0) parts.push('Added ' + countEntries(addedCount) + ' from the backup.');
  else parts.push('No new entries to add.');
  if (alreadyHereCount > 0) {
    parts.push(alreadyHereCount === 1 ? '1 was already here.' : alreadyHereCount + ' were already here.');
  }
  if (skippedCount > 0) {
    parts.push(countEntries(skippedCount) + ' didn\'t look right and ' + (skippedCount === 1 ? 'was' : 'were') + ' left out.');
  }
  if (wageRestored) parts.push('Your hourly wage was restored too.');
  return parts.join(' ');
}

// ---------- Sharing with Node ----------
// In the browser, the functions above are simply global: app.js can call them
// because logic.js is loaded first. In Node (tests.js), each file is a "module"
// and only shares what it puts on module.exports. The browser has no "module"
// variable, so this check makes the same file work in both places.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EXPENSE_CATEGORIES,
    INCOME_CATEGORIES,
    CATEGORY_ICONS,
    MAX_AMOUNT_CENTS,
    categoriesFor,
    parseAmountToCents,
    formatCents,
    centsToInputValue,
    todayISO,
    monthKey,
    monthLabel,
    addDays,
    friendlyDate,
    isValidEntry,
    entriesInMonth,
    sortNewestFirst,
    updateEntry,
    deleteEntry,
    monthTotals,
    totalsByCategory,
    CATEGORY_COLORS,
    chartSlices,
    chartDescription,
    shiftMonth,
    monthRange,
    clampMonth,
    previousMonthName,
    formatCentsShort,
    compareCategories,
    comparisonText,
    MAX_HOURLY_WAGE_CENTS,
    isValidHourlyWage,
    workTimeText,
    BACKUP_APP,
    BACKUP_VERSION,
    MAX_BACKUP_BYTES,
    buildBackup,
    backupFileName,
    isRealDate,
    cleanImportedEntry,
    parseBackup,
    mergeEntries,
    importSummary,
  };
}
