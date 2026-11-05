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

const monthLabelText = document.getElementById('month-label');
const totalInText = document.getElementById('total-in');
const totalOutText = document.getElementById('total-out');
const totalLeftText = document.getElementById('total-left');
const leftNote = document.getElementById('left-note');
const categoryTotalsList = document.getElementById('category-totals');
const categoriesEmpty = document.getElementById('categories-empty');
const entryList = document.getElementById('entry-list');
const listEmpty = document.getElementById('list-empty');
const listHint = document.getElementById('list-hint');

// ---------- State: what the app remembers while the page is open ----------
let entries = loadEntries(); // every entry ever saved (all months)
let currentType = 'expense'; // which toggle is on: 'expense' or 'income'
let selectedCategory = null; // the category button that's pressed, or null
let editingId = null; // id of the entry being edited, or null when adding
let messageTimer = null; // used to clear the "Saved" message after a moment

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
  const thisMonth = entriesInMonth(entries, monthKey(today));

  renderSummary(thisMonth, today);
  renderCategoryTotals(thisMonth);
  renderEntryList(thisMonth, today);
}

function renderSummary(thisMonth, today) {
  const totals = monthTotals(thisMonth);
  monthLabelText.textContent = monthLabel(monthKey(today));
  totalInText.textContent = formatCents(totals.inCents);
  totalOutText.textContent = formatCents(totals.outCents);
  totalLeftText.textContent = formatCents(totals.leftCents);

  // Below zero is shown calmly, in the same colour, with a kind note.
  // If no income is logged yet, "left" is negative only because it's missing,
  // so we invite adding it instead.
  if (totals.inCents === 0 && totals.outCents > 0) {
    leftNote.textContent = 'Add your money in (job pay, gifts) with the "Money in" button to see what\'s left.';
    leftNote.hidden = false;
  } else if (totals.leftCents < 0) {
    leftNote.textContent = 'A bit more went out than came in this month. That happens, and seeing it is the first step.';
    leftNote.hidden = false;
  } else {
    leftNote.hidden = true;
  }
}

function renderCategoryTotals(thisMonth) {
  const rows = totalsByCategory(thisMonth);
  categoryTotalsList.innerHTML = '';
  categoriesEmpty.hidden = rows.length > 0;

  for (const row of rows) {
    const item = document.createElement('li');
    item.className = 'category-row';

    const name = document.createElement('span');
    name.textContent = (CATEGORY_ICONS[row.category] || '') + ' ' + row.category;

    const amount = document.createElement('span');
    amount.className = 'category-amount';
    amount.textContent = formatCents(row.cents);

    // A thin bar whose width is this category's share of all spending.
    const bar = document.createElement('span');
    bar.className = 'category-bar';
    bar.style.width = row.percent + '%';
    bar.setAttribute('aria-hidden', 'true'); // decoration only

    item.append(name, amount, bar);
    categoryTotalsList.appendChild(item);
  }
}

function renderEntryList(thisMonth, today) {
  const sorted = sortNewestFirst(thisMonth);
  entryList.innerHTML = '';
  listEmpty.hidden = sorted.length > 0;
  listHint.hidden = sorted.length === 0;

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
  resetForm();
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

// ---------- Start ----------
resetForm();
render();
