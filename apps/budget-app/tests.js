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

// ---------- Summary ----------

if (failed > 0) {
  console.log('\n' + failed + ' test(s) failed, ' + passed + ' passed.');
  process.exitCode = 1; // tells GitHub Actions (and you) that something is wrong
} else {
  console.log('All tests passed (' + passed + ' tests)');
}
