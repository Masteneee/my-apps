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
