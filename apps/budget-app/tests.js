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
    version: 1,
    exportedAt: '2026-11-05T12:00:00.000Z',
    hourlyWageCents: 1575,
    entries,
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
  const newer = logic.parseBackup(backupText([], { version: 2 }));
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

// ---------- Summary ----------

if (failed > 0) {
  console.log('\n' + failed + ' test(s) failed, ' + passed + ' passed.');
  process.exitCode = 1; // tells GitHub Actions (and you) that something is wrong
} else {
  console.log('All tests passed (' + passed + ' tests)');
}
