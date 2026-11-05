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
  };
}
