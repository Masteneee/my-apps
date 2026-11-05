// Background service worker: the ONE place that writes the blocked counter.
//
// Why not let each tab write the counter itself? Saving is "read the number,
// add, write it back". If two tabs do that at the same moment, both read 10,
// both write 11, and one block is lost. Here every tab just sends a message,
// and this file handles the messages one after the other.
//
// It also helps with redirects: a tab that is about to leave the page can
// still send a message, but it might not live long enough to finish a save.

importScripts('src/counter.js');

const { COUNTS_KEY, localDayKey, addBlocked } = globalThis.BlockerCounter;

// A chain of promises: each save waits for the previous one to finish.
let saveQueue = Promise.resolve();

function recordBlocked(amount) {
  saveQueue = saveQueue
    .then(async () => {
      const result = await chrome.storage.local.get(COUNTS_KEY);
      const next = addBlocked(result[COUNTS_KEY], amount, localDayKey(new Date()));
      await chrome.storage.local.set({ [COUNTS_KEY]: next });
    })
    // Keep the queue working even if one save fails.
    .catch((error) => console.error('Short-Form Blocker: could not save count', error));
}

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === 'blocked') {
    recordBlocked(message.amount);
  }
});
