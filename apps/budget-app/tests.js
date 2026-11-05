// tests.js: checks the pure functions in logic.js.
// Run it with: node tests.js
// No test library needed: Node has a built-in "assert" module that throws an
// error when something isn't what we expected.

const assert = require('assert');
const logic = require('./logic.js');

// A tiny test runner: each test is a name plus a function. If the function
// throws, the test failed. We keep going so we see every failure at once.
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    console.log('FAIL: ' + name);
    console.log('   ' + error.message.split('\n').join('\n   '));
  }
}

// Builds an entry for tests, with sensible defaults we can override.
let nextId = 1;
function makeEntry(overrides) {
  const entry = {
    id: 'e' + nextId,
    type: 'expense',
    amountCents: 1000,
    category: 'Food',
    note: '',
    date: '2026-11-05',
    createdAt: nextId,
    ...overrides,
  };
  nextId += 1;
  return entry;
}

// ---------- 0.1 Skeleton ----------

test('the test runner works (1 + 1 is 2)', () => {
  assert.strictEqual(1 + 1, 2);
});

// ---------- 1.1 Parsing amounts ----------

test('parseAmountToCents: whole dollars', () => {
  assert.strictEqual(logic.parseAmountToCents('12'), 1200);
});

test('parseAmountToCents: dot decimals', () => {
  assert.strictEqual(logic.parseAmountToCents('12.5'), 1250);
  assert.strictEqual(logic.parseAmountToCents('12.50'), 1250);
  assert.strictEqual(logic.parseAmountToCents('0.05'), 5);
});

test('parseAmountToCents: Quebec comma decimals', () => {
  assert.strictEqual(logic.parseAmountToCents('12,50'), 1250);
  assert.strictEqual(logic.parseAmountToCents('12,5'), 1250);
});

test('parseAmountToCents: dollar sign before or after, and spaces', () => {
  assert.strictEqual(logic.parseAmountToCents('$12'), 1200);
  assert.strictEqual(logic.parseAmountToCents('12 $'), 1200);
  assert.strictEqual(logic.parseAmountToCents('  $ 4,99 '), 499);
  assert.strictEqual(logic.parseAmountToCents('12 $'), 1200); // non-breaking space
});

test('parseAmountToCents: spaces as thousands separator (1 234,56)', () => {
  assert.strictEqual(logic.parseAmountToCents('1 234,56'), 123456);
});

test('parseAmountToCents: leading or trailing separator', () => {
  assert.strictEqual(logic.parseAmountToCents('.5'), 50);
  assert.strictEqual(logic.parseAmountToCents('12.'), 1200);
});

test('parseAmountToCents: no floating point errors', () => {
  // parseFloat('0.29') * 100 gives 28.999999999999996. Ours must give 29.
  assert.strictEqual(logic.parseAmountToCents('0.29'), 29);
  assert.strictEqual(logic.parseAmountToCents('19.99'), 1999);
});

test('parseAmountToCents: rejects things that are not amounts', () => {
  const bad = ['', '   ', '$', '.', 'abc', '12abc', '-5', '0', '0,00',
    '12.345', '12,500', '1,234.56', '1.2.3', '12..5'];
  for (const text of bad) {
    assert.strictEqual(logic.parseAmountToCents(text), null, 'should reject "' + text + '"');
  }
  assert.strictEqual(logic.parseAmountToCents(undefined), null);
  assert.strictEqual(logic.parseAmountToCents(12), null);
});

test('parseAmountToCents: rejects amounts over $1,000,000', () => {
  assert.strictEqual(logic.parseAmountToCents('1000000'), 100000000);
  assert.strictEqual(logic.parseAmountToCents('1000000.01'), null);
});

// ---------- 1.1 Dates ----------

test('todayISO uses local date and pads with zeros', () => {
  // Month numbers in JavaScript start at 0, so 10 means November.
  assert.strictEqual(logic.todayISO(new Date(2026, 10, 5, 23, 30)), '2026-11-05');
  assert.strictEqual(logic.todayISO(new Date(2026, 0, 9, 0, 1)), '2026-01-09');
});

test('categoriesFor gives the right list for each type', () => {
  assert.deepStrictEqual(logic.categoriesFor('expense'),
    ['Food', 'Transport', 'Fun', 'School', 'Bills', 'Other']);
  assert.deepStrictEqual(logic.categoriesFor('income'), ['Job', 'Gift', 'Other']);
});

test('isValidEntry accepts a good entry and rejects broken ones', () => {
  assert.strictEqual(logic.isValidEntry(makeEntry({})), true);
  assert.strictEqual(logic.isValidEntry(null), false);
  assert.strictEqual(logic.isValidEntry('hello'), false);
  assert.strictEqual(logic.isValidEntry(makeEntry({ amountCents: 12.5 })), false);
  assert.strictEqual(logic.isValidEntry(makeEntry({ amountCents: -100 })), false);
  assert.strictEqual(logic.isValidEntry(makeEntry({ type: 'gift' })), false);
  assert.strictEqual(logic.isValidEntry(makeEntry({ date: 'Nov 5' })), false);
  assert.strictEqual(logic.isValidEntry(makeEntry({ id: '' })), false);
});

// ---------- 1.2 Showing the list ----------

test('formatCents shows dollars and cents', () => {
  assert.strictEqual(logic.formatCents(1250), '$12.50');
  assert.strictEqual(logic.formatCents(5), '$0.05');
  assert.strictEqual(logic.formatCents(0), '$0.00');
  assert.strictEqual(logic.formatCents(123456), '$1,234.56');
  assert.strictEqual(logic.formatCents(-500), '-$5.00');
});

test('monthKey and monthLabel', () => {
  assert.strictEqual(logic.monthKey('2026-11-05'), '2026-11');
  assert.strictEqual(logic.monthLabel('2026-11'), 'November 2026');
  assert.strictEqual(logic.monthLabel('2027-01'), 'January 2027');
});

test('addDays crosses month and year boundaries', () => {
  assert.strictEqual(logic.addDays('2026-11-01', -1), '2026-10-31');
  assert.strictEqual(logic.addDays('2027-01-01', -1), '2026-12-31');
  assert.strictEqual(logic.addDays('2028-02-28', 1), '2028-02-29'); // leap year
});

test('friendlyDate says Today, Yesterday, or a short date', () => {
  assert.strictEqual(logic.friendlyDate('2026-11-05', '2026-11-05'), 'Today');
  assert.strictEqual(logic.friendlyDate('2026-11-04', '2026-11-05'), 'Yesterday');
  assert.strictEqual(logic.friendlyDate('2026-10-31', '2026-11-01'), 'Yesterday');
  assert.strictEqual(logic.friendlyDate('2026-11-02', '2026-11-05'), 'Nov 2');
});

test('entriesInMonth keeps only that month', () => {
  const entries = [
    makeEntry({ date: '2026-10-31' }),
    makeEntry({ date: '2026-11-01' }),
    makeEntry({ date: '2026-11-30' }),
    makeEntry({ date: '2025-11-15' }), // same month, other year
  ];
  const result = logic.entriesInMonth(entries, '2026-11');
  assert.deepStrictEqual(result.map((e) => e.date), ['2026-11-01', '2026-11-30']);
});

test('sortNewestFirst: newest date first, then last added first', () => {
  const a = makeEntry({ date: '2026-11-02', createdAt: 100 });
  const b = makeEntry({ date: '2026-11-05', createdAt: 50 });
  const c = makeEntry({ date: '2026-11-05', createdAt: 200 });
  const original = [a, b, c];
  const sorted = logic.sortNewestFirst(original);
  assert.deepStrictEqual(sorted.map((e) => e.id), [c.id, b.id, a.id]);
  // The original list must not be changed.
  assert.deepStrictEqual(original.map((e) => e.id), [a.id, b.id, c.id]);
});

// ---------- 1.3 Edit and delete ----------

test('centsToInputValue gives text for the amount box', () => {
  assert.strictEqual(logic.centsToInputValue(1250), '12.50');
  assert.strictEqual(logic.centsToInputValue(5), '0.05');
  assert.strictEqual(logic.centsToInputValue(1200), '12.00');
  // Round trip: what we put in the box parses back to the same cents.
  assert.strictEqual(logic.parseAmountToCents(logic.centsToInputValue(1999)), 1999);
});

test('updateEntry changes only the matching entry and keeps its id', () => {
  const a = makeEntry({ amountCents: 100 });
  const b = makeEntry({ amountCents: 200 });
  const original = [a, b];
  const result = logic.updateEntry(original, b.id, { amountCents: 999, note: 'fixed', id: 'hacked' });
  assert.strictEqual(result[0], a); // untouched entry is the same object
  assert.strictEqual(result[1].amountCents, 999);
  assert.strictEqual(result[1].note, 'fixed');
  assert.strictEqual(result[1].id, b.id);
  assert.strictEqual(b.amountCents, 200); // original not changed
});

test('deleteEntry removes only the matching entry', () => {
  const a = makeEntry({});
  const b = makeEntry({});
  const result = logic.deleteEntry([a, b], a.id);
  assert.deepStrictEqual(result.map((e) => e.id), [b.id]);
  assert.strictEqual(logic.deleteEntry([a, b], 'nope').length, 2);
});

// ---------- 1.4 Income and totals ----------

test('monthTotals: money in, money out, left', () => {
  const entries = [
    makeEntry({ type: 'income', category: 'Job', amountCents: 50000 }),
    makeEntry({ type: 'income', category: 'Gift', amountCents: 2000 }),
    makeEntry({ type: 'expense', amountCents: 1250 }),
    makeEntry({ type: 'expense', amountCents: 799 }),
  ];
  assert.deepStrictEqual(logic.monthTotals(entries), {
    inCents: 52000,
    outCents: 2049,
    leftCents: 49951,
  });
});

test('monthTotals: empty month is all zeros', () => {
  assert.deepStrictEqual(logic.monthTotals([]), { inCents: 0, outCents: 0, leftCents: 0 });
});

test('monthTotals: left can go below zero', () => {
  const entries = [
    makeEntry({ type: 'income', category: 'Gift', amountCents: 1000 }),
    makeEntry({ type: 'expense', amountCents: 1500 }),
  ];
  assert.strictEqual(logic.monthTotals(entries).leftCents, -500);
});

test('monthTotals: adding cents stays exact (no 0.1 + 0.2 problem)', () => {
  const entries = [makeEntry({ amountCents: 10 }), makeEntry({ amountCents: 20 })];
  assert.strictEqual(logic.monthTotals(entries).outCents, 30);
});

// ---------- 1.5 Totals per category ----------

test('totalsByCategory: sums per category, biggest first', () => {
  const entries = [
    makeEntry({ category: 'Food', amountCents: 1000 }),
    makeEntry({ category: 'Fun', amountCents: 3000 }),
    makeEntry({ category: 'Food', amountCents: 1500 }),
    makeEntry({ category: 'Bills', amountCents: 500 }),
  ];
  assert.deepStrictEqual(logic.totalsByCategory(entries), [
    { category: 'Fun', cents: 3000, percent: 50 },
    { category: 'Food', cents: 2500, percent: 42 },
    { category: 'Bills', cents: 500, percent: 8 },
  ]);
});

test('totalsByCategory: ignores income', () => {
  const entries = [
    makeEntry({ type: 'income', category: 'Other', amountCents: 9000 }),
    makeEntry({ type: 'expense', category: 'Other', amountCents: 400 }),
  ];
  assert.deepStrictEqual(logic.totalsByCategory(entries), [
    { category: 'Other', cents: 400, percent: 100 },
  ]);
});

test('totalsByCategory: ties keep the button order', () => {
  const entries = [
    makeEntry({ category: 'Other', amountCents: 700 }),
    makeEntry({ category: 'School', amountCents: 700 }),
    makeEntry({ category: 'Food', amountCents: 700 }),
  ];
  assert.deepStrictEqual(logic.totalsByCategory(entries).map((row) => row.category),
    ['Food', 'School', 'Other']);
});

test('totalsByCategory: empty list gives empty result', () => {
  assert.deepStrictEqual(logic.totalsByCategory([]), []);
  assert.deepStrictEqual(logic.totalsByCategory([makeEntry({ type: 'income', category: 'Job' })]), []);
});

// ---------- 2.1 Category chart ----------

test('every expense category has a colour', () => {
  for (const category of logic.EXPENSE_CATEGORIES) {
    assert.ok(/^#[0-9a-f]{6}$/.test(logic.CATEGORY_COLORS[category]), category + ' needs a colour');
  }
});

test('chartSlices: labels, cents and colours line up with the rows', () => {
  const rows = logic.totalsByCategory([
    makeEntry({ category: 'Food', amountCents: 1000 }),
    makeEntry({ category: 'Fun', amountCents: 3000 }),
  ]);
  assert.deepStrictEqual(logic.chartSlices(rows), {
    labels: ['Fun', 'Food'],
    cents: [3000, 1000],
    colors: [logic.CATEGORY_COLORS.Fun, logic.CATEGORY_COLORS.Food],
  });
});

test('chartSlices: no spending gives empty lists, unknown category gets a colour', () => {
  assert.deepStrictEqual(logic.chartSlices([]), { labels: [], cents: [], colors: [] });
  const slices = logic.chartSlices([{ category: 'Pizza', cents: 100, percent: 100 }]);
  assert.strictEqual(typeof slices.colors[0], 'string');
});

test('chartDescription: a sentence for screen readers', () => {
  const rows = [
    { category: 'Fun', cents: 3000, percent: 75 },
    { category: 'Food', cents: 1000, percent: 25 },
  ];
  assert.strictEqual(logic.chartDescription(rows),
    'Spending by category: Fun $30.00 (75%), Food $10.00 (25%).');
  assert.strictEqual(logic.chartDescription([]), 'Nothing spent yet.');
});

// ---------- 2.2 Month switcher and comparison ----------

test('shiftMonth moves across year boundaries', () => {
  assert.strictEqual(logic.shiftMonth('2026-11', -1), '2026-10');
  assert.strictEqual(logic.shiftMonth('2026-01', -1), '2025-12');
  assert.strictEqual(logic.shiftMonth('2026-12', 1), '2027-01');
  assert.strictEqual(logic.shiftMonth('2026-11', -13), '2025-10');
  assert.strictEqual(logic.shiftMonth('2026-11', 0), '2026-11');
});

test('monthRange: oldest entry month to newest, always including this month', () => {
  assert.deepStrictEqual(logic.monthRange([], '2026-11'), { first: '2026-11', last: '2026-11' });
  const entries = [
    makeEntry({ date: '2026-09-14' }),
    makeEntry({ date: '2025-12-31' }),
    makeEntry({ date: '2026-11-02' }),
  ];
  assert.deepStrictEqual(logic.monthRange(entries, '2026-11'), { first: '2025-12', last: '2026-11' });
  // An entry dated in the future (typed by hand) must stay reachable.
  const future = [makeEntry({ date: '2027-02-01' })];
  assert.deepStrictEqual(logic.monthRange(future, '2026-11'), { first: '2026-11', last: '2027-02' });
});

test('clampMonth keeps the month inside the range', () => {
  const range = { first: '2026-03', last: '2026-11' };
  assert.strictEqual(logic.clampMonth('2026-02', range), '2026-03');
  assert.strictEqual(logic.clampMonth('2026-12', range), '2026-11');
  assert.strictEqual(logic.clampMonth('2026-07', range), '2026-07');
});

test('previousMonthName: "last month" now, a month name when looking back', () => {
  assert.strictEqual(logic.previousMonthName('2026-11', '2026-11'), 'last month');
  assert.strictEqual(logic.previousMonthName('2026-10', '2026-11'), 'in September');
  assert.strictEqual(logic.previousMonthName('2026-01', '2026-11'), 'in December');
});

test('formatCentsShort drops ".00" only for whole dollars', () => {
  assert.strictEqual(logic.formatCentsShort(4000), '$40');
  assert.strictEqual(logic.formatCentsShort(1250), '$12.50');
  assert.strictEqual(logic.formatCentsShort(5), '$0.05');
  assert.strictEqual(logic.formatCentsShort(123400), '$1,234');
});

test('compareCategories: both months side by side, expenses only', () => {
  const thisMonth = [
    makeEntry({ category: 'Food', amountCents: 6000 }),
    makeEntry({ category: 'Fun', amountCents: 1250 }),
    makeEntry({ type: 'income', category: 'Job', amountCents: 50000 }),
  ];
  const lastMonth = [
    makeEntry({ category: 'Food', amountCents: 10000, date: '2026-10-03' }),
    makeEntry({ category: 'Bills', amountCents: 3000, date: '2026-10-20' }),
    makeEntry({ category: 'Fun', amountCents: 1250, date: '2026-10-21' }),
  ];
  assert.deepStrictEqual(logic.compareCategories(thisMonth, lastMonth), [
    { category: 'Food', cents: 6000, previousCents: 10000, diffCents: -4000 },
    { category: 'Fun', cents: 1250, previousCents: 1250, diffCents: 0 },
    { category: 'Bills', cents: 0, previousCents: 3000, diffCents: -3000 },
  ]);
});

test('compareCategories: new category this month, and empty months', () => {
  const thisMonth = [makeEntry({ category: 'School', amountCents: 2500 })];
  assert.deepStrictEqual(logic.compareCategories(thisMonth, []), [
    { category: 'School', cents: 2500, previousCents: 0, diffCents: 2500 },
  ]);
  assert.deepStrictEqual(logic.compareCategories([], []), []);
});

test('comparisonText: calm sentences', () => {
  assert.strictEqual(logic.comparisonText(-4000, 'last month'), '$40 less than last month');
  assert.strictEqual(logic.comparisonText(1250, 'in September'), '$12.50 more than in September');
  assert.strictEqual(logic.comparisonText(0, 'last month'), 'the same as last month');
});

// ---------- 2.3 Hours of work ----------

test('isValidHourlyWage: whole cents per hour, above zero, up to $1,000', () => {
  assert.strictEqual(logic.isValidHourlyWage(1575), true); // $15.75/h
  assert.strictEqual(logic.isValidHourlyWage(100000), true);
  for (const bad of [0, -1500, 15.75, 100001, null, undefined, '1575', NaN]) {
    assert.strictEqual(logic.isValidHourlyWage(bad), false, 'should reject ' + bad);
  }
});

test('workTimeText: hours with one decimal', () => {
  assert.strictEqual(logic.workTimeText(3000, 2000), '1.5 h'); // $30 at $20/h
  assert.strictEqual(logic.workTimeText(4000, 2000), '2 h'); // no ".0"
  assert.strictEqual(logic.workTimeText(2000, 2000), '1 h');
  assert.strictEqual(logic.workTimeText(10000, 1575), '6.3 h'); // 6.349... rounds to 6.3
  assert.strictEqual(logic.workTimeText(2500000, 2000), '1,250 h');
});

test('workTimeText: small amounts in minutes', () => {
  assert.strictEqual(logic.workTimeText(400, 1600), '15 min'); // $4 at $16/h
  assert.strictEqual(logic.workTimeText(1990, 2000), '1 h'); // 59.7 min rounds to 60
  assert.strictEqual(logic.workTimeText(25, 2000), '1 min'); // 0.75 min rounds to 1
  assert.strictEqual(logic.workTimeText(5, 2000), 'under 1 min');
});

test('workTimeText: no wage set gives empty text', () => {
  assert.strictEqual(logic.workTimeText(1000, null), '');
  assert.strictEqual(logic.workTimeText(1000, 0), '');
});

// ---------- 2.4 Export and import ----------

// A backup file's text, the way "Export backup" writes it.
function backupText(entries, extra) {
  return JSON.stringify({ ...logic.buildBackup(entries, 1575, '2026-11-05T12:00:00.000Z'), ...extra });
}

test('buildBackup: app name, version, wage and entries', () => {
  const entries = [makeEntry({})];
  assert.deepStrictEqual(logic.buildBackup(entries, 1575, '2026-11-05T12:00:00.000Z'), {
    app: 'pocket-budget',
    version: 2, // version 2 since task 3.1 (goals)
    exportedAt: '2026-11-05T12:00:00.000Z',
    hourlyWageCents: 1575,
    entries,
    goals: [],
    budgets: {}, // task 3.2
    settings: { budgetStyle: 'simple', rollover: false }, // tasks 3.4 and 3.5: the defaults
  });
  assert.strictEqual(logic.buildBackup([], null, 'x').hourlyWageCents, null);
  assert.strictEqual(logic.backupFileName('2026-11-05'), 'pocket-budget-backup-2026-11-05.json');
});

test('export then import gives back exactly the same entries and wage', () => {
  const entries = [
    makeEntry({ amountCents: 1999, note: 'Lunch', date: '2026-10-31' }),
    makeEntry({ type: 'income', category: 'Job', amountCents: 50000 }),
  ];
  const result = logic.parseBackup(backupText(entries));
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.entries, entries);
  assert.strictEqual(result.skippedCount, 0);
  assert.strictEqual(result.hourlyWageCents, 1575);
});

test('parseBackup: refuses broken or foreign files with a calm message', () => {
  const notOurs = ['', 'hello', '{"app": "pocket-bu', 'null', '42', '"text"', '[]',
    '[{"id":"a"}]', '{"entries": []}', '{"app": "other-app", "version": 1, "entries": []}'];
  for (const text of notOurs) {
    const result = logic.parseBackup(text);
    assert.strictEqual(result.ok, false, 'should refuse ' + text);
    assert.ok(/Nothing was changed/.test(result.message));
  }
  assert.strictEqual(logic.parseBackup(undefined).ok, false);
});

test('parseBackup: wrong version or missing entries list', () => {
  const newer = logic.parseBackup(backupText([], { version: 3 }));
  assert.strictEqual(newer.ok, false);
  assert.ok(/newer version/.test(newer.message));
  assert.strictEqual(logic.parseBackup(backupText([], { version: '1' })).ok, false);
  assert.strictEqual(logic.parseBackup(backupText([], { entries: 'lots' })).ok, false);
});

test('parseBackup: keeps good entries, skips bad ones and counts them', () => {
  const good = makeEntry({});
  const result = logic.parseBackup(backupText([
    good,
    makeEntry({ amountCents: 12.5 }), // cents must be whole
    makeEntry({ amountCents: '1250' }), // text, not a number
    makeEntry({ amountCents: 0 }),
    makeEntry({ amountCents: 100000001 }), // over $1,000,000
    makeEntry({ date: '2026-02-30' }), // not a real day
    makeEntry({ category: 'Pizza' }), // unknown category
    makeEntry({ type: 'income', category: 'Food' }), // Food isn't an income category
    makeEntry({ id: 'x'.repeat(65) }),
    { ...good }, // same id twice: keep the first
    'not an entry',
    null,
  ]));
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.entries, [good]);
  assert.strictEqual(result.skippedCount, 11);
});

test('cleanImportedEntry: drops unknown fields and trims long notes', () => {
  const raw = { ...makeEntry({ note: '  ' + 'a'.repeat(100) }), script: '<b>extra</b>', isAdmin: true };
  const clean = logic.cleanImportedEntry(raw);
  assert.deepStrictEqual(Object.keys(clean).sort(),
    ['amountCents', 'category', 'createdAt', 'date', 'id', 'note', 'type']);
  assert.strictEqual(clean.note.length, 80);
});

test('parseBackup: a bad wage is ignored, not an error', () => {
  const result = logic.parseBackup(backupText([], { hourlyWageCents: 15.75 }));
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.hourlyWageCents, null);
});

test('isRealDate', () => {
  assert.strictEqual(logic.isRealDate('2028-02-29'), true); // leap year
  assert.strictEqual(logic.isRealDate('2026-02-29'), false);
  assert.strictEqual(logic.isRealDate('2026-13-01'), false);
  assert.strictEqual(logic.isRealDate('2026-1-5'), false);
  assert.strictEqual(logic.isRealDate(20261105), false);
});

test('mergeEntries: adds new ones, keeps the ones already here, never deletes', () => {
  const here = makeEntry({ amountCents: 100 });
  const onlyHere = makeEntry({});
  const fromFileSameId = { ...here, amountCents: 999 };
  const fromFileNew = makeEntry({});
  const result = logic.mergeEntries([here, onlyHere], [fromFileSameId, fromFileNew]);
  assert.deepStrictEqual(result.entries, [here, onlyHere, fromFileNew]);
  assert.strictEqual(result.addedCount, 1);
  assert.strictEqual(result.alreadyHereCount, 1);
  // Loading the same file a second time adds nothing.
  const again = logic.mergeEntries(result.entries, [fromFileSameId, fromFileNew]);
  assert.strictEqual(again.addedCount, 0);
  assert.strictEqual(again.entries.length, 3);
});

test('importSummary: friendly sentences with singular and plural', () => {
  assert.strictEqual(logic.importSummary(12, 0, 0, false), 'Added 12 entries from the backup.');
  assert.strictEqual(logic.importSummary(1, 1, 1, true),
    'Added 1 entry from the backup. 1 was already here. 1 entry didn\'t look right and was left out. Your hourly wage was restored too.');
  assert.strictEqual(logic.importSummary(0, 3, 2, false),
    'No new entries to add. 3 were already here. 2 entries didn\'t look right and were left out.');
});

// ---------- 3.1 Savings goals ----------

// Builds a goal for tests, with sensible defaults we can override.
function makeGoal(overrides) {
  const goal = {
    id: 'g' + nextId,
    name: 'New bike',
    targetCents: 30000,
    targetDate: null,
    deposits: [],
    createdAt: nextId,
    ...overrides,
  };
  nextId += 1;
  return goal;
}

test('formatLongDate shows the year', () => {
  assert.strictEqual(logic.formatLongDate('2027-03-31'), 'Mar 31, 2027');
  assert.strictEqual(logic.formatLongDate('2026-11-05'), 'Nov 5, 2026');
});

test('goalSavedCents adds up the deposits exactly', () => {
  assert.strictEqual(logic.goalSavedCents(makeGoal({})), 0);
  const goal = makeGoal({ deposits: [{ amountCents: 10, date: '2026-11-01' }, { amountCents: 20, date: '2026-11-02' }] });
  assert.strictEqual(logic.goalSavedCents(goal), 30); // not 30.000000000000004
});

test('goalPercent: rounded down, capped at 100', () => {
  assert.strictEqual(logic.goalPercent(0, 30000), 0);
  assert.strictEqual(logic.goalPercent(15000, 30000), 50);
  assert.strictEqual(logic.goalPercent(29999, 30000), 99); // not 100 until it's really reached
  assert.strictEqual(logic.goalPercent(1, 30000), 0);
  assert.strictEqual(logic.goalPercent(30000, 30000), 100);
  assert.strictEqual(logic.goalPercent(45000, 30000), 100); // more than the target
});

test('validateGoalInput: a good goal, with or without a date', () => {
  assert.deepStrictEqual(logic.validateGoalInput('  New bike ', '299,99', '', '2026-11-05'),
    { ok: true, fields: { name: 'New bike', targetCents: 29999, targetDate: null } });
  assert.deepStrictEqual(logic.validateGoalInput('Trip', '500', '2026-11-05', '2026-11-05').fields.targetDate, '2026-11-05');
  assert.strictEqual(logic.validateGoalInput('x'.repeat(60), '5', '', '2026-11-05').fields.name.length, 40);
});

test('validateGoalInput: calm messages for missing name, bad amount, past or fake date', () => {
  const today = '2026-11-05';
  for (const [name, amount, date] of [['', '300', ''], ['   ', '300', ''], ['Bike', '', ''], ['Bike', 'abc', ''],
    ['Bike', '0', ''], ['Bike', '300', '2026-11-04'], ['Bike', '300', '2026-02-30']]) {
    const result = logic.validateGoalInput(name, amount, date, today);
    assert.strictEqual(result.ok, false, 'should refuse ' + [name, amount, date].join('|'));
    assert.ok(result.message.length > 0);
  }
});

test('addDeposit and deleteGoal return new lists and change only one goal', () => {
  const bike = makeGoal({});
  const trip = makeGoal({ name: 'Trip' });
  const goals = [bike, trip];
  const after = logic.addDeposit(goals, bike.id, 2500, '2026-11-05');
  assert.deepStrictEqual(after[0].deposits, [{ amountCents: 2500, date: '2026-11-05' }]);
  assert.strictEqual(after[1], trip); // untouched
  assert.deepStrictEqual(bike.deposits, []); // the original wasn't changed
  assert.deepStrictEqual(logic.deleteGoal(after, bike.id).map((g) => g.name), ['Trip']);
});

test('cleanGoal: keeps good goals, refuses broken ones, drops extra fields', () => {
  const good = makeGoal({ targetDate: '2027-03-31', deposits: [{ amountCents: 500, date: '2026-11-05', extra: 1 }] });
  assert.deepStrictEqual(logic.cleanGoal({ ...good, isAdmin: true }),
    { ...good, deposits: [{ amountCents: 500, date: '2026-11-05' }] });
  const broken = [
    null, 'goal', makeGoal({ id: '' }), makeGoal({ name: '  ' }), makeGoal({ targetCents: 12.5 }),
    makeGoal({ targetCents: 0 }), makeGoal({ targetDate: '2026-02-30' }), makeGoal({ targetDate: undefined }),
    makeGoal({ deposits: 'lots' }), makeGoal({ deposits: [{ amountCents: -5, date: '2026-11-05' }] }),
    makeGoal({ deposits: [{ amountCents: 5, date: 'soon' }] }),
  ];
  for (const raw of broken) assert.strictEqual(logic.cleanGoal(raw), null, 'should refuse ' + JSON.stringify(raw));
});

test('backup: goals go out and come back the same', () => {
  const goals = [makeGoal({ deposits: [{ amountCents: 1234, date: '2026-11-05' }] }), makeGoal({ targetDate: '2027-01-31' })];
  const text = JSON.stringify(logic.buildBackup([], null, 'x', { goals }));
  const result = logic.parseBackup(text);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.goals, goals);
  assert.strictEqual(result.skippedGoalCount, 0);
});

test('backup: an old version 1 file (no goals) still imports', () => {
  const entry = makeEntry({});
  const oldFile = JSON.stringify({ app: 'pocket-budget', version: 1, exportedAt: 'x', hourlyWageCents: 1575, entries: [entry] });
  const result = logic.parseBackup(oldFile);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.entries, [entry]);
  assert.deepStrictEqual(result.goals, []);
  assert.strictEqual(result.hourlyWageCents, 1575);
});

test('backup: bad or repeated goals are left out and counted', () => {
  const good = makeGoal({});
  const result = logic.parseBackup(backupText([], { goals: [good, { ...good }, makeGoal({ targetCents: -1 }), 'x'] }));
  assert.deepStrictEqual(result.goals, [good]);
  assert.strictEqual(result.skippedGoalCount, 3);
  // "goals" that isn't a list is treated as no goals, not as a broken file.
  assert.deepStrictEqual(logic.parseBackup(backupText([], { goals: 'lots' })).goals, []);
});

test('mergeById: goals are added, never replaced', () => {
  const here = makeGoal({ name: 'Mine' });
  const fromFile = makeGoal({ name: 'From file' });
  const result = logic.mergeById([here], [{ ...here, name: 'Changed' }, fromFile]);
  assert.deepStrictEqual(result.items.map((g) => g.name), ['Mine', 'From file']);
  assert.strictEqual(result.addedCount, 1);
});

test('importSummary mentions goals', () => {
  assert.strictEqual(logic.importSummary(0, 0, 0, false, { goalsAdded: 2, goalsSkipped: 1 }),
    'No new entries to add. Added 2 goals. 1 goal didn\'t look right and was left out.');
});

// ---------- 3.2 Monthly budget per category ----------

test('cleanBudgets: only real expense categories with whole cents', () => {
  assert.deepStrictEqual(logic.cleanBudgets({ Food: 20000, Fun: 5000 }), { Food: 20000, Fun: 5000 });
  assert.deepStrictEqual(logic.cleanBudgets({ Food: 12.5, Fun: 0, Bills: -100, School: '5000', Pizza: 100, Job: 100 }), {});
  assert.deepStrictEqual(logic.cleanBudgets({ Food: 100000001 }), {}); // over $1,000,000
  for (const raw of [null, undefined, 'x', [20000], 42]) assert.deepStrictEqual(logic.cleanBudgets(raw), {});
});

test('setBudget: sets, changes and removes, without changing the original', () => {
  const start = { Food: 20000 };
  const changed = logic.setBudget(start, 'Fun', 5000);
  assert.deepStrictEqual(changed, { Food: 20000, Fun: 5000 });
  assert.deepStrictEqual(logic.setBudget(changed, 'Food', 25000), { Food: 25000, Fun: 5000 });
  assert.deepStrictEqual(logic.setBudget(changed, 'Food', null), { Fun: 5000 });
  assert.deepStrictEqual(start, { Food: 20000 });
});

test('budgetRows: spent, left and percent, in button order, expenses only', () => {
  const entries = [
    makeEntry({ category: 'Fun', amountCents: 1250 }),
    makeEntry({ category: 'Food', amountCents: 5000 }),
    makeEntry({ category: 'Food', amountCents: 2500 }),
    makeEntry({ type: 'income', category: 'Job', amountCents: 99999 }),
    makeEntry({ category: 'Transport', amountCents: 900 }), // no budget: not shown
  ];
  assert.deepStrictEqual(logic.budgetRows(entries, { Fun: 5000, Food: 20000 }), [
    { category: 'Food', limitCents: 20000, spentCents: 7500, leftCents: 12500, percent: 37, isOver: false, rolledOverCents: 0 },
    { category: 'Fun', limitCents: 5000, spentCents: 1250, leftCents: 3750, percent: 25, isOver: false, rolledOverCents: 0 },
  ]);
});

test('budgetRows: no budgets set gives no rows', () => {
  assert.deepStrictEqual(logic.budgetRows([makeEntry({})], {}), []);
  assert.deepStrictEqual(logic.budgetRows([], {}), []);
});

test('budgetRows: going over keeps the bar at 100 and left goes below zero', () => {
  const [row] = logic.budgetRows([makeEntry({ category: 'Fun', amountCents: 6200 })], { Fun: 5000 });
  assert.strictEqual(row.percent, 100);
  assert.strictEqual(row.leftCents, -1200);
  assert.strictEqual(row.isOver, true);
  const [exact] = logic.budgetRows([makeEntry({ category: 'Fun', amountCents: 5000 })], { Fun: 5000 });
  assert.strictEqual(exact.isOver, false);
  assert.strictEqual(exact.leftCents, 0);
});

test('budgetStatusText: calm sentences, no alarm words', () => {
  const row = (spentCents, limitCents) => ({ spentCents, limitCents, leftCents: limitCents - spentCents });
  assert.strictEqual(logic.budgetStatusText(row(0, 20000)), 'Nothing spent yet, $200 to use');
  assert.strictEqual(logic.budgetStatusText(row(7550, 20000)), '$124.50 left of $200');
  assert.strictEqual(logic.budgetStatusText(row(20000, 20000)), 'All $200 used, right on plan');
  const over = logic.budgetStatusText(row(21200, 20000));
  assert.strictEqual(over, '$12 more than planned. A plan is a guide, not a test.');
  assert.ok(!/over budget|warning|too much|-\$/i.test(over));
});

test('backup: budgets go out and come back; old files have none', () => {
  const text = JSON.stringify(logic.buildBackup([], null, 'x', { budgets: { Food: 20000 } }));
  assert.deepStrictEqual(logic.parseBackup(text).budgets, { Food: 20000 });
  const oldFile = JSON.stringify({ app: 'pocket-budget', version: 1, exportedAt: 'x', entries: [] });
  assert.deepStrictEqual(logic.parseBackup(oldFile).budgets, {});
  assert.deepStrictEqual(logic.parseBackup(backupText([], { budgets: { Food: 'lots', Fun: 500 } })).budgets, { Fun: 500 });
});

test('mergeBudgets: what is here wins, missing categories are filled in', () => {
  const result = logic.mergeBudgets({ Food: 20000 }, { Food: 99999, Fun: 5000 });
  assert.deepStrictEqual(result.budgets, { Food: 20000, Fun: 5000 });
  assert.strictEqual(result.restoredCount, 1);
  assert.strictEqual(logic.importSummary(0, 0, 0, false, { budgetsRestored: 2 }), 'No new entries to add. Restored 2 budgets.');
});

// ---------- 3.3 Safe to spend ----------

test('daysInMonth: 28, 29, 30 and 31', () => {
  assert.strictEqual(logic.daysInMonth('2026-02'), 28);
  assert.strictEqual(logic.daysInMonth('2028-02'), 29); // leap year
  assert.strictEqual(logic.daysInMonth('2026-11'), 30);
  assert.strictEqual(logic.daysInMonth('2026-12'), 31);
});

test('daysLeftInMonth counts today, and is 1 on the last day', () => {
  assert.strictEqual(logic.daysLeftInMonth('2026-11-01'), 30);
  assert.strictEqual(logic.daysLeftInMonth('2026-11-05'), 26);
  assert.strictEqual(logic.daysLeftInMonth('2026-11-30'), 1);
  assert.strictEqual(logic.daysLeftInMonth('2028-02-29'), 1);
  assert.strictEqual(logic.daysLeftInMonth('2026-12-31'), 1);
});

test('monthsBetween crosses years', () => {
  assert.strictEqual(logic.monthsBetween('2026-11', '2026-11'), 0);
  assert.strictEqual(logic.monthsBetween('2026-11', '2027-03'), 4);
  assert.strictEqual(logic.monthsBetween('2026-11', '2027-11'), 12);
});

test('goalMonthlyPlanCents: missing amount shared over the months left, rounded up', () => {
  // $300 by March 2027, seen in November 2026: Nov, Dec, Jan, Feb, Mar = 5 months.
  assert.strictEqual(logic.goalMonthlyPlanCents(makeGoal({ targetDate: '2027-03-31' }), '2026-11'), 6000);
  // $100 over 3 months = $33.333...: rounded UP to $33.34 so the plan reaches the target.
  assert.strictEqual(logic.goalMonthlyPlanCents(makeGoal({ targetCents: 10000, targetDate: '2027-01-15' }), '2026-11'), 3334);
  // Target month is this month: everything missing is planned now.
  assert.strictEqual(logic.goalMonthlyPlanCents(makeGoal({ targetDate: '2026-11-30' }), '2026-11'), 30000);
});

test('goalMonthlyPlanCents: uses what was saved BEFORE this month, so adding money now does not move the plan', () => {
  const goal = makeGoal({
    targetDate: '2027-03-31',
    deposits: [{ amountCents: 5000, date: '2026-10-10' }, { amountCents: 2000, date: '2026-11-03' }],
  });
  assert.strictEqual(logic.goalMonthlyPlanCents(goal, '2026-11'), 5000); // (30000 - 5000) / 5
  assert.strictEqual(logic.goalAddedInMonth(goal, '2026-11'), 2000);
  assert.strictEqual(logic.goalAddedInMonth(goal, '2026-10'), 5000);
});

test('goalMonthlyPlanCents: 0 with no date, a past date, or when reached', () => {
  assert.strictEqual(logic.goalMonthlyPlanCents(makeGoal({}), '2026-11'), 0);
  assert.strictEqual(logic.goalMonthlyPlanCents(makeGoal({ targetDate: '2026-10-31' }), '2026-11'), 0);
  const reached = makeGoal({ targetDate: '2027-03-31', deposits: [{ amountCents: 30000, date: '2026-10-01' }] });
  assert.strictEqual(logic.goalMonthlyPlanCents(reached, '2026-11'), 0);
});

test('goalsSetAsideCents: the plan or what was added, whichever is bigger', () => {
  const planned = makeGoal({ targetDate: '2027-03-31' }); // plan 6000
  const partly = { ...planned, id: 'p2', deposits: [{ amountCents: 2000, date: '2026-11-02' }] }; // plan 6000, added 2000
  const extra = { ...planned, id: 'p3', deposits: [{ amountCents: 8000, date: '2026-11-02' }] }; // plan 6000, added 8000
  const noDate = makeGoal({ deposits: [{ amountCents: 1500, date: '2026-11-02' }] }); // plan 0, added 1500
  assert.strictEqual(logic.goalsSetAsideCents([planned], '2026-11'), 6000);
  assert.strictEqual(logic.goalsSetAsideCents([partly], '2026-11'), 6000);
  assert.strictEqual(logic.goalsSetAsideCents([extra], '2026-11'), 8000);
  assert.strictEqual(logic.goalsSetAsideCents([noDate], '2026-11'), 1500);
  assert.strictEqual(logic.goalsSetAsideCents([], '2026-11'), 0);
});

test('billsStillToPayCents: unspent part of the Bills budget, never below 0', () => {
  const bills = [makeEntry({ category: 'Bills', amountCents: 3000 }), makeEntry({ category: 'Food', amountCents: 9999 })];
  assert.strictEqual(logic.billsStillToPayCents(bills, { Bills: 8000 }), 5000);
  assert.strictEqual(logic.billsStillToPayCents(bills, { Bills: 2000 }), 0); // already paid more
  assert.strictEqual(logic.billsStillToPayCents(bills, {}), 0); // no Bills budget set
  assert.strictEqual(logic.billsStillToPayCents([], { Bills: 8000 }), 8000);
});

const pay = (cents) => makeEntry({ type: 'income', category: 'Job', amountCents: cents });

test('safeToSpend: left minus goals and bills, divided by the days left', () => {
  const entries = [pay(60000), makeEntry({ category: 'Food', amountCents: 10000 }), makeEntry({ category: 'Bills', amountCents: 3000 })];
  const goals = [makeGoal({ targetDate: '2027-03-31' })]; // 6000 this month
  const safe = logic.safeToSpend(entries, goals, { Bills: 8000 }, '2026-11-05');
  assert.deepStrictEqual(safe, {
    inCents: 60000,
    leftCents: 47000,
    goalsCents: 6000,
    billsCents: 5000,
    availableCents: 36000,
    daysLeft: 26,
    perDayCents: 1384, // 36000 / 26 = 1384.6..., rounded DOWN
  });
});

test('safeToSpend: no budgets and no goals is just left / days', () => {
  const safe = logic.safeToSpend([pay(10000)], [], {}, '2026-11-28'); // 3 days left
  assert.strictEqual(safe.availableCents, 10000);
  assert.strictEqual(safe.perDayCents, 3333); // $33.33, never $33.34
});

test('safeToSpend: on the last day of the month, everything left is for today', () => {
  const safe = logic.safeToSpend([pay(4567)], [], {}, '2026-11-30');
  assert.strictEqual(safe.daysLeft, 1);
  assert.strictEqual(safe.perDayCents, 4567);
  assert.strictEqual(logic.safeToSpendDetail(safe), '$45.67 for today, the last day of the month.');
});

test('safeToSpend: never negative per day', () => {
  // More out than in.
  const minus = logic.safeToSpend([pay(1000), makeEntry({ amountCents: 5000 })], [], {}, '2026-11-05');
  assert.strictEqual(minus.availableCents, -4000);
  assert.strictEqual(minus.perDayCents, 0);
  // Left is positive but goals take it all.
  const planned = logic.safeToSpend([pay(5000)], [makeGoal({ targetDate: '2026-11-30' })], {}, '2026-11-05');
  assert.strictEqual(planned.perDayCents, 0);
  // Less than 1 cent a day rounds down to 0.
  assert.strictEqual(logic.safeToSpend([pay(25)], [], {}, '2026-11-05').perDayCents, 0);
});

test('safeToSpendDetail: calm sentences, never a minus sign', () => {
  const entries = [pay(60000), makeEntry({ category: 'Bills', amountCents: 3000 })];
  const safe = logic.safeToSpend(entries, [makeGoal({ targetDate: '2027-03-31' })], { Bills: 8000 }, '2026-11-05');
  assert.strictEqual(logic.safeToSpendDetail(safe),
    '$460.00 for the next 26 days ($570.00 left, minus $60.00 for goals and $50.00 for bills).');
  assert.strictEqual(logic.safeToSpendDetail(logic.safeToSpend([pay(5000)], [], {}, '2026-11-05')),
    '$50.00 for the next 26 days.');
  const noIncome = logic.safeToSpendDetail(logic.safeToSpend([makeEntry({})], [], {}, '2026-11-05'));
  assert.ok(/Add your money in/.test(noIncome));
  const allPlanned = logic.safeToSpendDetail(logic.safeToSpend([pay(5000)], [makeGoal({ targetDate: '2026-11-30' })], {}, '2026-11-05'));
  assert.ok(/already set aside/.test(allPlanned));
  const below = logic.safeToSpendDetail(logic.safeToSpend([pay(1000), makeEntry({ amountCents: 5000 })], [], {}, '2026-11-05'));
  for (const text of [noIncome, allPlanned, below]) assert.ok(!/-\$|warning|over/i.test(text), text);
});

test('goalPlanText: plan this month, past date, or nothing', () => {
  const goal = makeGoal({ targetDate: '2027-03-31', deposits: [{ amountCents: 2000, date: '2026-11-03' }] });
  assert.strictEqual(logic.goalPlanText(goal, '2026-11'), 'This month\'s plan: $60.00 ($20.00 added)');
  assert.strictEqual(logic.goalPlanText(makeGoal({ targetDate: '2027-03-31' }), '2026-11'), 'This month\'s plan: $60.00');
  assert.ok(/No rush/.test(logic.goalPlanText(makeGoal({ targetDate: '2026-10-01' }), '2026-11')));
  assert.strictEqual(logic.goalPlanText(makeGoal({}), '2026-11'), '');
});

// ---------- 3.4 Budget styles ----------

test('every expense category is either a need or a want, never both', () => {
  for (const category of logic.EXPENSE_CATEGORIES) {
    const inNeeds = logic.NEEDS_CATEGORIES.includes(category);
    const inWants = logic.WANTS_CATEGORIES.includes(category);
    assert.ok(inNeeds !== inWants, category);
  }
});

test('splitTargets: 50/30/20 that always adds up to the exact money in', () => {
  assert.deepStrictEqual(logic.splitTargets(100000), { needsCents: 50000, wantsCents: 30000, savingsCents: 20000 });
  // $10.01 doesn't split evenly: needs 500.5 -> 500, wants 300.3 -> 300, savings gets the rest (201).
  assert.deepStrictEqual(logic.splitTargets(1001), { needsCents: 500, wantsCents: 300, savingsCents: 201 });
  assert.deepStrictEqual(logic.splitTargets(0), { needsCents: 0, wantsCents: 0, savingsCents: 0 });
  for (const cents of [1, 7, 99, 12345, 99999999]) {
    const t = logic.splitTargets(cents);
    assert.strictEqual(t.needsCents + t.wantsCents + t.savingsCents, cents);
  }
});

test('fiftyThirtyTwenty: needs, wants and goal savings against the guide', () => {
  const entries = [
    pay(100000),
    makeEntry({ category: 'Food', amountCents: 20000 }),
    makeEntry({ category: 'Bills', amountCents: 15000 }),
    makeEntry({ category: 'Fun', amountCents: 40000 }), // above the $300 guide
    makeEntry({ category: 'Other', amountCents: 1000 }),
    makeEntry({ category: 'Food', amountCents: 5000, date: '2026-10-10' }), // another month: not passed in
  ];
  const monthEntries = logic.entriesInMonth(entries, '2026-11');
  const goals = [makeGoal({ deposits: [{ amountCents: 7500, date: '2026-11-02' }, { amountCents: 9999, date: '2026-10-02' }] })];
  const split = logic.fiftyThirtyTwenty(monthEntries, goals, '2026-11');
  assert.strictEqual(split.inCents, 100000);
  assert.deepStrictEqual(split.rows, [
    { group: 'Needs', guidePercent: 50, targetCents: 50000, actualCents: 35000, percent: 70 },
    { group: 'Wants', guidePercent: 30, targetCents: 30000, actualCents: 41000, percent: 100 },
    { group: 'Savings', guidePercent: 20, targetCents: 20000, actualCents: 7500, percent: 37 },
  ]);
});

test('fiftyThirtyTwenty: no money in gives zero guides and empty bars', () => {
  const split = logic.fiftyThirtyTwenty([makeEntry({ category: 'Fun', amountCents: 500 })], [], '2026-11');
  assert.strictEqual(split.inCents, 0);
  assert.deepStrictEqual(split.rows.map((r) => [r.targetCents, r.percent]), [[0, 0], [0, 0], [0, 0]]);
});

test('splitRowText: plain facts, and saving more is good news', () => {
  const row = (group, actualCents, targetCents) => ({ group, actualCents, targetCents });
  assert.strictEqual(logic.splitRowText(row('Needs', 35000, 50000)), '$350 of $500');
  assert.strictEqual(logic.splitRowText(row('Wants', 41000, 30000)), '$410, a bit above the $300 guide');
  assert.strictEqual(logic.splitRowText(row('Savings', 25000, 20000)), '$250, above the $200 guide. Nice!');
});

test('cleanSettings: unknown or missing values fall back to the defaults', () => {
  assert.deepStrictEqual(logic.cleanSettings({ budgetStyle: '503020' }), { budgetStyle: '503020', rollover: false });
  for (const raw of [undefined, null, 'x', [], {}, { budgetStyle: 'fancy' }, { budgetStyle: 503020 }]) {
    assert.deepStrictEqual(logic.cleanSettings(raw), logic.DEFAULT_SETTINGS);
  }
  assert.deepStrictEqual(Object.keys(logic.cleanSettings({ budgetStyle: 'simple', admin: true })), Object.keys(logic.DEFAULT_SETTINGS));
});

test('backup: settings go out and come back; a file without settings gives null', () => {
  const text = JSON.stringify(logic.buildBackup([], null, 'x', { settings: { budgetStyle: '503020' } }));
  assert.deepStrictEqual(logic.parseBackup(text).settings, { budgetStyle: '503020', rollover: false });
  const oldFile = JSON.stringify({ app: 'pocket-budget', version: 1, exportedAt: 'x', entries: [] });
  assert.strictEqual(logic.parseBackup(oldFile).settings, null);
});

test('mergeSettings: the file is used only if the settings here were never changed', () => {
  const defaults = logic.cleanSettings({});
  const picked = { budgetStyle: '503020', rollover: false };
  assert.deepStrictEqual(logic.mergeSettings(defaults, picked), { settings: picked, restored: true });
  assert.deepStrictEqual(logic.mergeSettings(picked, defaults), { settings: picked, restored: false });
  assert.deepStrictEqual(logic.mergeSettings(defaults, null), { settings: defaults, restored: false });
  assert.deepStrictEqual(logic.mergeSettings(defaults, defaults).restored, false); // nothing really changed
  assert.ok(/settings were restored/.test(logic.importSummary(0, 0, 0, false, { settingsRestored: true })));
});

// ---------- 3.5 Rollover ----------

test('cleanSettings: rollover is off unless it is really true', () => {
  assert.strictEqual(logic.cleanSettings({}).rollover, false);
  assert.strictEqual(logic.cleanSettings({ rollover: true }).rollover, true);
  for (const value of ['true', 1, 'yes', null]) assert.strictEqual(logic.cleanSettings({ rollover: value }).rollover, false);
  // A backup from before 3.5 (style only) still gives full settings.
  assert.deepStrictEqual(logic.cleanSettings({ budgetStyle: '503020' }), { budgetStyle: '503020', rollover: false });
});

const october = (category, amountCents) => makeEntry({ category, amountCents, date: '2026-10-15' });

test('effectiveLimits: off means the plain budgets', () => {
  const result = logic.effectiveLimits({ Fun: 5000 }, [october('Fun', 3000)], false);
  assert.deepStrictEqual(result, { limits: { Fun: 5000 }, rolledOver: {} });
});

test('effectiveLimits: unspent part of last month is added', () => {
  const previous = [october('Fun', 3000), october('Food', 20000), makeEntry({ type: 'income', category: 'Job', amountCents: 9999, date: '2026-10-01' })];
  const result = logic.effectiveLimits({ Fun: 5000, Food: 20000, School: 4000 }, previous, true);
  assert.deepStrictEqual(result.limits, { Fun: 7000, Food: 20000, School: 8000 }); // School: nothing spent, all $40 rolls over
  assert.deepStrictEqual(result.rolledOver, { Fun: 2000, School: 4000 }); // Food was fully used
});

test('effectiveLimits: spending more last month never makes this month smaller', () => {
  const result = logic.effectiveLimits({ Fun: 5000 }, [october('Fun', 8000)], true);
  assert.deepStrictEqual(result, { limits: { Fun: 5000 }, rolledOver: {} });
});

test('effectiveLimits: nothing rolls over from a month with no entries, or with no budgets', () => {
  assert.deepStrictEqual(logic.effectiveLimits({ Fun: 5000 }, [], true), { limits: { Fun: 5000 }, rolledOver: {} });
  assert.deepStrictEqual(logic.effectiveLimits({}, [october('Fun', 100)], true), { limits: {}, rolledOver: {} });
});

test('effectiveLimits: does not change the saved budgets object', () => {
  const budgets = { Fun: 5000 };
  logic.effectiveLimits(budgets, [october('Fun', 1000)], true);
  assert.deepStrictEqual(budgets, { Fun: 5000 });
});

test('budgetRows + rollover: the row uses the bigger limit and remembers what rolled over', () => {
  const { limits, rolledOver } = logic.effectiveLimits({ Fun: 5000 }, [october('Fun', 3000)], true);
  const [row] = logic.budgetRows([makeEntry({ category: 'Fun', amountCents: 6000 })], limits, rolledOver);
  assert.deepStrictEqual(row, {
    category: 'Fun', limitCents: 7000, spentCents: 6000, leftCents: 1000, percent: 85, isOver: false, rolledOverCents: 2000,
  });
  // Without rollover the same spending would be over the plan.
  assert.strictEqual(logic.budgetRows([makeEntry({ category: 'Fun', amountCents: 6000 })], { Fun: 5000 })[0].isOver, true);
});

test('rolloverText names last month, or is empty', () => {
  assert.strictEqual(logic.rolloverText(2000, '2026-10'), 'Includes $20 not spent in October');
  assert.strictEqual(logic.rolloverText(1250, '2025-12'), 'Includes $12.50 not spent in December');
  assert.strictEqual(logic.rolloverText(0, '2026-10'), '');
});

test('backup: the rollover setting goes out and comes back', () => {
  const text = JSON.stringify(logic.buildBackup([], null, 'x', { settings: { budgetStyle: 'simple', rollover: true } }));
  assert.deepStrictEqual(logic.parseBackup(text).settings, { budgetStyle: 'simple', rollover: true });
  assert.strictEqual(logic.mergeSettings(logic.cleanSettings({}), { budgetStyle: 'simple', rollover: true }).restored, true);
});

// ---------- Summary ----------

if (failed > 0) {
  console.log('\n' + failed + ' test(s) failed, ' + passed + ' passed.');
  process.exitCode = 1; // tells GitHub Actions (and you) that something is wrong
} else {
  console.log('All tests passed (' + passed + ' tests)');
}
