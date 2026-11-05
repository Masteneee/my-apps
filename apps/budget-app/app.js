// app.js: everything the person sees and clicks.
// It reads the form, asks logic.js to do the math, asks storage.js to save,
// and redraws the page. Functions like parseAmountToCents come from logic.js,
// and loadEntries/saveEntries from storage.js (both loaded before this file).

// ---------- Finding the page elements once ----------
// document.getElementById looks up an element by its id="..." in index.html.
const form = document.getElementById('entry-form');
const formTitle = document.getElementById('form-title');
const typeButtons = document.querySelectorAll('.type-button');
const amountInput = document.getElementById('amount');
const categoryButtonsBox = document.getElementById('category-buttons');
const noteInput = document.getElementById('note');
const dateInput = document.getElementById('date');
const formMessage = document.getElementById('form-message');
const saveButton = document.getElementById('save-button');
const cancelEditButton = document.getElementById('cancel-edit');
const deleteArea = document.getElementById('delete-area');
const deleteButton = document.getElementById('delete-button');
const deleteConfirm = document.getElementById('delete-confirm');
const confirmDeleteButton = document.getElementById('confirm-delete');
const keepEntryButton = document.getElementById('keep-entry');

const monthHeading = document.getElementById('month-heading');
const monthLabelText = document.getElementById('month-label');
const prevMonthButton = document.getElementById('prev-month');
const nextMonthButton = document.getElementById('next-month');
const backToTodayButton = document.getElementById('back-to-today');
const leftLabel = document.getElementById('left-label');
const compareTitle = document.getElementById('compare-title');
const compareList = document.getElementById('compare-list');
const compareEmpty = document.getElementById('compare-empty');
const totalInText = document.getElementById('total-in');
const totalOutText = document.getElementById('total-out');
const totalLeftText = document.getElementById('total-left');
const leftNote = document.getElementById('left-note');
const safeBox = document.getElementById('safe-box');
const safeLine = document.getElementById('safe-line');
const safePerDay = document.getElementById('safe-per-day');
const safeUnit = document.getElementById('safe-unit');
const safeDetail = document.getElementById('safe-detail');
const categoryTotalsList = document.getElementById('category-totals');
const categoriesEmpty = document.getElementById('categories-empty');
const chartBox = document.getElementById('chart-box');
const chartCanvas = document.getElementById('category-chart');
const chartOffline = document.getElementById('chart-offline');
const entryList = document.getElementById('entry-list');
const listEmpty = document.getElementById('list-empty');
const listHint = document.getElementById('list-hint');
const wageForm = document.getElementById('wage-form');
const wageInput = document.getElementById('wage');
const wageMessage = document.getElementById('wage-message');
const clearWageButton = document.getElementById('clear-wage');
const exportButton = document.getElementById('export-button');
const importButton = document.getElementById('import-button');
const importFile = document.getElementById('import-file');
const backupMessage = document.getElementById('backup-message');
const goalList = document.getElementById('goal-list');
const goalsEmpty = document.getElementById('goals-empty');
const goalForm = document.getElementById('goal-form');
const goalNameInput = document.getElementById('goal-name');
const goalTargetInput = document.getElementById('goal-target');
const goalDateInput = document.getElementById('goal-date');
const goalMessage = document.getElementById('goal-message');
const planMonth = document.getElementById('plan-month');
const budgetList = document.getElementById('budget-list');
const budgetsEmpty = document.getElementById('budgets-empty');
const budgetForm = document.getElementById('budget-form');
const budgetCategorySelect = document.getElementById('budget-category');
const budgetAmountInput = document.getElementById('budget-amount');
const budgetMessage = document.getElementById('budget-message');
const styleButtons = document.querySelectorAll('.style-button');
const styleSimpleText = document.getElementById('style-simple-text');
const splitBox = document.getElementById('split-box');
const splitList = document.getElementById('split-list');
const splitEmpty = document.getElementById('split-empty');
const rolloverToggle = document.getElementById('rollover-toggle');
const rolloverMessage = document.getElementById('rollover-message');

// ---------- State: what the app remembers while the page is open ----------
let entries = loadEntries(); // every entry ever saved (all months)
let currentType = 'expense'; // which toggle is on: 'expense' or 'income'
let selectedCategory = null; // the category button that's pressed, or null
let editingId = null; // id of the entry being edited, or null when adding
let messageTimer = null; // used to clear the "Saved" message after a moment
let categoryChart = null; // the Chart.js chart, created the first time it's needed
let viewedMonth = monthKey(todayISO()); // the month on screen, like "2026-11" (task 2.2)
let hourlyWageCents = loadHourlyWageCents(); // cents per hour, or null if not set (task 2.3)
let goals = loadGoals(); // savings goals (task 3.1)
let goalNotice = null; // { id, text }: a short message under one goal, like "Added $20."
let confirmingGoalId = null; // the goal showing "Delete this goal?", or null
let budgets = loadBudgets(); // { Food: 20000, ... } monthly limits in cents (task 3.2)
let settings = loadSettings(); // { budgetStyle: 'simple' or '503020', rollover: true/false } (3.4, 3.5)

// A unique-enough id for a new entry: the time in base 36 plus random letters.
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Small helpers ----------

function showMessage(text) {
  formMessage.textContent = text;
  clearTimeout(messageTimer);
  // Success messages fade away by themselves after 4 seconds.
  messageTimer = setTimeout(() => {
    formMessage.textContent = '';
  }, 4000);
}

// Draws the category buttons for the current type (expense or income).
function renderCategoryButtons() {
  categoryButtonsBox.innerHTML = '';
  for (const category of categoriesFor(currentType)) {
    const button = document.createElement('button');
    button.type = 'button'; // without this, a button inside a form submits it
    button.className = 'category-button';
    button.dataset.category = category; // becomes data-category="Food"
    button.setAttribute('aria-pressed', String(category === selectedCategory));
    button.textContent = CATEGORY_ICONS[category] + ' ' + category;
    categoryButtonsBox.appendChild(button);
  }
}

function setType(type) {
  currentType = type;
  for (const button of typeButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.type === type));
  }
  // "Food" makes no sense for income, so forget a category that doesn't fit.
  if (!categoriesFor(type).includes(selectedCategory)) selectedCategory = null;
  renderCategoryButtons();
}

// Puts the form back to "Add an entry" with empty fields and today's date.
function resetForm() {
  editingId = null;
  formTitle.textContent = 'Add an entry';
  saveButton.textContent = 'Save';
  cancelEditButton.hidden = true;
  deleteArea.hidden = true;
  deleteConfirm.hidden = true;
  deleteButton.hidden = false;
  amountInput.value = '';
  noteInput.value = '';
  dateInput.value = todayISO();
  selectedCategory = null;
  setType(currentType); // keep the toggle where it was: handy for several expenses in a row
  amountInput.focus();
}

// ---------- Drawing the page from the data ----------
// We never patch the page bit by bit. After every change we redraw it all
// from the "entries" list. Simpler, and the screen can't get out of sync.

function render() {
  const today = todayISO();
  const todayKey = monthKey(today);
  const range = monthRange(entries, todayKey);
  viewedMonth = clampMonth(viewedMonth, range);
  const isThisMonth = viewedMonth === todayKey;

  const monthEntries = entriesInMonth(entries, viewedMonth);
  const previousEntries = entriesInMonth(entries, shiftMonth(viewedMonth, -1));

  renderMonthSwitcher(range, isThisMonth);
  renderSafeToSpend(monthEntries, today, isThisMonth);
  renderSummary(monthEntries, isThisMonth);
  renderBudgetStyle(monthEntries);
  renderBudgets(monthEntries, previousEntries);
  renderCategoryTotals(monthEntries, isThisMonth);
  renderComparison(monthEntries, previousEntries, todayKey);
  renderEntryList(monthEntries, today, isThisMonth);
  renderGoals();
}

// Task 2.2: the month name, and which switcher buttons make sense right now.
function renderMonthSwitcher(range, isThisMonth) {
  monthHeading.textContent = isThisMonth ? 'This month' : 'Looking back';
  monthLabelText.textContent = monthLabel(viewedMonth);
  // "disabled" greys out a button and makes it ignore clicks.
  prevMonthButton.disabled = viewedMonth <= range.first;
  nextMonthButton.disabled = viewedMonth >= range.last;
  backToTodayButton.hidden = isThisMonth;
}

// Task 3.3: "Safe to spend: $12.34 a day". All the math is in logic.js.
// When nothing extra is available we never show $0.00 or a minus sign:
// the big number is hidden and only the calm sentence stays.
function renderSafeToSpend(monthEntries, today, isThisMonth) {
  safeBox.hidden = !isThisMonth; // looking back at October: "days left" makes no sense
  if (!isThisMonth) return;
  const safe = safeToSpend(monthEntries, goals, budgets, today);
  const hasSome = safe.perDayCents > 0;
  safeLine.hidden = !hasSome;
  safePerDay.textContent = formatCents(safe.perDayCents);
  safeUnit.textContent = safe.daysLeft === 1 ? 'today' : 'a day';
  safeDetail.textContent = safeToSpendDetail(safe);
  safeDetail.classList.toggle('is-note', !hasSome); // the note alone reads a bit bigger
}

function renderSummary(monthEntries, isThisMonth) {
  const totals = monthTotals(monthEntries);
  totalInText.textContent = formatCents(totals.inCents);
  totalOutText.textContent = formatCents(totals.outCents);
  totalLeftText.textContent = formatCents(totals.leftCents);
  leftLabel.textContent = isThisMonth ? 'Left this month' : 'Left that month';

  // Below zero is shown calmly, in the same colour, with a kind note.
  // If no income is logged yet, "left" is negative only because it's missing,
  // so we invite adding it instead.
  if (totals.inCents === 0 && totals.outCents > 0) {
    leftNote.textContent = 'Add your money in (job pay, gifts) with the "Money in" button to see what\'s left.';
    leftNote.hidden = false;
  } else if (totals.leftCents < 0) {
    leftNote.textContent = 'A bit more went out than came in ' + (isThisMonth ? 'this' : 'that') +
      ' month. That happens, and seeing it is the first step.';
    leftNote.hidden = false;
  } else {
    leftNote.hidden = true;
  }
}

function renderCategoryTotals(monthEntries, isThisMonth) {
  const rows = totalsByCategory(monthEntries);
  categoryTotalsList.innerHTML = '';
  categoriesEmpty.hidden = rows.length > 0;
  categoriesEmpty.textContent = isThisMonth
    ? 'Nothing spent yet this month.'
    : 'Nothing spent in ' + monthLabel(viewedMonth) + '.';

  for (const row of rows) {
    const item = document.createElement('li');
    item.className = 'category-row';

    const name = document.createElement('span');
    name.textContent = (CATEGORY_ICONS[row.category] || '') + ' ' + row.category;

    const amount = document.createElement('span');
    amount.className = 'category-amount';
    amount.textContent = formatCents(row.cents);

    // A thin bar whose width is this category's share of all spending.
    // Same colour as its slice in the chart, so the list doubles as the legend.
    const bar = document.createElement('span');
    bar.className = 'category-bar';
    bar.style.width = row.percent + '%';
    bar.style.background = CATEGORY_COLORS[row.category] || '';
    bar.setAttribute('aria-hidden', 'true'); // decoration only

    item.append(name, amount, bar);
    categoryTotalsList.appendChild(item);
  }

  renderChart(rows);
}

// Task 2.1: the doughnut chart. Chart.js comes from a CDN, so it may be missing
// (no internet). typeof Chart is 'undefined' then, and we keep only the list.
function renderChart(rows) {
  const chartLoaded = typeof Chart !== 'undefined';
  const hasSpending = rows.length > 0;
  chartOffline.hidden = chartLoaded || !hasSpending;
  chartBox.hidden = !chartLoaded || !hasSpending;
  if (chartBox.hidden) return;

  const slices = chartSlices(rows);
  chartCanvas.setAttribute('aria-label', chartDescription(rows));

  try {
    if (categoryChart === null) {
      // First time: create the chart. "new Chart(where, settings)".
      categoryChart = new Chart(chartCanvas, {
        type: 'doughnut',
        data: {
          labels: slices.labels,
          datasets: [{ data: slices.cents, backgroundColor: slices.colors, borderColor: '#ffffff', borderWidth: 2 }],
        },
        options: {
          responsive: true, // follow the width of #chart-box
          maintainAspectRatio: false, // use the height from style.css
          cutout: '60%', // size of the hole in the middle
          plugins: {
            legend: { display: false }, // the list below is the legend
            tooltip: {
              // The data is in cents, so show it as money: 2500 -> "$25.00".
              callbacks: { label: (context) => ' ' + formatCents(context.parsed) },
            },
          },
        },
      });
    } else {
      // Later: change the data of the same chart and ask it to redraw.
      // Creating a new chart every time would stack them on one canvas.
      categoryChart.data.labels = slices.labels;
      categoryChart.data.datasets[0].data = slices.cents;
      categoryChart.data.datasets[0].backgroundColor = slices.colors;
      categoryChart.update();
    }
  } catch (error) {
    // If the library misbehaves, the list still has everything.
    console.warn('Could not draw the chart:', error);
    chartBox.hidden = true;
  }
}

// Task 2.2: "Food: $40 less than last month", one line per category.
function renderComparison(monthEntries, previousEntries, todayKey) {
  const otherMonthName = previousMonthName(viewedMonth, todayKey);
  const rows = compareCategories(monthEntries, previousEntries);
  const previousOut = monthTotals(previousEntries).outCents;

  // "in September" -> "Compared with September"
  compareTitle.textContent = 'Compared with ' + otherMonthName.replace(/^in /, '');
  compareList.innerHTML = '';

  // Nothing spent the month before: there's nothing fair to compare with.
  if (previousOut === 0) {
    compareEmpty.textContent = 'Nothing was spent ' + otherMonthName + ', so there\'s nothing to compare with.';
    compareEmpty.hidden = false;
    return;
  }
  compareEmpty.hidden = true;

  // First line: all spending together.
  const totalDiff = monthTotals(monthEntries).outCents - previousOut;
  compareList.appendChild(makeCompareRow('All spending', comparisonText(totalDiff, otherMonthName), true));

  for (const row of rows) {
    const name = (CATEGORY_ICONS[row.category] || '') + ' ' + row.category;
    compareList.appendChild(makeCompareRow(name, comparisonText(row.diffCents, otherMonthName), false));
  }
}

function makeCompareRow(name, text, isTotal) {
  const item = document.createElement('li');
  item.className = 'compare-row' + (isTotal ? ' compare-total' : '');
  const nameSpan = document.createElement('span');
  nameSpan.className = 'compare-name';
  nameSpan.textContent = name + ':';
  const textSpan = document.createElement('span');
  textSpan.textContent = text;
  item.append(nameSpan, ' ', textSpan);
  return item;
}

function renderEntryList(monthEntries, today, isThisMonth) {
  const sorted = sortNewestFirst(monthEntries);
  entryList.innerHTML = '';
  listEmpty.hidden = sorted.length > 0;
  listHint.hidden = sorted.length === 0;
  listEmpty.textContent = isThisMonth
    ? 'Nothing logged yet this month. Your first entry takes about 5 seconds.'
    : 'Nothing logged in ' + monthLabel(viewedMonth) + '.';

  for (const entry of sorted) {
    const item = document.createElement('li');

    // The whole row is a button, so it's easy to tap and works with the keyboard.
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'entry';
    button.dataset.id = entry.id;
    if (entry.id === editingId) button.classList.add('is-editing');

    const icon = document.createElement('span');
    icon.className = 'entry-icon';
    icon.textContent = CATEGORY_ICONS[entry.category] || '•';
    icon.setAttribute('aria-hidden', 'true');

    const middle = document.createElement('span');
    middle.className = 'entry-middle';
    const category = document.createElement('span');
    category.className = 'entry-category';
    category.textContent = entry.category;
    middle.appendChild(category);
    if (entry.note) {
      const note = document.createElement('span');
      note.className = 'entry-note';
      // textContent (not innerHTML) so a note like "<b>hi</b>" shows as text
      // instead of being run as HTML.
      note.textContent = entry.note;
      middle.appendChild(note);
    }
    // Task 2.3: "1.5 h of work", only for money out and only if a wage is set.
    const workText = entry.type === 'expense' ? workTimeText(entry.amountCents, hourlyWageCents) : '';
    if (workText !== '') {
      const work = document.createElement('span');
      work.className = 'entry-work';
      work.textContent = workText + ' of work';
      middle.appendChild(work);
    }

    const right = document.createElement('span');
    right.className = 'entry-right';
    const amount = document.createElement('span');
    const isIncome = entry.type === 'income';
    amount.className = 'entry-amount' + (isIncome ? ' money-in' : '');
    amount.textContent = (isIncome ? '+' : '') + formatCents(entry.amountCents);
    const date = document.createElement('span');
    date.className = 'entry-date';
    date.textContent = friendlyDate(entry.date, today);
    right.append(amount, date);

    button.append(icon, middle, right);
    item.appendChild(button);
    entryList.appendChild(item);
  }
}

// ---------- Saving ----------

// Saves to storage and redraws. Returns false if the browser refused to save.
function commit(newEntries) {
  entries = newEntries;
  const ok = saveEntries(entries);
  render();
  return ok;
}

function handleSubmit(event) {
  // Stop the browser from reloading the page, which is what a form does by default.
  event.preventDefault();

  const amountCents = parseAmountToCents(amountInput.value);
  if (amountCents === null) {
    formMessage.textContent = 'Type an amount like 12, 12.50 or 12,50.';
    amountInput.focus();
    return;
  }
  if (selectedCategory === null) {
    formMessage.textContent = 'Pick a category, then tap Save.';
    return;
  }

  const fields = {
    type: currentType,
    amountCents,
    category: selectedCategory,
    note: noteInput.value.trim(),
    date: dateInput.value || todayISO(), // if the date box was cleared, use today
  };

  let newEntries;
  let message;
  if (editingId === null) {
    const entry = { id: makeId(), ...fields, createdAt: Date.now() };
    newEntries = [...entries, entry];
    message = 'Saved: ' + formatCents(amountCents) + ' for ' + fields.category + '.';
  } else {
    newEntries = updateEntry(entries, editingId, fields);
    message = 'Changes saved.';
  }

  // Reset first (this clears editingId), then save and redraw once.
  // Show the month the entry belongs to, so you always see what you just saved
  // (even if you were looking at another month, or changed its date).
  resetForm();
  viewedMonth = monthKey(fields.date);
  const ok = commit(newEntries);
  showMessage(ok ? message : 'Added for now, but this browser would not save it. It may be in private mode.');
}

// ---------- Editing and deleting ----------

function startEditing(id) {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;

  editingId = id;
  selectedCategory = entry.category;
  setType(entry.type);
  amountInput.value = centsToInputValue(entry.amountCents);
  noteInput.value = entry.note;
  dateInput.value = entry.date;

  formTitle.textContent = 'Edit entry';
  saveButton.textContent = 'Save changes';
  cancelEditButton.hidden = false;
  deleteArea.hidden = false;
  deleteButton.hidden = false;
  deleteConfirm.hidden = true;
  formMessage.textContent = '';

  render(); // to highlight the entry being edited
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  amountInput.focus({ preventScroll: true });
}

function handleDeleteConfirmed() {
  const newEntries = deleteEntry(entries, editingId);
  resetForm();
  const ok = commit(newEntries);
  showMessage(ok ? 'Entry deleted.' : 'Deleted for now, but this browser would not save the change.');
}

// ---------- Event listeners: "when this happens, run that function" ----------

form.addEventListener('submit', handleSubmit);

for (const button of typeButtons) {
  button.addEventListener('click', () => setType(button.dataset.type));
}

// One listener on the box instead of one per button ("event delegation").
// The buttons are redrawn often, and this listener keeps working for new ones.
categoryButtonsBox.addEventListener('click', (event) => {
  const button = event.target.closest('.category-button');
  if (!button) return; // the click was in the gap between buttons
  selectedCategory = button.dataset.category;
  renderCategoryButtons();
  formMessage.textContent = '';
});

entryList.addEventListener('click', (event) => {
  const button = event.target.closest('.entry');
  if (button) startEditing(button.dataset.id);
});

cancelEditButton.addEventListener('click', () => {
  resetForm();
  render();
  formMessage.textContent = '';
});

deleteButton.addEventListener('click', () => {
  deleteButton.hidden = true;
  deleteConfirm.hidden = false;
  keepEntryButton.focus(); // the safe choice gets the focus
});

keepEntryButton.addEventListener('click', () => {
  deleteConfirm.hidden = true;
  deleteButton.hidden = false;
});

confirmDeleteButton.addEventListener('click', handleDeleteConfirmed);

// Task 2.2: month switcher. Change which month is on screen, then redraw.
// If you were editing an entry, stop: it may not be in the new month's list.
function showMonth(key) {
  if (editingId !== null) resetForm();
  viewedMonth = key;
  render();
}

prevMonthButton.addEventListener('click', () => showMonth(shiftMonth(viewedMonth, -1)));
nextMonthButton.addEventListener('click', () => showMonth(shiftMonth(viewedMonth, 1)));
backToTodayButton.addEventListener('click', () => showMonth(monthKey(todayISO())));

// ---------- Task 2.3: hourly wage setting ----------

// Shows the saved wage in the box ("15.75"), or an empty box if none.
function renderWage() {
  wageInput.value = hourlyWageCents === null ? '' : centsToInputValue(hourlyWageCents);
  clearWageButton.hidden = hourlyWageCents === null;
}

function setWage(newWageCents, message) {
  hourlyWageCents = newWageCents;
  const ok = saveHourlyWageCents(newWageCents);
  renderWage();
  render(); // the entry list shows (or hides) the hours of work
  wageMessage.textContent = ok ? message : 'Changed for now, but this browser would not save it.';
}

wageForm.addEventListener('submit', (event) => {
  event.preventDefault();
  // Same parser as the amount box, so "15,75" and "$15.75" both work.
  const wageCents = parseAmountToCents(wageInput.value);
  if (!isValidHourlyWage(wageCents)) {
    wageMessage.textContent = 'Type your pay per hour, like 15.75 (up to $1,000).';
    wageInput.focus();
    return;
  }
  setWage(wageCents, 'Saved: ' + formatCents(wageCents) + ' an hour.');
});

clearWageButton.addEventListener('click', () => setWage(null, 'Wage cleared. Hours of work are hidden.'));

// ---------- Task 3.2: monthly budget per category ----------

// The category menu in "Set a budget": one <option> per expense category.
function renderBudgetOptions() {
  for (const category of EXPENSE_CATEGORIES) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = CATEGORY_ICONS[category] + ' ' + category;
    budgetCategorySelect.appendChild(option);
  }
}

// Puts the saved budget of the chosen category in the amount box (or empties
// it), so changing a budget is: pick the category, type, save.
function fillBudgetAmount() {
  const cents = budgets[budgetCategorySelect.value];
  budgetAmountInput.value = cents ? centsToInputValue(cents) : '';
}

// One row per budget: "Food  $120.00 of $200.00", a bar, and a calm sentence.
// Task 3.5: with rollover on, limits include last month's unspent part.
function renderBudgets(monthEntries, previousEntries) {
  planMonth.textContent = monthLabel(viewedMonth);
  rolloverToggle.checked = settings.rollover;
  const { limits, rolledOver } = effectiveLimits(budgets, previousEntries, settings.rollover);
  const rows = budgetRows(monthEntries, limits, rolledOver);
  budgetList.innerHTML = '';
  budgetsEmpty.hidden = rows.length > 0;

  for (const row of rows) {
    const item = document.createElement('li');
    item.className = 'budget-row';

    const top = document.createElement('div');
    top.className = 'goal-top';
    const name = document.createElement('span');
    name.className = 'goal-name';
    name.textContent = CATEGORY_ICONS[row.category] + ' ' + row.category;
    const amounts = document.createElement('span');
    amounts.className = 'goal-amounts';
    amounts.textContent = formatCents(row.spentCents) + ' of ' + formatCents(row.limitCents);
    top.append(name, amounts);

    // Same bar as the goals, in the category's own calm colour. Going over
    // just means a full bar: no red, no flashing.
    const bar = document.createElement('div');
    bar.className = 'progress';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', String(row.percent));
    bar.setAttribute('aria-label', row.category + ' budget used');
    const fill = document.createElement('span');
    fill.className = 'progress-fill';
    fill.style.width = row.percent + '%';
    fill.style.background = CATEGORY_COLORS[row.category] || '';
    bar.appendChild(fill);

    const bottom = document.createElement('div');
    bottom.className = 'budget-bottom';
    const status = document.createElement('span');
    status.className = 'budget-status';
    status.textContent = budgetStatusText(row);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'quiet-button small-action';
    remove.dataset.category = row.category;
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', 'Remove the ' + row.category + ' budget');
    bottom.append(status, remove);

    item.append(top, bar);

    // Task 3.5: "Includes $20 not spent in October", right under the bar.
    const rolloverLine = rolloverText(row.rolledOverCents, shiftMonth(viewedMonth, -1));
    if (rolloverLine !== '') {
      const note = document.createElement('p');
      note.className = 'goal-detail rollover-note';
      note.textContent = rolloverLine;
      item.appendChild(note);
    }
    item.appendChild(bottom);
    budgetList.appendChild(item);
  }
}

function commitBudgets(newBudgets) {
  budgets = newBudgets;
  const ok = saveBudgets(budgets);
  render();
  return ok;
}

budgetCategorySelect.addEventListener('change', () => {
  fillBudgetAmount();
  budgetMessage.textContent = '';
});

budgetForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const category = budgetCategorySelect.value;
  const cents = parseAmountToCents(budgetAmountInput.value);
  if (cents === null) {
    budgetMessage.textContent = 'Type an amount per month, like 200 or 49,99.';
    budgetAmountInput.focus();
    return;
  }
  const ok = commitBudgets(setBudget(budgets, category, cents));
  budgetMessage.textContent = ok
    ? 'Saved: ' + formatCentsShort(cents) + ' a month for ' + category + '.'
    : 'Saved for now, but this browser would not save it.';
});

// Event delegation again: one listener for every "Remove" button in the list.
budgetList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-category]');
  if (!button) return;
  const category = button.dataset.category;
  commitBudgets(setBudget(budgets, category, null));
  if (budgetCategorySelect.value === category) fillBudgetAmount();
  budgetMessage.textContent = category + ' budget removed.';
});

// ---------- Task 3.5: rollover ----------

// "change" fires when the box is ticked or unticked (by tap, click or keyboard).
rolloverToggle.addEventListener('change', () => {
  settings = { ...settings, rollover: rolloverToggle.checked };
  const ok = saveSettings(settings);
  render();
  if (!ok) rolloverMessage.textContent = 'Changed for now, but this browser would not save it.';
  else if (settings.rollover) rolloverMessage.textContent = 'Rollover is on. Unspent budget from last month is added to this month.';
  else rolloverMessage.textContent = 'Rollover is off. Each month starts with its plain budget.';
});

// ---------- Task 3.4: budget styles ----------

// The Simple / 50/30/20 switch, and the split rows when 50/30/20 is picked.
function renderBudgetStyle(monthEntries) {
  const is503020 = settings.budgetStyle === '503020';
  for (const button of styleButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.style === settings.budgetStyle));
  }
  styleSimpleText.hidden = is503020;
  splitBox.hidden = !is503020;
  if (!is503020) return;

  const split = fiftyThirtyTwenty(monthEntries, goals, viewedMonth);
  splitList.innerHTML = '';
  // The guide is a share of money in: with no money in, there's nothing to share.
  splitEmpty.hidden = split.inCents > 0;
  splitEmpty.textContent = 'Add your money in for ' + monthLabel(viewedMonth) + ' to see your 50/30/20 split.';
  if (split.inCents === 0) return;

  for (const row of split.rows) {
    const item = document.createElement('li');
    item.className = 'budget-row';
    const top = document.createElement('div');
    top.className = 'goal-top';
    const name = document.createElement('span');
    name.className = 'goal-name';
    name.textContent = row.group + ' (' + row.guidePercent + '%)';
    const text = document.createElement('span');
    text.className = 'goal-amounts';
    text.textContent = splitRowText(row);
    top.append(name, text);

    const bar = document.createElement('div');
    bar.className = 'progress';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', String(row.percent));
    bar.setAttribute('aria-label', row.group + ' compared with the guide');
    const fill = document.createElement('span');
    fill.className = 'progress-fill';
    fill.style.width = row.percent + '%';
    bar.appendChild(fill);

    item.append(top, bar);
    splitList.appendChild(item);
  }
}

function setBudgetStyle(style) {
  settings = { ...settings, budgetStyle: style };
  saveSettings(settings);
  render();
}

for (const button of styleButtons) {
  button.addEventListener('click', () => setBudgetStyle(button.dataset.style));
}

// ---------- Task 3.1: savings goals ----------

// One list item per goal: name, "$X of $Y", a progress bar, an "Add money"
// box and a delete button (with a confirm step, like entries).
function renderGoals() {
  goalList.innerHTML = '';
  goalsEmpty.hidden = goals.length > 0;

  for (const goal of goals) {
    const savedCents = goalSavedCents(goal);
    const percent = goalPercent(savedCents, goal.targetCents);
    const reached = percent === 100;

    const item = document.createElement('li');
    item.className = 'goal';

    const top = document.createElement('div');
    top.className = 'goal-top';
    const name = document.createElement('span');
    name.className = 'goal-name';
    name.textContent = goal.name; // textContent: a name like "<b>" stays plain text
    const amounts = document.createElement('span');
    amounts.className = 'goal-amounts';
    amounts.textContent = formatCents(savedCents) + ' of ' + formatCents(goal.targetCents);
    top.append(name, amounts);

    // The bar: an outer box (the track) and an inner one whose width is the percent.
    // role="progressbar" + aria-valuenow let screen readers say "42 percent".
    const bar = document.createElement('div');
    bar.className = 'progress';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', String(percent));
    bar.setAttribute('aria-label', goal.name + ' progress');
    const fill = document.createElement('span');
    fill.className = 'progress-fill';
    fill.style.width = percent + '%';
    bar.appendChild(fill);

    const detail = document.createElement('p');
    detail.className = 'goal-detail';
    const parts = [reached ? 'Reached! Nice work.' : percent + '%'];
    if (goal.targetDate !== null) parts.push('by ' + formatLongDate(goal.targetDate));
    detail.textContent = parts.join(' · ');

    // Task 3.3: what this goal needs this month (it's part of "safe to spend").
    const plan = document.createElement('p');
    plan.className = 'goal-detail';
    plan.textContent = goalPlanText(goal, monthKey(todayISO()));
    plan.hidden = plan.textContent === '';

    item.append(top, bar, detail, plan);
    item.appendChild(makeDepositForm(goal));

    const notice = document.createElement('p');
    notice.className = 'form-message goal-notice';
    notice.setAttribute('role', 'status');
    notice.textContent = goalNotice !== null && goalNotice.id === goal.id ? goalNotice.text : '';
    item.appendChild(notice);

    item.appendChild(makeGoalDeleteArea(goal));
    goalList.appendChild(item);
  }
}

// The small "Add money" form inside a goal. data-id tells the listener which goal.
function makeDepositForm(goal) {
  const depositForm = document.createElement('form');
  depositForm.className = 'deposit-form';
  depositForm.dataset.id = goal.id;
  depositForm.noValidate = true;

  const inputId = 'deposit-' + goal.id;
  const label = document.createElement('label');
  label.className = 'visually-hidden'; // read by screen readers, not shown
  label.htmlFor = inputId;
  label.textContent = 'Amount to add to ' + goal.name;
  const input = document.createElement('input');
  input.id = inputId;
  input.className = 'deposit-input';
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.placeholder = 'e.g. 20';
  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'secondary-button';
  button.textContent = 'Add money';

  depositForm.append(label, input, button);
  return depositForm;
}

function makeGoalDeleteArea(goal) {
  const area = document.createElement('div');
  area.className = 'delete-area';
  if (confirmingGoalId !== goal.id) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quiet-button';
    button.dataset.action = 'ask-delete-goal';
    button.dataset.id = goal.id;
    button.textContent = 'Delete goal';
    area.appendChild(button);
    return area;
  }
  const confirmBox = document.createElement('div');
  confirmBox.className = 'delete-confirm';
  const question = document.createElement('p');
  question.textContent = 'Delete "' + goal.name + '" for good?';
  const actions = document.createElement('div');
  actions.className = 'form-actions';
  const yes = document.createElement('button');
  yes.type = 'button';
  yes.className = 'secondary-button';
  yes.dataset.action = 'delete-goal';
  yes.dataset.id = goal.id;
  yes.textContent = 'Yes, delete';
  const keep = document.createElement('button');
  keep.type = 'button';
  keep.className = 'primary-button';
  keep.dataset.action = 'keep-goal';
  keep.textContent = 'Keep it';
  actions.append(yes, keep);
  confirmBox.append(question, actions);
  area.appendChild(confirmBox);
  return area;
}

// Saves the goals and redraws everything (safe to spend depends on goals too).
function commitGoals(newGoals) {
  goals = newGoals;
  const ok = saveGoals(goals);
  render();
  return ok;
}

goalForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = validateGoalInput(goalNameInput.value, goalTargetInput.value, goalDateInput.value, todayISO());
  if (!result.ok) {
    goalMessage.textContent = result.message;
    return;
  }
  const goal = { id: makeId(), ...result.fields, deposits: [], createdAt: Date.now() };
  const ok = commitGoals([...goals, goal]);
  goalForm.reset(); // empties the three boxes
  goalMessage.textContent = ok
    ? 'Goal created: ' + goal.name + '. Add money to it whenever you like.'
    : 'Created for now, but this browser would not save it.';
});

// One "submit" listener for every "Add money" form in the list (event delegation:
// submit events "bubble up" from the small form to the list).
goalList.addEventListener('submit', (event) => {
  event.preventDefault();
  const depositForm = event.target.closest('.deposit-form');
  if (!depositForm) return;
  const goalId = depositForm.dataset.id;
  const amountCents = parseAmountToCents(depositForm.querySelector('.deposit-input').value);
  if (amountCents === null) {
    goalNotice = { id: goalId, text: 'Type an amount like 20 or 12,50.' };
    renderGoals();
    return;
  }
  goalNotice = { id: goalId, text: 'Added ' + formatCents(amountCents) + '.' };
  const ok = commitGoals(addDeposit(goals, goalId, amountCents, todayISO()));
  if (!ok) {
    goalNotice = { id: goalId, text: 'Added for now, but this browser would not save it.' };
    renderGoals();
  }
});

goalList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'ask-delete-goal') {
    confirmingGoalId = button.dataset.id;
    renderGoals();
    // The safe choice gets the focus, like when deleting an entry.
    goalList.querySelector('[data-action="keep-goal"]').focus();
  } else if (action === 'keep-goal') {
    confirmingGoalId = null;
    renderGoals();
  } else if (action === 'delete-goal') {
    confirmingGoalId = null;
    commitGoals(deleteGoal(goals, button.dataset.id));
    goalMessage.textContent = 'Goal deleted.';
  }
});

// ---------- Task 2.4: export and import ----------

// Builds the backup as text and makes the browser download it as a file.
function handleExport() {
  const backup = buildBackup(entries, hourlyWageCents, new Date().toISOString(), { goals, budgets, settings });
  // null, 2 = indent with 2 spaces, so the file is readable in a text editor.
  const text = JSON.stringify(backup, null, 2);

  // A Blob is a chunk of data in memory. createObjectURL gives it a temporary
  // address, and a link with "download" saves whatever it points to as a file.
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = backupFileName(todayISO());
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Free the memory once the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  backupMessage.textContent = 'Backup exported (' + entries.length +
    (entries.length === 1 ? ' entry' : ' entries') + ', ' + goals.length + (goals.length === 1 ? ' goal' : ' goals') +
    '). Keep the file somewhere safe, like your cloud drive.';
}

// Runs when a file was picked. "async" lets us "await" reading the file,
// which takes a moment, without freezing the page.
async function handleImportFile() {
  const file = importFile.files[0];
  // Empty the picker, so choosing the same file again still counts as a change.
  importFile.value = '';
  if (!file) return; // the person closed the picker without choosing

  if (file.size > MAX_BACKUP_BYTES) {
    backupMessage.textContent = 'This file is too big to be a Pocket Budget backup. Nothing was changed.';
    return;
  }

  let text;
  try {
    text = await file.text();
  } catch (error) {
    backupMessage.textContent = 'This file couldn\'t be opened. Nothing was changed.';
    return;
  }

  // All the checking happens in logic.js (tested). Here we only act on the answer.
  const result = parseBackup(text);
  if (!result.ok) {
    backupMessage.textContent = result.message;
    return;
  }

  const merged = mergeEntries(entries, result.entries);

  // Restore the wage only if none is set here: like entries, what's here wins.
  let wageRestored = false;
  if (hourlyWageCents === null && result.hourlyWageCents !== null) {
    hourlyWageCents = result.hourlyWageCents;
    saveHourlyWageCents(hourlyWageCents);
    renderWage();
    wageRestored = true;
  }

  // Task 3.1: goals follow the same rule as entries (add, never delete).
  const mergedGoals = mergeById(goals, result.goals);
  goals = mergedGoals.items;
  const goalsOk = saveGoals(goals);

  // Task 3.2: budgets only fill categories that have none here.
  const mergedBudgets = mergeBudgets(budgets, result.budgets);
  budgets = mergedBudgets.budgets;
  const budgetsOk = saveBudgets(budgets);
  fillBudgetAmount();

  // Task 3.4: settings from the file only if the ones here were never changed.
  const mergedSettings = mergeSettings(settings, result.settings);
  settings = mergedSettings.settings;
  const settingsOk = saveSettings(settings);

  const ok = commit(merged.entries) && goalsOk && budgetsOk && settingsOk; // commit() also redraws the page
  const extras = {
    goalsAdded: mergedGoals.addedCount,
    goalsSkipped: result.skippedGoalCount,
    budgetsRestored: mergedBudgets.restoredCount,
    settingsRestored: mergedSettings.restored,
  };
  backupMessage.textContent = ok
    ? importSummary(merged.addedCount, merged.alreadyHereCount, result.skippedCount, wageRestored, extras)
    : 'Loaded for now, but this browser would not save it. It may be in private mode.';
}

exportButton.addEventListener('click', handleExport);
importButton.addEventListener('click', () => importFile.click()); // opens the file picker
importFile.addEventListener('change', handleImportFile);

// ---------- Start ----------
renderBudgetOptions();
fillBudgetAmount();
resetForm();
renderWage();
render();
