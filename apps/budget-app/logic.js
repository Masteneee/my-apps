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

// ---------- 2.4 Export and import (version 2 since task 3.1) ----------
// A backup file is JSON text shaped like:
// { "app": "pocket-budget", "version": 2, "exportedAt": "2026-11-05T14:03:00.000Z",
//   "hourlyWageCents": 1575, "entries": [ ...entries... ], "goals": [ ...goals... ] }
// "app" and "version" let us recognise our own files and refuse anything else.
// Version 1 files (from Phase 2) had no goals. We still read them: a missing
// part is simply treated as empty. That's called "backward compatible".

const BACKUP_APP = 'pocket-budget';
const BACKUP_VERSION = 2; // the version we WRITE
const READABLE_BACKUP_VERSIONS = [1, 2]; // the versions we can READ
const MAX_NOTE_LENGTH = 80; // same as maxlength on the note box
const MAX_ID_LENGTH = 64; // our ids are about 13 characters; this is plenty
const MAX_BACKUP_BYTES = 5 * 1024 * 1024; // 5 MB: tens of thousands of entries

// The object we turn into the backup file. exportedAt is passed in (instead of
// calling new Date() here) so the function stays pure and easy to test.
// "extras" holds the Phase 3 data: { goals, budgets, settings }. Leaving it out gives empty parts.
function buildBackup(entries, hourlyWageCents, exportedAt, extras = {}) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt,
    hourlyWageCents: isValidHourlyWage(hourlyWageCents) ? hourlyWageCents : null,
    entries,
    goals: extras.goals || [],
    budgets: extras.budgets || {},
    settings: cleanSettings(extras.settings), // task 3.4
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
// or { ok: true, entries, skippedCount, hourlyWageCents, goals, skippedGoalCount,
// budgets, settings } when it can (goals 3.1, budgets 3.2, settings 3.4).
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
  if (!READABLE_BACKUP_VERSIONS.includes(data.version)) {
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

  // Task 3.1: goals. A version 1 file has none, so "missing" means "empty list".
  const goals = [];
  const seenGoalIds = new Set();
  let skippedGoalCount = 0;
  const rawGoals = Array.isArray(data.goals) ? data.goals : [];
  for (const raw of rawGoals) {
    const goal = cleanGoal(raw);
    if (goal === null || seenGoalIds.has(goal.id)) {
      skippedGoalCount += 1;
      continue;
    }
    seenGoalIds.add(goal.id);
    goals.push(goal);
  }

  return {
    ok: true,
    entries,
    skippedCount,
    hourlyWageCents: isValidHourlyWage(data.hourlyWageCents) ? data.hourlyWageCents : null,
    goals,
    skippedGoalCount,
    budgets: cleanBudgets(data.budgets), // task 3.2; missing or broken gives {}
    // Task 3.4: null means "this file has no settings" (so nothing is restored).
    settings: data.settings === undefined ? null : cleanSettings(data.settings),
  };
}

// Adds the backup's entries to the ones already here. Never deletes anything:
// if an entry with the same id is already here, the one here is kept.
// Loading the same backup twice therefore changes nothing the second time.
function mergeEntries(currentEntries, importedEntries) {
  const result = mergeById(currentEntries, importedEntries);
  return { entries: result.items, addedCount: result.addedCount, alreadyHereCount: result.alreadyHereCount };
}

// The same "add, never delete, what's here wins" rule for any list of things
// that have an id. Task 3.1 uses it for goals too.
function mergeById(currentItems, importedItems) {
  const idsHere = new Set(currentItems.map((item) => item.id));
  const newOnes = importedItems.filter((item) => !idsHere.has(item.id));
  return {
    items: [...currentItems, ...newOnes],
    addedCount: newOnes.length,
    alreadyHereCount: importedItems.length - newOnes.length,
  };
}

// "1 entry", "3 entries"
function countEntries(count) {
  return count + (count === 1 ? ' entry' : ' entries');
}

// "1 goal", "3 goals"
function countGoals(count) {
  return count + (count === 1 ? ' goal' : ' goals');
}

// The calm message shown after loading a backup.
// "extras" (task 3.1+) tells what else came back:
// { goalsAdded, goalsSkipped, budgetsRestored, settingsRestored }.
function importSummary(addedCount, alreadyHereCount, skippedCount, wageRestored, extras = {}) {
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
  if (extras.goalsAdded > 0) parts.push('Added ' + countGoals(extras.goalsAdded) + '.');
  if (extras.goalsSkipped > 0) {
    parts.push(countGoals(extras.goalsSkipped) + ' didn\'t look right and ' + (extras.goalsSkipped === 1 ? 'was' : 'were') + ' left out.');
  }
  if (extras.budgetsRestored > 0) {
    parts.push('Restored ' + extras.budgetsRestored + (extras.budgetsRestored === 1 ? ' budget.' : ' budgets.'));
  }
  if (extras.settingsRestored) parts.push('Your budget settings were restored too.');
  return parts.join(' ');
}

// ---------- 3.1 Savings goals ----------
// A goal looks like:
// { id: 'g1', name: 'New bike', targetCents: 30000, targetDate: '2027-03-31' (or null),
//   deposits: [{ amountCents: 2500, date: '2026-11-05' }], createdAt: 1793900000000 }
// We keep every deposit (not just a running total) so we can tell how much was
// added in a given month. "Safe to spend" (3.3) and 50/30/20 (3.4) need that.

const MAX_GOAL_NAME_LENGTH = 40; // same as maxlength on the goal name box

// "2027-03-31" -> "Mar 31, 2027". Goals can be far away, so the year matters here.
function formatLongDate(isoDate) {
  const year = isoDate.slice(0, 4);
  const monthIndex = Number(isoDate.slice(5, 7)) - 1;
  const day = Number(isoDate.slice(8, 10));
  return MONTH_NAMES[monthIndex].slice(0, 3) + ' ' + day + ', ' + year;
}

// Everything put into the goal so far, in cents.
function goalSavedCents(goal) {
  let total = 0;
  for (const deposit of goal.deposits) total += deposit.amountCents;
  return total;
}

// How full the progress bar is, from 0 to 100. Rounded DOWN, so the bar only
// says 100% when the goal is really reached ($299.99 of $300 shows 99%).
function goalPercent(savedCents, targetCents) {
  if (savedCents >= targetCents) return 100;
  return Math.floor((savedCents * 100) / targetCents);
}

// Checks what was typed in the "New goal" form.
// Returns { ok: true, fields: { name, targetCents, targetDate } }
// or { ok: false, message } with a calm hint about what to fix.
// todayIsoDate is passed in so the function stays pure (and testable).
function validateGoalInput(nameText, amountText, dateText, todayIsoDate) {
  const name = String(nameText || '').trim().slice(0, MAX_GOAL_NAME_LENGTH);
  if (name === '') return { ok: false, message: 'Give your goal a name, like "New bike".' };

  const targetCents = parseAmountToCents(String(amountText || ''));
  if (targetCents === null) return { ok: false, message: 'Type the amount you want to save, like 300 or 299,99.' };

  // The date is optional: an empty box means "no date, whenever I get there".
  let targetDate = null;
  if (dateText) {
    if (!isRealDate(dateText)) return { ok: false, message: 'That date doesn\'t look right. Pick one, or leave it empty.' };
    // "2026-11-04" < "2026-11-05" works as text because of the YYYY-MM-DD format.
    if (dateText < todayIsoDate) return { ok: false, message: 'Pick today or a later date, or leave it empty.' };
    targetDate = dateText;
  }
  return { ok: true, fields: { name, targetCents, targetDate } };
}

// Returns a NEW list where the goal with this id has one more deposit.
function addDeposit(goals, goalId, amountCents, isoDate) {
  return goals.map((goal) =>
    goal.id === goalId
      ? { ...goal, deposits: [...goal.deposits, { amountCents, date: isoDate }] }
      : goal);
}

// Returns a NEW list without the goal that has this id.
function deleteGoal(goals, goalId) {
  return goals.filter((goal) => goal.id !== goalId);
}

// Checks one goal (from localStorage or from a backup file) and returns a
// CLEAN copy, or null if it doesn't look right. Same idea as cleanImportedEntry:
// copy only the fields we know, so anything extra is dropped.
function cleanGoal(raw) {
  if (typeof raw !== 'object' || raw === null) return null;
  if (typeof raw.id !== 'string' || raw.id === '' || raw.id.length > MAX_ID_LENGTH) return null;
  if (typeof raw.name !== 'string' || raw.name.trim() === '') return null;
  if (!Number.isInteger(raw.targetCents) || raw.targetCents <= 0 || raw.targetCents > MAX_AMOUNT_CENTS) return null;
  if (raw.targetDate !== null && !isRealDate(raw.targetDate)) return null;
  if (!Array.isArray(raw.deposits) || !Number.isFinite(raw.createdAt)) return null;

  const deposits = [];
  for (const deposit of raw.deposits) {
    const isGood = typeof deposit === 'object' && deposit !== null &&
      Number.isInteger(deposit.amountCents) && deposit.amountCents > 0 &&
      deposit.amountCents <= MAX_AMOUNT_CENTS && isRealDate(deposit.date);
    if (!isGood) return null; // a broken deposit would make the total wrong: refuse the goal
    deposits.push({ amountCents: deposit.amountCents, date: deposit.date });
  }

  return {
    id: raw.id,
    name: raw.name.trim().slice(0, MAX_GOAL_NAME_LENGTH),
    targetCents: raw.targetCents,
    targetDate: raw.targetDate,
    deposits,
    createdAt: raw.createdAt,
  };
}

// ---------- 3.2 Monthly budget per category ----------
// Budgets are one object: category name -> monthly limit in cents.
// { Food: 20000, Fun: 5000 } means "$200 a month for Food, $50 for Fun".
// A category that isn't in the object simply has no budget.
// The same limits apply to every month (we don't keep a history of changes).

// Returns a CLEAN budgets object from anything (storage or a backup file):
// only real expense categories, only whole cents from 1 to $1,000,000.
function cleanBudgets(raw) {
  const budgets = {};
  const isObject = typeof raw === 'object' && raw !== null && !Array.isArray(raw);
  if (!isObject) return budgets;
  for (const category of EXPENSE_CATEGORIES) {
    const cents = raw[category];
    if (Number.isInteger(cents) && cents > 0 && cents <= MAX_AMOUNT_CENTS) budgets[category] = cents;
  }
  return budgets;
}

// Returns a NEW budgets object with one category set (or removed when cents is null).
function setBudget(budgets, category, cents) {
  const copy = { ...budgets };
  if (cents === null) delete copy[category];
  else copy[category] = cents;
  return copy;
}

// One row per category that has a budget, in the same order as the buttons:
// [{ category, limitCents, spentCents, leftCents, percent, isOver, rolledOverCents }]
// rolledOver (task 3.5) says how much of each limit came from last month.
// leftCents can go below zero (spent more than planned); the UI words it calmly.
// percent is how full the bar is: 0 to 100, rounded down, never more than 100.
function budgetRows(monthEntries, limits, rolledOver = {}) {
  const spent = {};
  for (const entry of monthEntries) {
    if (entry.type === 'expense') spent[entry.category] = (spent[entry.category] || 0) + entry.amountCents;
  }
  const rows = [];
  for (const category of EXPENSE_CATEGORIES) {
    const limitCents = limits[category];
    if (!limitCents) continue; // no budget for this category
    const spentCents = spent[category] || 0;
    rows.push({
      category,
      limitCents,
      spentCents,
      leftCents: limitCents - spentCents,
      percent: goalPercent(spentCents, limitCents), // same "round down, cap at 100" rule as goals
      isOver: spentCents > limitCents,
      rolledOverCents: rolledOver[category] || 0,
    });
  }
  return rows;
}

// A calm sentence for one budget row. Facts only, no "warning" or "too much".
function budgetStatusText(row) {
  if (row.spentCents === 0) return 'Nothing spent yet, ' + formatCentsShort(row.limitCents) + ' to use';
  if (row.leftCents > 0) return formatCentsShort(row.leftCents) + ' left of ' + formatCentsShort(row.limitCents);
  if (row.leftCents === 0) return 'All ' + formatCentsShort(row.limitCents) + ' used, right on plan';
  return formatCentsShort(-row.leftCents) + ' more than planned. A plan is a guide, not a test.';
}

// Import rule for budgets: like the wage, what's here wins. A category from the
// file is only used if this browser has no budget for it yet.
function mergeBudgets(currentBudgets, importedBudgets) {
  const budgets = { ...currentBudgets };
  let restoredCount = 0;
  for (const category of Object.keys(importedBudgets)) {
    if (budgets[category] === undefined) {
      budgets[category] = importedBudgets[category];
      restoredCount += 1;
    }
  }
  return { budgets, restoredCount };
}

// ---------- 3.3 Safe to spend ----------
// safe to spend per day = (left this month - set aside for goals - bills still to pay)
//                         / days left in the month (today included)

// Number of days in a month: daysInMonth("2028-02") -> 29.
// Day 0 of the NEXT month is the last day of this one (the same overflow trick
// as addDays). monthIndex is 0-based, so "month" (1-based) is already "next".
function daysInMonth(key) {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  return new Date(year, month, 0).getDate();
}

// Days left in the month, TODAY INCLUDED: on Nov 5 that's 26, on Nov 30 it's 1.
// Never 0, so we can always divide by it.
function daysLeftInMonth(todayIsoDate) {
  const day = Number(todayIsoDate.slice(8, 10));
  return daysInMonth(monthKey(todayIsoDate)) - day + 1;
}

// How many months from one month key to another: "2026-11" to "2027-03" is 4.
function monthsBetween(fromKey, toKey) {
  const years = Number(toKey.slice(0, 4)) - Number(fromKey.slice(0, 4));
  const months = Number(toKey.slice(5, 7)) - Number(fromKey.slice(5, 7));
  return years * 12 + months;
}

// Money added to a goal during one month ("2026-11").
function goalAddedInMonth(goal, key) {
  let total = 0;
  for (const deposit of goal.deposits) {
    if (monthKey(deposit.date) === key) total += deposit.amountCents;
  }
  return total;
}

// What a goal with a date needs this month to be reached on time: what was
// still missing at the START of the month, shared equally over the months left
// (this month and the target month both count). Rounded UP to the next cent,
// so the shares add up to at least the target. Using the start of the month
// keeps the plan steady while you add money during the month.
// No date, date passed, or already reached: nothing is planned (0).
function goalMonthlyPlanCents(goal, key) {
  if (goal.targetDate === null) return 0;
  const targetKey = monthKey(goal.targetDate);
  if (targetKey < key) return 0; // the date has passed: no pressure, the UI says so calmly

  let savedBefore = 0;
  for (const deposit of goal.deposits) {
    if (monthKey(deposit.date) < key) savedBefore += deposit.amountCents;
  }
  const missingCents = goal.targetCents - savedBefore;
  if (missingCents <= 0) return 0;
  return Math.ceil(missingCents / (monthsBetween(key, targetKey) + 1));
}

// Money for goals that can't be spent this month: for each goal, the plan or
// what you already added, whichever is bigger. Added money is gone from your
// pocket; the rest of the plan is still to be added. Example: plan $50, added
// $20 -> $50 set aside ($20 moved + $30 still to move). Added $80 -> $80.
function goalsSetAsideCents(goals, key) {
  let total = 0;
  for (const goal of goals) {
    total += Math.max(goalMonthlyPlanCents(goal, key), goalAddedInMonth(goal, key));
  }
  return total;
}

// "Remaining bills": the app has no bills list, so we use the Bills budget.
// The part of it not spent yet is money already promised to bills.
// No Bills budget, or Bills already spent past it: 0.
function billsStillToPayCents(monthEntries, limits) {
  const limitCents = limits.Bills || 0;
  let spentCents = 0;
  for (const entry of monthEntries) {
    if (entry.type === 'expense' && entry.category === 'Bills') spentCents += entry.amountCents;
  }
  return Math.max(0, limitCents - spentCents);
}

// All the numbers behind "safe to spend", for TODAY's month.
// perDayCents is rounded DOWN to a whole cent: $100 over 3 days is $33.33 a
// day, never $33.34 (rounding up would promise 1 cent that isn't there).
// When nothing is available, perDayCents is 0, never negative.
function safeToSpend(monthEntries, goals, limits, todayIsoDate) {
  const key = monthKey(todayIsoDate);
  const totals = monthTotals(monthEntries);
  const goalsCents = goalsSetAsideCents(goals, key);
  const billsCents = billsStillToPayCents(monthEntries, limits);
  const availableCents = totals.leftCents - goalsCents - billsCents;
  const daysLeft = daysLeftInMonth(todayIsoDate);
  return {
    inCents: totals.inCents,
    leftCents: totals.leftCents,
    goalsCents,
    billsCents,
    availableCents,
    daysLeft,
    perDayCents: availableCents > 0 ? Math.floor(availableCents / daysLeft) : 0,
  };
}

// The calm sentence under the big number.
function safeToSpendDetail(safe) {
  if (safe.inCents === 0) return 'Add your money in (job pay, gifts) to see what\'s safe to spend.';
  if (safe.availableCents <= 0) {
    if (safe.goalsCents + safe.billsCents > 0 && safe.leftCents > 0) {
      return 'Nothing extra for now: what\'s left is already set aside for your goals and bills. Your plans come first, and that\'s a good thing.';
    }
    return 'Nothing extra to spend for now. New money in will show up here.';
  }

  const when = safe.daysLeft === 1 ? 'for today, the last day of the month' : 'for the next ' + safe.daysLeft + ' days';
  const minus = [];
  if (safe.goalsCents > 0) minus.push(formatCents(safe.goalsCents) + ' for goals');
  if (safe.billsCents > 0) minus.push(formatCents(safe.billsCents) + ' for bills');
  const breakdown = minus.length === 0 ? '' : ' (' + formatCents(safe.leftCents) + ' left, minus ' + minus.join(' and ') + ')';
  return formatCents(safe.availableCents) + ' ' + when + breakdown + '.';
}

// The short line under a goal about this month: "This month's plan: $50.00 ($20.00 added)".
// Empty text when the goal has no date or is reached.
function goalPlanText(goal, key) {
  if (goal.targetDate === null || goalSavedCents(goal) >= goal.targetCents) return '';
  if (monthKey(goal.targetDate) < key) return 'The date has passed. No rush: add money whenever you can.';
  const planCents = goalMonthlyPlanCents(goal, key);
  const addedCents = goalAddedInMonth(goal, key);
  return 'This month\'s plan: ' + formatCents(planCents) + (addedCents > 0 ? ' (' + formatCents(addedCents) + ' added)' : '');
}

// ---------- 3.4 Budget styles ----------
// Settings are one small object. Task 3.4 adds the style; 3.5 adds rollover.

const BUDGET_STYLES = ['simple', '503020'];
const DEFAULT_SETTINGS = { budgetStyle: 'simple', rollover: false };

// Returns CLEAN settings from anything: a missing or strange value falls back
// to its default, so the app always has every setting.
function cleanSettings(raw) {
  const isObject = typeof raw === 'object' && raw !== null && !Array.isArray(raw);
  const data = isObject ? raw : {};
  return {
    budgetStyle: BUDGET_STYLES.includes(data.budgetStyle) ? data.budgetStyle : DEFAULT_SETTINGS.budgetStyle,
    rollover: data.rollover === true, // task 3.5: only a real true turns it on
  };
}

// True if two settings objects have the same value for every setting.
function sameSettings(a, b) {
  return Object.keys(DEFAULT_SETTINGS).every((name) => a[name] === b[name]);
}

// Import rule for settings: there's always SOME value here (the defaults), so
// "what's here wins" means: use the file's settings only if the ones here were
// never changed from the defaults. importedSettings is null for files without settings.
function mergeSettings(currentSettings, importedSettings) {
  if (importedSettings === null || !sameSettings(currentSettings, DEFAULT_SETTINGS)) {
    return { settings: currentSettings, restored: false };
  }
  return { settings: importedSettings, restored: !sameSettings(importedSettings, DEFAULT_SETTINGS) };
}

// Which expense categories count as needs and wants. Food is a need: the app
// can't tell groceries from takeout, and eating isn't optional.
// "Savings" isn't a category: it's the money you added to goals that month.
const NEEDS_CATEGORIES = ['Food', 'Transport', 'School', 'Bills'];
const WANTS_CATEGORIES = ['Fun', 'Other'];

// 50% / 30% / 20% of money in, in whole cents. Needs and wants are rounded
// down, and savings gets whatever is left, so the three always add up to
// exactly the money in (no cent lost or invented).
function splitTargets(incomeCents) {
  const needsCents = Math.floor((incomeCents * 50) / 100);
  const wantsCents = Math.floor((incomeCents * 30) / 100);
  return { needsCents, wantsCents, savingsCents: incomeCents - needsCents - wantsCents };
}

// The 50/30/20 picture for one month: for each group, the guide amount
// (from money in) and what really happened.
// Returns { inCents, rows: [{ group, guidePercent, targetCents, actualCents, percent }] }
// percent = how full the bar is (actual vs guide, 0 to 100).
function fiftyThirtyTwenty(monthEntries, goals, key) {
  const totals = monthTotals(monthEntries);
  const targets = splitTargets(totals.inCents);
  let needsCents = 0;
  let wantsCents = 0;
  for (const entry of monthEntries) {
    if (entry.type !== 'expense') continue;
    if (NEEDS_CATEGORIES.includes(entry.category)) needsCents += entry.amountCents;
    else wantsCents += entry.amountCents; // Fun, Other (and anything unknown)
  }
  let savingsCents = 0;
  for (const goal of goals) savingsCents += goalAddedInMonth(goal, key);

  const row = (group, guidePercent, targetCents, actualCents) => ({
    group,
    guidePercent,
    targetCents,
    actualCents,
    percent: targetCents > 0 ? goalPercent(actualCents, targetCents) : 0,
  });
  return {
    inCents: totals.inCents,
    rows: [
      row('Needs', 50, targets.needsCents, needsCents),
      row('Wants', 30, targets.wantsCents, wantsCents),
      row('Savings', 20, targets.savingsCents, savingsCents),
    ],
  };
}

// A calm sentence for one 50/30/20 row. Above the guide is said plainly for
// needs and wants, and cheered for savings (saving more is good news).
function splitRowText(row) {
  const actual = formatCentsShort(row.actualCents);
  const target = formatCentsShort(row.targetCents);
  if (row.actualCents <= row.targetCents) return actual + ' of ' + target;
  if (row.group === 'Savings') return actual + ', above the ' + target + ' guide. Nice!';
  return actual + ', a bit above the ' + target + ' guide';
}

// ---------- 3.5 Rollover ----------
// With rollover on, what you didn't spend of a budget last month is added to
// the same budget this month. Example: Fun is $50 a month, you spent $30 in
// October, so November's Fun budget is $50 + $20 = $70.
// Rules (the simplest ones, see LEARNING.md "Decisions"):
// - Only LAST month counts (it doesn't pile up over many months).
// - Spending more than planned never makes next month smaller (no negative rollover).
// - If last month has no entries at all, nothing rolls over: you probably
//   weren't using the app yet, and a whole "free" budget would be misleading.

// Returns { limits, rolledOver }: the limits to use for a month, and how much
// of each came from last month (only categories where something rolled over).
function effectiveLimits(budgets, previousMonthEntries, rolloverOn) {
  const limits = { ...budgets };
  const rolledOver = {};
  if (!rolloverOn || previousMonthEntries.length === 0) return { limits, rolledOver };

  const spentBefore = {};
  for (const entry of previousMonthEntries) {
    if (entry.type === 'expense') spentBefore[entry.category] = (spentBefore[entry.category] || 0) + entry.amountCents;
  }
  for (const category of Object.keys(budgets)) {
    const unspentCents = Math.max(0, budgets[category] - (spentBefore[category] || 0));
    if (unspentCents > 0) {
      limits[category] = budgets[category] + unspentCents;
      rolledOver[category] = unspentCents;
    }
  }
  return { limits, rolledOver };
}

// "Includes $20 not spent in October", or '' when nothing rolled over.
function rolloverText(rolledOverCents, previousKey) {
  if (!rolledOverCents) return '';
  const monthName = MONTH_NAMES[Number(previousKey.slice(5, 7)) - 1];
  return 'Includes ' + formatCentsShort(rolledOverCents) + ' not spent in ' + monthName;
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
    mergeById,
    importSummary,
    MAX_GOAL_NAME_LENGTH,
    formatLongDate,
    goalSavedCents,
    goalPercent,
    validateGoalInput,
    addDeposit,
    deleteGoal,
    cleanGoal,
    cleanBudgets,
    setBudget,
    budgetRows,
    budgetStatusText,
    mergeBudgets,
    daysInMonth,
    daysLeftInMonth,
    monthsBetween,
    goalAddedInMonth,
    goalMonthlyPlanCents,
    goalsSetAsideCents,
    billsStillToPayCents,
    safeToSpend,
    safeToSpendDetail,
    goalPlanText,
    BUDGET_STYLES,
    DEFAULT_SETTINGS,
    cleanSettings,
    sameSettings,
    mergeSettings,
    NEEDS_CATEGORIES,
    WANTS_CATEGORIES,
    splitTargets,
    fiftyThirtyTwenty,
    splitRowText,
    effectiveLimits,
    rolloverText,
  };
}
