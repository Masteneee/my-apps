// The popup: the "blocked today / all time" counter, and one on/off switch
// per site.
// - Switches are saved with chrome.storage.sync, which survives browser
//   restarts. Every open tab listens for changes (see src/blocker-core.js),
//   so a switch takes effect immediately, without reloading the page.
// - Counts are written by background.js into chrome.storage.local; the popup
//   only reads them.

(function () {
  const { SITES, STORAGE_KEY, withDefaults, setSiteEnabled } = globalThis.BlockerSettings;
  const { COUNTS_KEY, localDayKey, countsForDay } = globalThis.BlockerCounter;
  const list = document.getElementById('site-list');
  const todayNumber = document.getElementById('count-today');
  const allTimeNumber = document.getElementById('count-all-time');

  // Build one row per site: <li><label>YouTube Shorts <input class="switch"></label></li>
  function render(settings) {
    list.textContent = ''; // clear old rows
    for (const site of SITES) {
      const item = document.createElement('li');
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'switch';
      checkbox.checked = settings[site.id];
      checkbox.addEventListener('change', () => save(site.id, checkbox.checked));
      label.append(site.label, checkbox);
      item.append(label);
      list.append(item);
    }
  }

  // Read the latest saved settings first, so two quick clicks on different
  // switches don't overwrite each other.
  function save(siteId, enabled) {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      const next = setSiteEnabled(result[STORAGE_KEY], siteId, enabled);
      chrome.storage.sync.set({ [STORAGE_KEY]: next });
    });
  }

  // countsForDay shows 0 for "today" if the saved counts are from another day,
  // even before anything new gets blocked today.
  function showCounts(stored) {
    const counts = countsForDay(stored, localDayKey(new Date()));
    // toLocaleString adds thousands separators: 1234 -> "1,234".
    todayNumber.textContent = counts.today.toLocaleString();
    allTimeNumber.textContent = counts.allTime.toLocaleString();
  }

  chrome.storage.sync.get(STORAGE_KEY, (result) => {
    render(withDefaults(result[STORAGE_KEY]));
  });

  chrome.storage.local.get(COUNTS_KEY, (result) => showCounts(result[COUNTS_KEY]));

  // Keep the numbers live if something gets blocked while the popup is open.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[COUNTS_KEY]) showCounts(changes[COUNTS_KEY].newValue);
  });
})();
