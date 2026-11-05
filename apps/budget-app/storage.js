// storage.js: the ONLY file that touches localStorage.
// localStorage is a small notebook the browser keeps for this page. It only
// stores text, so we turn our list of entries into text with JSON.stringify
// when saving, and back into a list with JSON.parse when loading.
// Keeping it all in one file means that if we ever switch to a real database,
// this is the only file that has to change.

// The name of our "page" in the notebook. The "v1" lets us change the data
// shape later without confusing old data with new data.
const STORAGE_KEY = 'budget-app.v1.entries';

// Returns the saved entries, or an empty list if there are none (or the saved
// text is broken). isValidEntry comes from logic.js, which loads before this file.
function loadEntries() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (text === null) return []; // first visit: nothing saved yet
    const data = JSON.parse(text);
    if (!Array.isArray(data)) return [];
    return data.filter(isValidEntry);
  } catch (error) {
    // JSON.parse throws on broken text, and some private browsing modes
    // block localStorage entirely. Either way, start with an empty list
    // instead of showing a blank page.
    console.warn('Could not load saved entries:', error);
    return [];
  }
}

// Saves the whole list. Returns true if it worked, false if the browser refused
// (storage full, or blocked), so app.js can show a calm message.
function saveEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (error) {
    console.warn('Could not save entries:', error);
    return false;
  }
}

// ---------- Task 2.3: hourly wage ----------
// Saved separately from the entries, in cents per hour (1575 = $15.75/h),
// as a whole number like every amount in this app.
const WAGE_KEY = 'budget-app.v1.hourlyWageCents';

// Returns the saved wage in cents per hour, or null if none is set.
function loadHourlyWageCents() {
  try {
    const text = localStorage.getItem(WAGE_KEY);
    if (text === null) return null;
    const wageCents = JSON.parse(text);
    return isValidHourlyWage(wageCents) ? wageCents : null;
  } catch (error) {
    console.warn('Could not load the hourly wage:', error);
    return null;
  }
}

// Saves the wage (or removes it when wageCents is null). Returns true if it worked.
function saveHourlyWageCents(wageCents) {
  try {
    if (wageCents === null) localStorage.removeItem(WAGE_KEY);
    else localStorage.setItem(WAGE_KEY, JSON.stringify(wageCents));
    return true;
  } catch (error) {
    console.warn('Could not save the hourly wage:', error);
    return false;
  }
}

// ---------- Task 3.1: savings goals ----------
// Saved under their own key, like the wage, so the entries list stays only entries.
const GOALS_KEY = 'budget-app.v1.goals';

// Returns the saved goals, or an empty list. cleanGoal (logic.js) checks each
// one, so a single broken goal is dropped instead of crashing the page.
function loadGoals() {
  try {
    const text = localStorage.getItem(GOALS_KEY);
    if (text === null) return [];
    const data = JSON.parse(text);
    if (!Array.isArray(data)) return [];
    return data.map(cleanGoal).filter((goal) => goal !== null);
  } catch (error) {
    console.warn('Could not load saved goals:', error);
    return [];
  }
}

// Saves the whole list of goals. Returns true if it worked.
function saveGoals(goals) {
  try {
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
    return true;
  } catch (error) {
    console.warn('Could not save goals:', error);
    return false;
  }
}

// ---------- Task 3.2: monthly budget per category ----------
// One object, category -> limit in cents: { "Food": 20000, "Fun": 5000 }.
const BUDGETS_KEY = 'budget-app.v1.budgets';

// Returns the saved budgets, or {} if none. cleanBudgets (logic.js) drops
// anything that isn't a known category with a whole number of cents.
function loadBudgets() {
  try {
    const text = localStorage.getItem(BUDGETS_KEY);
    if (text === null) return {};
    return cleanBudgets(JSON.parse(text));
  } catch (error) {
    console.warn('Could not load budgets:', error);
    return {};
  }
}

// Saves all budgets. Returns true if it worked.
function saveBudgets(budgets) {
  try {
    localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
    return true;
  } catch (error) {
    console.warn('Could not save budgets:', error);
    return false;
  }
}

// ---------- Task 3.4: settings (budget style; rollover since 3.5) ----------
const SETTINGS_KEY = 'budget-app.v1.settings';

// Always returns a full settings object: cleanSettings (logic.js) fills in a
// default for anything missing, so the first visit just gets the defaults.
function loadSettings() {
  try {
    const text = localStorage.getItem(SETTINGS_KEY);
    return cleanSettings(text === null ? {} : JSON.parse(text));
  } catch (error) {
    console.warn('Could not load settings:', error);
    return cleanSettings({});
  }
}

// Saves the settings. Returns true if it worked.
function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.warn('Could not save settings:', error);
    return false;
  }
}
