// The popup: one on/off switch per site, saved with chrome.storage.sync.
// chrome.storage.sync survives browser restarts, so your choices stay.
// Every open tab listens for changes (see src/blocker-core.js), so a switch
// takes effect immediately, without reloading the page.

(function () {
  const { SITES, STORAGE_KEY, withDefaults, setSiteEnabled } = globalThis.BlockerSettings;
  const list = document.getElementById('site-list');

  // Build one row per site: <li><label><input type="checkbox"> YouTube Shorts</label></li>
  function render(settings) {
    list.textContent = ''; // clear old rows
    for (const site of SITES) {
      const item = document.createElement('li');
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = settings[site.id];
      checkbox.addEventListener('change', () => save(site.id, checkbox.checked));
      label.append(checkbox, ' ', site.label);
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

  chrome.storage.sync.get(STORAGE_KEY, (result) => {
    render(withDefaults(result[STORAGE_KEY]));
  });
})();
