# LEARNING.md: Budget App (Pocket Budget)

My study notes. One section per task from PLAN.md, newest at the bottom.
Quiz answers are folded under "Answers": click to open them once you've tried.

---

## Decisions

Choices made when the task left something open (the simplest option each time):

- **App name: "Pocket Budget".** It's only in `index.html` (`<title>` and `<h1>`) and `README.md`, so it's easy to change.
- **Amounts people can type:** digits with at most one `.` or `,` and up to 2 decimals, plus any `$` and spaces (`12`, `12.5`, `12,50`, `$12`, `12 $`, `1 234,56`). `12,500` and `1,234.56` are refused with a friendly hint, because in Quebec `12,500` could mean 12.50 or 12 500. Refusing is safer than guessing wrong.
- **Biggest single amount: $1,000,000.** Anything bigger is almost surely a typo.
- **A category must be picked** before saving (no default), so nothing lands in the wrong category by accident. The form says "Pick a category, then tap Save." in calm teal, not red.
- **Income categories: Job, Gift, Other.** Expenses and income use the same form, with a "Money out / Money in" switch at the top.
- **Delete confirm is inside the page**, not the browser's `confirm()` pop-up: it looks the same on every phone and the safe button ("Keep it") gets the focus.
- **Below zero:** "Left this month" can show a negative number (it's honest), in the normal text colour with a kind sentence. If no income is logged yet, the sentence invites adding it instead.
- **"This month" means the calendar month of today's date**, in the person's local time. Older months are kept in storage; Phase 2 adds a way to see them.
- **Dates show as "Today", "Yesterday" or "Nov 3".** All dates in one list are from the same month, so the year isn't needed.
- **Chart (2.1): a doughnut, and the list stays.** When Chart.js loads, the doughnut sits above the "Where it went" list; the list is always there because it has the exact amounts and its coloured bars act as the chart's legend (so Chart.js's own legend is turned off). Offline, only the list shows, with a short calm note.
- **Chart.js version 4.4.9 from jsDelivr,** pinned to that exact version and checked with an `integrity` fingerprint. jsDelivr serves the exact files published on npm, so the fingerprint was computed from the official package.
- **Month switcher (2.2): Previous / Next buttons**, from the month of your oldest entry to this month (or to a later month if an entry was dated in the future, so it never gets lost). A "Back to this month" link appears when looking back. After saving an entry, the page shows that entry's month.
- **Comparison (2.2): a separate "Compared with last month" card**, one line per category that had spending in either month, plus an "All spending" line. Only facts ("$40 less than last month", "the same as last month"), all in the same calm colour. When looking back at October, it compares with September ("than in September"). If the month before had no spending, it says so instead of comparing with zero.
- **Hours of work (2.3): under one hour shows minutes** ("12 min of work"), one hour or more shows hours with one decimal ("1.5 h of work", "2 h of work"). Tiny amounts say "under 1 min". Only money out gets it (income isn't a cost). The wage box accepts the same formats as the amount box (`15,75`, `$15.75`), up to $1,000 an hour, and a "Clear" button removes it.
- **The wage is stored before taxes, as typed.** The app doesn't try to guess take-home pay; it's a rough "feel" for prices, not a payslip.
- **Import adds, it never replaces (2.4).** Entries from the file are added to the ones already here, matched by id; if the same id is already here, the one here is kept. Importing the same file twice changes nothing the second time, and nothing is ever deleted, so no confirm step is needed. The wage from the file is used only if none is set here.
- **Only our own backup files are accepted (2.4):** a JSON object with `"app": "pocket-budget"` and `"version": 1`. Anything else (broken JSON, another app's file, a bare list, a newer version) is refused with a calm message and nothing changes. Inside a good file, each entry is checked (whole positive cents up to $1,000,000, a real date, a category that exists for its type, a note of at most 80 characters) and the ones that don't fit are left out and counted. Files over 5 MB are refused before reading.
- **Savings goals (3.1): name (up to 40 characters), amount, and an optional "by" date** that must be today or later. Without a date, a goal is "whenever I get there". You can only add money (no "take out" button yet); to fix a typo, delete the goal and create it again. Putting more than the target in is allowed: the bar stays full and says "Reached!".
- **Adding money to a goal is not an expense (3.1).** It doesn't change "Money out" or "Left this month", because the money is still yours, just set aside. Each deposit is stored with its date (not only a total), so later tasks can tell what was added *this month*.
- **Backups are version 2 since 3.1** (they include goals). Version 1 files from Phase 2 still import: a missing part counts as empty. Goals merge like entries: by id, the one here wins, nothing is deleted.
- **Budgets (3.2): one monthly limit per expense category, the same for every month.** Budgets are optional; a category without one isn't shown in "Monthly plan". Changing a limit also changes how past months look, because we don't store a history of limits (simplest). Looking back at October shows October's spending against today's limits.
- **Going over a budget (3.2)** fills the bar in the category's usual calm colour and says "$12 more than planned. A plan is a guide, not a test." No red, no warning icon. "Remove" deletes a budget straight away without a confirm step: it's one number, quick to set again, and no history is lost.
- **Budgets in backups (3.2):** like the wage, a budget from the file is used only for a category that has none here.
- **"Remaining bills" (3.3) = the unspent part of the Bills budget.** The app has no list of bills, so if you set a Bills budget of $80 and have logged $30 of Bills, $50 is kept aside. No Bills budget means nothing is kept aside for bills (the card doesn't nag about it). Bills spent past the budget count as 0 still to pay, never negative.
- **"Money planned for goals" (3.3):** only goals with a date have a monthly plan: what was still missing on the 1st of the month, shared equally over the months left (this month and the target month included), rounded up to the cent. Goals without a date, already reached, or whose date has passed plan nothing (a passed date gets a calm "No rush" line). For each goal, the bigger of "this month's plan" and "money added this month" is set aside, because money you already put in a goal is no longer in your pocket.
- **Days left include today (3.3):** on Nov 5 there are 26 days left, on the last day of the month 1. The per-day amount is rounded DOWN to the cent ($100 over 3 days = $33.33), so the app never promises a cent that isn't there.
- **Safe to spend is only shown for the current month (3.3),** since it's about the days left. When nothing extra is available (no income yet, more out than in, or everything set aside), the big number is hidden and a calm sentence explains why. It never shows a negative number. "Left this month" turned grey so this box is the one highlighted number.
- **Budget styles (3.4): "Simple" just tracks; "50/30/20" adds a split on top.** Per-category budgets work in both styles (Simple doesn't take them away). The switch sits at the top of "Monthly plan" and is remembered.
- **50/30/20 groups (3.4): Needs = Food, Transport, School, Bills. Wants = Fun, Other. Savings = money added to goals that month.** Food counts as a need because the app can't tell groceries from takeout, and eating isn't optional. Money that's simply left over isn't counted as savings until you put it in a goal, so the number means something you actually did.
- **50/30/20 math (3.4):** the guides are 50%, 30% and 20% of that month's money in, in whole cents. Needs and wants round down and savings gets the leftover cent, so the three always add up to exactly the money in. With no money in, the card asks you to add it instead of showing $0 guides. Above the guide is said plainly for needs and wants ("a bit above the $300 guide"), and cheered for savings ("Nice!").
- **Settings in backups (3.4):** settings always have a value (the defaults), so "what's here wins" means the file's settings are used only if the settings here were never changed from the defaults. Files without settings (version 1, or made before 3.4) change nothing.
- **Rollover (3.5): off by default, one switch for all budgets.** When on, what you didn't spend of a budget last month is added to the same budget this month (Fun $50, spent $30 in October: November's Fun is $70, with "Includes $20 not spent in October"). Only last month counts: it doesn't pile up over many months, so you can check every number by hand. Spending more than planned never makes next month smaller (no negative rollover). If last month has no entries at all, nothing rolls over: you probably weren't using the app yet, and a "free" doubled budget would be misleading.
- **Rollover doesn't change "safe to spend" (3.5).** Safe to spend counts only this month's money, and the rolled-over part of the Bills budget is last month's money, so "bills still to pay" keeps using the plain Bills budget. Otherwise turning rollover on would lower safe to spend, which would feel backwards.

---

## Task 0.1: Project skeleton (2026-11-05)

### Plan
- Create the 7 files the app's CLAUDE.md lists.
- `index.html` shows the app name and an empty "This month" section, and loads the 3 scripts in order.
- `tests.js` gets a tiny test runner and one trivial test that prints "All tests passed".
- Add a GitHub Actions workflow that runs `node tests.js` on every push to this folder.

### What we built
The empty frame of the app. Opening `index.html` shows "Pocket Budget" and a "This month" box. Every file has one clear job, so later tasks know exactly where new code goes: page structure in HTML, looks in CSS, clicks in `app.js`, math in `logic.js`, saving in `storage.js`. `node tests.js` runs and prints "All tests passed". On GitHub, every push that changes this folder runs the tests automatically.

### New concepts

**How the browser loads the page.** When you open `index.html`, the browser reads it from top to bottom. The `<link rel="stylesheet">` in `<head>` tells it to fetch `style.css`. At the very end of `<body>`, three `<script src="...">` tags load the JavaScript files one after the other. They are at the bottom so the HTML elements already exist when the scripts look for them.

**Script order matters.** Plain scripts (not "modules") all share one global space: a function defined in `logic.js` can be called from `app.js`, but only if `logic.js` ran first. That's why the order is `logic.js`, then `storage.js` (it uses `isValidEntry` from logic), then `app.js` (it uses both).

**Why no modules (`import`/`export`).** Modern JavaScript has `<script type="module">` with `import`. But browsers refuse to load modules from `file://` (a file opened by double-click) for security reasons. Our page must work by double-clicking, so we use plain scripts.

**The `module.exports` trick.** Node (which runs `tests.js`) works differently: each file is private, and only what you put on `module.exports` can be `require`d by another file. The browser has no variable called `module` at all. So the end of `logic.js` says "if `module` exists, share these functions". In the browser that `if` is false and nothing happens; in Node it's true and the tests can use the functions.

**Pure functions.** A function that only uses its inputs to compute an output, and changes nothing else (no page, no storage). Given the same input it always gives the same answer, which makes it easy to test. That's the rule for `logic.js`.

**Continuous integration (GitHub Actions).** A small file in `.github/workflows/` tells GitHub: "every time someone pushes, start a fresh computer, copy the code, and run `node tests.js`". If a test fails, the commit gets a red X, so mistakes are caught even when you forget to run the tests yourself.

### Most important lines
```html
<script src="logic.js"></script>
<script src="storage.js"></script>
<script src="app.js"></script>
```
Loaded in this order because each file uses functions from the ones above it.

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseAmountToCents, formatCents, /* ... */ };
}
```
`typeof module` gives the text `'undefined'` when no such variable exists, instead of crashing. That's why we check with `typeof` and not just `if (module)`, which would throw an error in the browser.

```js
const assert = require('assert');
assert.strictEqual(1 + 1, 2);
```
`assert.strictEqual(actual, expected)` does nothing if both are equal and throws an error if they're not. Our tiny `test()` function catches that error and prints FAIL.

### Files changed
- `index.html`, `style.css`, `app.js`, `logic.js`, `storage.js`, `tests.js`, `LEARNING.md`, `README.md`: created.
- `.github/workflows/budget-app.yml` (repo root): runs `node tests.js` on GitHub.

### Try it yourself
In `tests.js`, change `assert.strictEqual(1 + 1, 2)` to `3` and run `node tests.js`. Read the FAIL message, then put it back.

### Quiz
1. If you swapped the order so `app.js` loaded before `logic.js`, what would happen when the page opens?
2. Why can't `logic.js` just use `export function ...`?

<details><summary>Answers</summary>

1. `app.js` would call functions like `loadEntries` or `todayISO` that don't exist yet, so the browser would throw an error (visible in F12, Console) and the page wouldn't work.
2. `export` only works in modules, and browsers don't load modules from a file opened by double-click (`file://`). Our page must work that way, so we use a plain script plus the `module.exports` check for Node.
</details>

---

## Task 1.1: Add an expense (2026-11-05)

### Plan
- Form in `index.html`: big Amount box first (focused on load), 6 category buttons, optional note, date (defaults to today).
- `parseAmountToCents` in `logic.js` turns "12.5", "12,50", "$12" into whole cents, with tests.
- `todayISO` gives today's date in local time, with tests.
- `storage.js` saves and loads the list as JSON in localStorage.
- `app.js` reads the form on submit, checks it, saves, and clears the form for the next one.

### What we built
The form for logging an expense. The cursor starts in the Amount box, so you can type right away. You tap a category, optionally type a note, and press Save (or Enter). The amount is turned into cents (12,50 becomes 1250) and the entry is saved in the browser, so it's still there after a reload. If the amount doesn't make sense, a calm message explains what to type. After saving, the form empties and the cursor goes back to Amount, ready for the next one. Total: type, tap, tap, under 5 seconds.

### New concepts

**Money in cents.** Computers store decimal numbers in binary, and some (like 0.1) can't be stored exactly, the same way 1/3 can't be written exactly in decimal (0.333...). So `0.1 + 0.2` gives `0.30000000000000004`. Whole numbers are always exact, so we store $12.50 as `1250` and only add the dot when showing it.

**Why not `parseFloat(text) * 100`?** Because that does decimal math: `0.29 * 100` gives `28.999999999999996`. Instead, `parseAmountToCents` splits the text into the dollars part ("12") and the cents part ("5"), pads the cents to 2 digits ("50"), and does `12 * 100 + 50`: only whole numbers.

**Regular expressions (regex).** A tiny pattern language for checking text. `/^(\d*)(?:[.,](\d{0,2}))?$/` reads as: start of text (`^`), some digits (`\d*`, saved as group 1), then optionally (`(...)?`) a dot or comma (`[.,]`) followed by 0 to 2 digits (saved as group 2), then end of text (`$`). If the text doesn't fit, `match` returns `null`.

**localStorage.** A small storage space the browser keeps for each website (and for files you open locally). It survives reloads and closing the browser. It only stores text, and it's only on this device and this browser: clearing browser data erases it (Phase 2.4 adds export as a backup).

**JSON.** A way to write lists and objects as text. `JSON.stringify([{ amountCents: 1250 }])` gives the text `'[{"amountCents":1250}]'`, and `JSON.parse` turns that text back into a real list. That's how a list fits in localStorage.

**try / catch.** "Try this; if it throws an error, run the catch part instead of crashing." `JSON.parse` throws on broken text, and some private browsing modes block localStorage. `storage.js` catches both and falls back to an empty list.

**Forms and `submit`.** A `<form>` fires a `submit` event when you press Enter in a field or click a `type="submit"` button. By default the browser then reloads the page. `event.preventDefault()` stops that so our JavaScript handles it.

**Event listener.** A function you hand to the browser saying "call this when X happens". `form.addEventListener('submit', handleSubmit)` means "when the form is submitted, run `handleSubmit`". Until then, the code just waits.

**Local date vs UTC.** `new Date().toISOString()` gives the date in UTC (London time, roughly). At 9 pm in Montreal it's already tomorrow in UTC, so an evening coffee would be saved on the wrong day. `todayISO` builds the date from `getFullYear()`, `getMonth()` and `getDate()`, which use your local time.

**`type="text"` with `inputmode="decimal"`.** A `type="number"` box rejects "12,50" in some browsers. A text box accepts anything, and `inputmode="decimal"` still tells phones to show the number keyboard.

### Most important lines
```js
const match = cleaned.match(/^(\d*)(?:[.,](\d{0,2}))?$/);
const cents = Number(dollarsText || '0') * 100 + Number(centsText.padEnd(2, '0'));
```
`padEnd(2, '0')` turns "5" into "50", because "12,5" means 12 dollars and 50 cents, not 5 cents.

```js
const cleaned = text.replace(/[$\s]/g, '');
```
Removes every `$` and every space (`\s`, including the special non-breaking space French text often uses). The `g` means "all of them, not just the first".

```js
localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
```
Saves the whole list as one piece of text, under the name `budget-app.v1.entries`.

```js
const entry = { id: makeId(), ...fields, createdAt: Date.now() };
```
`...fields` ("spread") copies every property of `fields` into the new object. `createdAt` remembers the exact moment, to sort two entries on the same day.

### Files changed
- `index.html`: the form (type switch, amount, category box, note, date, Save).
- `logic.js`: categories, `parseAmountToCents`, `todayISO`, `isValidEntry`.
- `storage.js`: `loadEntries`, `saveEntries`.
- `app.js`: draws the category buttons, reads and checks the form, saves.
- `style.css`: form styles; the amount box is extra big.
- `tests.js`: 12 tests for amounts, dates, categories and entry checks.

### Try it yourself
In the browser, press F12, open the **Application** tab (Chrome) then **Local Storage**, and look at `budget-app.v1.entries` after adding an expense. Find your amount in cents.

### Quiz
1. What does `parseAmountToCents('7,5')` return, and why not 705?
2. Why is the amount box `type="text"` and not `type="number"`?

<details><summary>Answers</summary>

1. `750`. The part after the comma is padded to 2 digits ("5" becomes "50"), so it's 7 dollars and 50 cents. 705 would be 7.05.
2. Some browsers' number boxes refuse a comma as decimal separator, and Quebec users type "12,50". A text box accepts it, and `inputmode="decimal"` still shows the number keyboard on phones.
</details>

---

## Task 1.2: Show the list (2026-11-05)

### Plan
- `entriesInMonth`, `sortNewestFirst`, `formatCents`, `friendlyDate` (with `addDays`) and `monthLabel` in `logic.js`, all tested.
- A `render()` function in `app.js` that redraws the list from the data after every change.
- Each row shows icon, category, note, amount and "Today" / "Yesterday" / "Nov 3".
- A friendly message when the month is empty.

### What we built
Under the form, this month's entries appear newest first. Each row shows the category's little picture, its name, the note (cut with "..." if it's long), the amount and a friendly date. Two entries on the same day: the one added last is on top. When there's nothing yet this month, the list says "Nothing logged yet this month. Your first entry takes about 5 seconds." The heading shows the month name, like "November 2026".

### New concepts

**Rendering from data.** Instead of adding one row to the page when you save, `render()` empties the list and rebuilds it from the `entries` array every time. It sounds wasteful, but for a few hundred rows it's instant, and the page can never show something different from the data. This is the same idea React is built on.

**Creating elements.** `document.createElement('li')` makes a new, empty element in memory. You fill it (`textContent`, `className`), then attach it to the page with `appendChild` or `append`. Until it's attached, it's invisible.

**`textContent` vs `innerHTML`.** `textContent = note` shows the note exactly as typed. `innerHTML = note` would treat it as HTML, so a note like `<img src=x onerror=...>` could run code. That's called an XSS attack. Rule: anything the user typed goes in `textContent`.

**Sorting with a compare function.** `array.sort((a, b) => ...)` calls your function with two items; return a negative number if `a` goes first, positive if `b` goes first. Dates like "2026-11-05" can be compared as text because the biggest unit (year) comes first, just like dictionary order.

**Not changing the input (`[...entries]`).** `.sort()` rearranges the array it's called on. `[...entries]` makes a copy first, so sorting for display doesn't secretly reorder the saved data. Functions that don't change their inputs are much easier to reason about.

**`filter` and `map`.** `filter` keeps the items where your function returns `true` (here: entries of this month). `map` builds a new array by transforming each item. Both return a new array and leave the original alone.

### Most important lines
```js
return [...entries].sort((a, b) => {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return b.createdAt - a.createdAt;
});
```
Different days: the later date first. Same day: the bigger `createdAt` (added later) first.

```js
return todayISO(new Date(year, month - 1, day + days));
```
In `addDays`: JavaScript's `Date` fixes overflow by itself. Day 0 of November becomes October 31, so "yesterday" works across months and years.

```js
note.textContent = entry.note;
```
Safe: the note is always shown as plain text.

### Files changed
- `logic.js`: `formatCents`, `monthKey`, `monthLabel`, `addDays`, `friendlyDate`, `entriesInMonth`, `sortNewestFirst`.
- `app.js`: `render()` and `renderEntryList()`.
- `index.html`: the Entries section and empty message.
- `style.css`: entry rows (flexbox), long notes end with "...".
- `tests.js`: 6 new tests.

### Try it yourself
Add an expense with the note `<b>bold?</b>`. It shows the tags as text. Then in `app.js` change `note.textContent` to `note.innerHTML`, reload, and see the difference. Change it back!

### Quiz
1. Why can we compare dates like `'2026-11-05' < '2026-12-01'` as plain text, but not `'5/11/2026' < '1/12/2026'`?
2. Why does `sortNewestFirst` start with `[...entries]`?

<details><summary>Answers</summary>

1. Text is compared character by character from the left. In year-month-day, the most important part comes first, so text order equals date order. In day/month/year, "5" vs "1" compares days first, which gives the wrong answer.
2. `.sort()` changes the array it's called on. Copying first keeps the original list (the one we save) untouched.
</details>

---

## Task 1.3: Edit and delete (2026-11-05)

### Plan
- Each row becomes a button; tapping it fills the form with that entry ("Edit entry").
- `updateEntry` and `deleteEntry` in `logic.js` return new lists, with tests; `centsToInputValue` fills the amount box.
- While editing: "Save changes", "Cancel" and "Delete this entry".
- Delete has a second step ("Yes, delete" / "Keep it").

### What we built
Tap any entry and the form at the top switches to "Edit entry", filled with that entry's amount, category, note and date. The row being edited is highlighted. "Save changes" updates it, "Cancel" goes back to adding. "Delete this entry" doesn't delete right away: it asks "Delete this entry for good?" with "Yes, delete" and "Keep it", and the safe button gets the focus. The same form is used for adding and editing, so there's only one place to maintain.

### New concepts

**Ids.** To edit "this exact entry", each entry needs a name nobody else has. `makeId()` combines the current time with random letters. Rows carry it in `data-id="..."`, so a click tells us which entry was tapped.

**`data-` attributes and `dataset`.** Any HTML attribute starting with `data-` is yours to store small info in. `button.dataset.id = 'abc'` writes `data-id="abc"`, and `button.dataset.id` reads it back.

**Event delegation.** Instead of one click listener per row (which we'd have to re-add after every redraw), there's one listener on the whole list. When you click, the event "bubbles up" from the row to the list, and `event.target.closest('.entry')` finds which row it came from.

**State.** The app remembers a few things while the page is open: `editingId` (which entry is being edited, or `null` when adding), `selectedCategory`, `currentType`. The form looks at `editingId` to decide whether Save means "add" or "update".

**Immutable updates.** `updateEntry` doesn't change the old entry; it builds a new list where one entry is replaced by a copy with the changes (`{ ...entry, ...changes }`). Later properties win, so the changes overwrite the old values. We put `id: entry.id` last so the id can never be changed by mistake.

**Two-step delete.** Undo is hard; a confirm step is easy. The "Keep it" button gets the focus, so pressing Enter by reflex is safe.

### Most important lines
```js
entryList.addEventListener('click', (event) => {
  const button = event.target.closest('.entry');
  if (button) startEditing(button.dataset.id);
});
```
One listener for every row, even rows drawn later. `closest` walks up from what was clicked (maybe the amount text) to the row's button.

```js
return entries.map((entry) => (entry.id === id ? { ...entry, ...changes, id: entry.id } : entry));
```
Every entry stays the same except the one with the matching id, which gets a changed copy.

```js
return entries.filter((entry) => entry.id !== id);
```
Delete = "keep every entry whose id is NOT this one".

### Files changed
- `logic.js`: `centsToInputValue`, `updateEntry`, `deleteEntry`.
- `app.js`: `startEditing`, Save-as-update, Cancel, delete with confirm.
- `index.html`: Cancel button and delete area.
- `style.css`: highlighted row, delete confirm box.
- `tests.js`: 3 new tests (including a round trip: cents to box text and back).

### Try it yourself
Edit an expense and switch it to "Money in". Notice the category is cleared (Food isn't an income category). Find the line in `setType` that does that.

### Quiz
1. Why is there one click listener on the list instead of one on each row?
2. In `{ ...entry, ...changes, id: entry.id }`, what would go wrong if `id: entry.id` came first?

<details><summary>Answers</summary>

1. The rows are destroyed and redrawn after every change. Listeners on rows would disappear with them. The list itself stays, so its listener keeps working for every new row.
2. `...changes` comes after and would overwrite it, so a change containing an `id` could change the entry's id. Last one wins.
</details>

---

## Task 1.4: Income (2026-11-05)

### Plan
- A "Money out / Money in" switch at the top of the form; income categories are Job, Gift, Other.
- `monthTotals` in `logic.js` adds up money in, money out and what's left, with tests.
- Three numbers at the top: "Money in", "Money out", "Left this month".
- Below zero: same colour, kind sentence, no red.

### What we built
The form now has a two-part switch: "Money out" (expenses) and "Money in" (job pay, gifts, other). The category buttons change to match. At the top of the page, "Money in" (green), "Money out" and the big "Left this month" number update instantly after each entry. If more went out than came in, the number is shown honestly but calmly, with a kind sentence. If you haven't logged any income yet, it suggests adding it so the "left" number makes sense. Income rows in the list show "+$200.00" in green.

### New concepts

**One shape for both kinds.** Income and expenses are the same kind of object, just with `type: 'income'` or `type: 'expense'`. The list, editing, deleting and storage all work for both without extra code. Only the totals look at `type`.

**`aria-pressed`.** An attribute that tells screen readers "this button is a switch, and it's on (true) or off (false)". We also use it in CSS (`[aria-pressed="true"]`) to style the selected button, so the look and the accessibility info can never disagree.

**Accumulating with a loop.** `monthTotals` starts two counters at 0, then goes through each entry and adds its cents to the right counter. Because everything is whole cents, the totals are exact.

**Tone as a feature.** The app's CLAUDE.md says no guilt. In code that means: no red, no "over budget!", and a negative number is a fact with a kind sentence, not an alarm.

### Most important lines
```js
for (const entry of entries) {
  if (entry.type === 'income') inCents += entry.amountCents;
  else outCents += entry.amountCents;
}
return { inCents, outCents, leftCents: inCents - outCents };
```
`{ inCents, outCents }` is shorthand for `{ inCents: inCents, outCents: outCents }`.

```js
if (!categoriesFor(type).includes(selectedCategory)) selectedCategory = null;
```
Switching to Money in forgets "Food", since it isn't an income category.

### Files changed
- `logic.js`: `INCOME_CATEGORIES`, `categoriesFor`, `monthTotals`.
- `app.js`: the switch (`setType`), `renderSummary`, "+" and green for income rows.
- `index.html`: the switch and the 3 summary numbers.
- `style.css`: switch and summary styles.
- `tests.js`: 4 tests for totals (normal, empty, below zero, exact cents).

### Try it yourself
Add a "Scholarship" income category: one word in `INCOME_CATEGORIES` and an icon in `CATEGORY_ICONS`. Update the `categoriesFor` test so it still passes.

### Quiz
1. Why didn't the list, edit and delete code need to change to support income?
2. Money in $10.00, Money out $10.30. What does `monthTotals` return for `leftCents`?

<details><summary>Answers</summary>

1. Income entries have the exact same shape as expenses; only `type` differs. The list, edit and delete code doesn't care about `type`.
2. `-30` (minus 30 cents), shown as "-$0.30".
</details>

---

## Task 1.5: Totals per category (2026-11-05)

### Plan
- `totalsByCategory` in `logic.js`: expenses only, one row per category, biggest first, ties in button order, with tests.
- Each row also gets a `percent` (share of all spending) to draw a thin bar.
- A "Where it went" section in the page, with an empty message.

### What we built
A "Where it went" list: each category you spent on this month, with its total, biggest first, and a soft teal bar showing its share of all your spending. Categories with nothing spent don't appear. Income is ignored here, because it isn't spending. When nothing was spent yet, it says so kindly.

### New concepts

**Grouping with an object.** To add up per category, we use an object as a set of labelled boxes: `sums['Food']`. `(sums[category] || 0) + amount` means "what's in the box, or 0 if the box doesn't exist yet, plus this amount".

**`Object.keys`.** Gives the list of box names in an object (`['Food', 'Fun']`), so we can turn the object into an array and sort it.

**Tie-breaking.** If Food and Fun are both $7, plain sorting could put them in any order, and the list might jump around between reloads. A second rule (the category's position in the button list) makes the order predictable, and tests can check it.

**`continue`.** Inside a loop, `continue` means "skip the rest for this item and go to the next one". We use it to skip income.

### Most important lines
```js
sums[entry.category] = (sums[entry.category] || 0) + entry.amountCents;
```
Adds this entry to its category's box, creating the box the first time.

```js
percent: Math.round((sums[category] * 100) / totalOut),
```
Multiply first, then divide, then round to a whole percent. Used only for the bar's width (`bar.style.width = row.percent + '%'`).

### Files changed
- `logic.js`: `totalsByCategory`, `categoryOrder`.
- `app.js`: `renderCategoryTotals`.
- `index.html`: "Where it went" section.
- `style.css`: rows as a 2-column grid with the bar underneath.
- `tests.js`: 4 tests (sorting, income ignored, ties, empty).

### Try it yourself
Make each row also show the percent as text ("42%") after the amount. You only need `app.js`: the number is already in `row.percent`.

### Quiz
1. Why does `totalsByCategory` ignore entries with `type: 'income'`?
2. What does `(sums['Food'] || 0)` give the very first time we see a Food expense?

<details><summary>Answers</summary>

1. The list answers "where did my money go". Income isn't spending, and an income "Other" would otherwise be mixed with expense "Other".
2. `0`. `sums['Food']` is `undefined` at first, and `undefined || 0` gives `0`.
</details>

---

## Task 1.6: Phone-friendly layout (2026-11-05)

### Plan
- Viewport meta tag so phones use their real width.
- One centred column (`max-width` + `margin: auto`) with 16px side gutters.
- Every button and box at least 48px tall; inputs at 16px text so iPhones don't zoom.
- Grids for the summary and the 3-per-row category buttons; flexbox for entry rows.
- Checked in Chromium at 360px wide: no sideways scrolling, nothing smaller than 44px to tap.

### What we built
The page is comfortable with one thumb. Everything is one column, buttons are big, the amount box is huge, categories are 2 tidy rows of 3, and nothing scrolls sideways even on a small 360px phone. On a laptop, the same column stays centred and stops at a readable width, with a bit more space around it. No separate "mobile version": one layout that stretches.

### New concepts (the CSS used)

**Viewport meta tag.** `<meta name="viewport" content="width=device-width, initial-scale=1">`. Without it, phones pretend the screen is about 980px wide and zoom out, so everything looks tiny. With it, 1 CSS pixel matches the phone's real width.

**Phone first + `@media`.** The normal rules are written for a narrow screen. `@media (min-width: 40rem) { ... }` adds rules only when the window is at least 40rem (640px) wide. Starting small and adding is simpler than starting big and undoing.

**`rem`.** A size relative to the browser's base font size (usually 16px, so 1rem = 16px). If someone sets bigger text in their browser, everything in `rem` grows with it.

**One centred column: `max-width` + `margin: 0 auto`.** `max-width: 34rem` means "never wider than 34rem, but narrower is fine". `margin: 0 auto` splits the leftover space equally left and right, which centres it. `padding: 0 16px` keeps text off the screen edges.

**`box-sizing: border-box`.** By default, `width: 100%` plus padding is wider than 100% and overflows sideways. `border-box` makes the width include padding and border. Almost every site sets it for everything (`*`).

**Tap targets: `min-height: 48px`.** Fingers are much less precise than a mouse. Google and Apple recommend about 44 to 48px for anything you tap. We store it once in `--tap` and use it everywhere.

**Inputs at 16px.** On iPhone, tapping a field whose text is under 16px makes the page zoom in, and it stays zoomed. `font-size: 1rem` avoids that.

**CSS grid.** `display: grid; grid-template-columns: repeat(3, 1fr)` makes 3 equal columns; children fill them left to right, row by row. `1fr` means "one share of the free space". `grid-column: 1 / -1` makes an item stretch from the first column line to the last (used for "Left this month" and the category bars).

**Flexbox.** `display: flex` puts children in a row. In an entry row: icon, then the middle part with `flex: 1` (takes all leftover space), then amount and date on the right. `flex-direction: column` stacks children instead (label above number). `min-width: 0` lets the middle part shrink so long notes get "..." (`text-overflow: ellipsis`) instead of pushing the amount off screen.

**CSS variables.** `--accent: #2f6f6a;` in `:root`, then `color: var(--accent)`. Change one line and every use changes. All colours live there, and there's no red.

**`tabular-nums`.** Makes every digit the same width, so amounts in a list line up neatly.

### Most important lines
```css
.app-header,
main {
  max-width: 34rem;
  margin: 0 auto;
  padding: 0 16px;
}
```
The whole one-column layout in three lines.

```css
.category-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
```
6 categories become 2 rows of 3 equal buttons, on any width.

```css
[hidden] {
  display: none !important;
}
```
The `hidden` attribute normally hides things, but a rule like `display: flex` would beat it and show them again. This makes `hidden` always win. `!important` is usually a bad sign; this is one of the few accepted uses.

### Files changed
- `style.css`: the full phone-first layout described above.
- `index.html`: viewport meta tag (already there since 0.1, explained now).

### Try it yourself
In Chrome, press F12 and click the phone icon (device toolbar). Try "iPhone SE" (375px) and drag the width to 320px. Find the first thing that breaks, and fix it with one CSS rule.

### Quiz
1. What does `margin: 0 auto` do to a box that has a `max-width`?
2. Why is the font size of every input at least 16px?

<details><summary>Answers</summary>

1. It sets the top and bottom margin to 0 and splits the leftover horizontal space equally on the left and right, so the box is centred.
2. On iPhone, tapping a field with text smaller than 16px zooms the page in automatically, which is annoying. 16px avoids it.
</details>

---

## Task 2.1: Category chart (2026-11-05)

### Plan
- Load Chart.js 4.4.9 from the jsDelivr CDN with a plain `<script>` tag, pinned version plus an `integrity` fingerprint.
- `logic.js`: one calm colour per category, `chartSlices` (names, cents, colours in the same order) and `chartDescription` (a sentence for screen readers), with tests.
- `app.js`: `renderChart` creates the doughnut once, then only updates its data.
- If `typeof Chart === 'undefined'` (no internet), hide the chart, keep the list and show a short note.
- The list bars get the same colours as the slices, so the list is the legend.

### What we built
"Where it went" now starts with a doughnut chart: one slice per category, sized by how much went there this month. Hovering (or tapping) a slice shows its amount, like "$25.00". Each category always has the same colour, and the bars in the list below use those colours too, so you can match slice and line at a glance. The chart comes from Chart.js, a free library downloaded from the internet when the page opens. If there's no internet, the page works exactly as before: the list shows, with a small note saying the chart needs a connection. Nothing breaks and no error pops up.

### New concepts

**Library.** Code someone else wrote, tested and shared, so you don't write it yourself. Drawing a nice doughnut chart by hand (angles, arcs, hover detection, resizing) would take days; Chart.js does it in one `new Chart(...)` call. The trade-off: the page now depends on outside code, so we pin the version and keep the page working without it. This is the app's first dependency (allowed by the app's CLAUDE.md for phase 2).

**CDN (Content Delivery Network).** A big network of servers around the world that hosts popular files (like Chart.js) and sends them from the server closest to you, fast. Instead of copying `chart.umd.js` into our folder, `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.9/...">` tells the browser to download it from jsDelivr. jsDelivr copies files straight from npm, the place where JavaScript libraries are published. Because it's on the internet, it needs a connection the first time (browsers usually keep a copy afterwards).

**Pinning a version.** `chart.js@4.4.9` means "exactly 4.4.9, forever". Writing `chart.js@4` would give you whatever 4.x is newest, which could change how the chart looks or even break it one day without you touching anything.

**`integrity` (Subresource Integrity, SRI).** A fingerprint (a hash) of the exact file we expect. The browser computes the fingerprint of what the CDN sends and refuses to run it if it doesn't match. So even if the CDN were hacked, strangers' code couldn't run on your page. It needs `crossorigin="anonymous"`, which asks the CDN for the file in a way the browser is allowed to inspect.

**`typeof Chart`.** When Chart.js loads, it creates a global variable called `Chart`. If the download failed, that variable doesn't exist. Writing just `Chart` would then crash with "Chart is not defined", but `typeof Chart` safely gives the text `'undefined'`. Same trick as the `typeof module` check in `logic.js`.

**Canvas.** `<canvas>` is a blank drawing surface in HTML. Chart.js draws the doughnut on it pixel by pixel. A canvas is just a picture for screen readers, so we add `role="img"` and an `aria-label` with a sentence describing it.

**Create once, update after.** `new Chart(...)` attaches a chart to the canvas. If we did that on every redraw, charts would pile up on the same canvas. So we keep it in `categoryChart`, and later just change `categoryChart.data` and call `categoryChart.update()`, which also animates the change.

**Callbacks in settings.** `tooltip.callbacks.label` is a function we give Chart.js; it calls it whenever it shows a tooltip. We use it to turn the raw number `2500` into `$25.00`, so the chart keeps cents like the rest of the app.

### Most important lines
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.9/dist/chart.umd.js"
        integrity="sha384-4W8gMhOY..." crossorigin="anonymous"></script>
```
Loaded before `logic.js`, so `Chart` exists by the time `app.js` runs. If it fails, the browser just moves on to the next script.

```js
const chartLoaded = typeof Chart !== 'undefined';
chartOffline.hidden = chartLoaded || !hasSpending;
chartBox.hidden = !chartLoaded || !hasSpending;
```
The whole offline fallback: show the chart only if the library loaded and there's something to draw; show the note only if the library is missing and there's something to draw.

```js
colors: rows.map((row) => CATEGORY_COLORS[row.category] || FALLBACK_COLOR),
```
`.map` builds a new list with one colour per row, in the same order as the names and amounts. That "same order" is how Chart.js knows which colour goes with which slice.

```css
.chart-box { position: relative; height: 220px; }
```
With `maintainAspectRatio: false`, Chart.js fills its parent box. The box needs a height and `position: relative`, or the chart can grow forever.

### Files changed
- `index.html`: the Chart.js `<script>` tag, the chart box (`<canvas>`) and the offline note in "Where it went".
- `logic.js`: `CATEGORY_COLORS`, `chartSlices`, `chartDescription`.
- `app.js`: `renderChart` (create once, update after, offline fallback); list bars use the category colour.
- `style.css`: `.chart-box`, `.chart-offline`.
- `tests.js`: 4 tests (every category has a colour, slices line up, empty and unknown category, description sentence).

### Try it yourself
Change `type: 'doughnut'` to `type: 'pie'` in `app.js` and reload. Then try `'bar'` (you'll notice a bar chart wants different settings, like no `cutout`). Put `'doughnut'` back. Bonus: open F12, Network, tick "Offline", reload, and see the fallback.

### Quiz
1. Why do we check `typeof Chart !== 'undefined'` instead of `if (Chart)`?
2. What would happen if the CDN sent a different file than the one we pinned?

<details><summary>Answers</summary>

1. If Chart.js didn't load, the variable `Chart` doesn't exist, and `if (Chart)` would crash with "Chart is not defined", stopping the rest of `app.js`. `typeof` never crashes: it just gives `'undefined'`.
2. The fingerprint in `integrity` wouldn't match, so the browser would refuse to run it. `Chart` would stay undefined and the page would show the list, like when offline.
</details>

---

## Task 2.2: Month switcher (2026-11-05)

### Plan
- One `viewedMonth` variable in `app.js` decides which month the whole page shows (summary, chart, list, entries).
- `logic.js`: `shiftMonth` (move by N months), `monthRange` and `clampMonth` (how far the buttons can go), with tests.
- `logic.js`: `compareCategories` (both months side by side per category), `comparisonText` ("$40 less than last month"), `previousMonthName`, `formatCentsShort`, with tests.
- `index.html`: Previous / Next buttons, a "Back to this month" link, and a "Compared with last month" card.
- After saving, jump to the saved entry's month so you always see it.

### What we built
The top card now has "Previous" and "Next" buttons. Press Previous to look at October: the totals, the chart, "Where it went" and the list of entries all switch to October, and the title says "Looking back". A "Back to this month" link brings you home. The buttons fade out when there's nothing further to see. A new card, "Compared with last month", says for each category how this month compares with the one before, like "Food: $40 less than last month", with "All spending" on top. The sentences are plain facts in calm colours: no red, no "over budget", no judging.

### New concepts

**One piece of state drives the whole page.** `viewedMonth` holds a text like `"2026-10"`. Every button just changes that one variable and calls `render()`, which redraws everything for that month. That's the same "redraw it all from the data" idea from task 1.2: the buttons don't need to know about the list, the chart or the totals.

**Month keys as text.** `"2026-09" < "2026-11"` is true when comparing text, because both have the same shape (4-digit year, dash, 2-digit month) and text is compared character by character. That's why we always pad months to 2 digits: `"2026-9"` would sort after `"2026-11"`.

**Date overflow to move months.** `new Date(2026, -1, 1)` means "month -1 of 2026", which JavaScript turns into December 2025. So `shiftMonth` never needs special cases for January or December: the `Date` does the carrying, like carrying a 1 in addition.

**`disabled`.** A button with `disabled = true` ignores clicks and taps, and the CSS `button:disabled` rule fades it. Better than a button that does nothing when you press it.

**`Set`.** A list that keeps each value only once. `new Set([...Object.keys(now), ...Object.keys(before)])` gives every category from both months, with no duplicates (Food appears once even if both months had Food). `[...set]` turns it back into a normal array.

**Neutral wording on purpose.** The app's job is to show what happened, not to judge it. "$12.50 more than last month" is information; "Overspent!" in red is guilt. Same colour for "more" and "less".

### Most important lines
```js
function shiftMonth(key, delta) {
  const date = new Date(year, monthIndex + delta, 1);
  return date.getFullYear() + '-' + twoDigits(date.getMonth() + 1);
}
```
Day 1 on purpose: moving "January 31" by one month would land on "March 3" (February has no 31st). The 1st exists in every month.

```js
viewedMonth = clampMonth(viewedMonth, range);
```
At the start of `render()`. If you delete the only entry of an old month, that month leaves the range, and this pulls the view back inside it.

```js
return { category, cents, previousCents, diffCents: cents - previousCents };
```
`diffCents` below zero means you spent less this month. `comparisonText` turns it into words with `Math.abs` (the size of the difference, without the minus sign).

### Files changed
- `index.html`: Previous / Next buttons, "Back to this month", `left-label`, the "Compared with" card.
- `logic.js`: `shiftMonth`, `monthRange`, `clampMonth`, `previousMonthName`, `formatCentsShort`, `compareCategories`, `comparisonText`.
- `app.js`: `viewedMonth`, `renderMonthSwitcher`, `renderComparison`, `makeCompareRow`, `showMonth`; summary, totals and list now show the viewed month with matching wording.
- `style.css`: switcher, disabled buttons, comparison rows.
- `tests.js`: 8 tests (month shifting across years, range, clamp, names, short money, comparison with new and missing categories, sentences).

### Try it yourself
Add a line under each comparison row showing both amounts, like "$60 now, $100 in October". Everything you need is already in each row (`row.cents`, `row.previousCents`) and `formatCentsShort`.

### Quiz
1. Why does `shiftMonth` use day 1 instead of today's day?
2. What does `comparisonText(-4000, 'last month')` return, and where does the minus sign go?

<details><summary>Answers</summary>

1. Not every month has every day. Moving the 31st into February would overflow into March. Every month has a day 1, so moving the 1st is always safe.
2. `'$40 less than last month'`. The minus sign decides the word ("less" instead of "more"), then `Math.abs(-4000)` gives `4000` for the amount, which `formatCentsShort` shows as `$40`.
</details>

---

## Task 2.3: Hours of work (2026-11-05)

### Plan
- `logic.js`: `isValidHourlyWage` and `workTimeText(amountCents, wageCents)` ("12 min", "1.5 h"), integer math only, with tests.
- `storage.js`: `loadHourlyWageCents` / `saveHourlyWageCents`, the wage stored in cents per hour under its own key.
- `index.html`: a "Settings" card with an optional "Hourly wage" box, Save and Clear.
- `app.js`: each expense in the list gets a small "1.5 h of work" line when a wage is set.

### What we built
A "Settings" card at the bottom where you can type your pay per hour, like `15.75`. Once saved, every expense in the list shows how long you'd have to work to pay for it: a $30 dinner at $20 an hour shows "1.5 h of work", a $4 bus ticket "12 min of work". It's a way to feel what things cost without any judgement. The wage is saved in this browser, in cents per hour (1575), like every other amount. "Clear" removes it and the lines disappear. Leaving it empty changes nothing.

### New concepts

**Settings vs data.** Entries are your history; a setting is a preference that changes how the history is shown. We store the wage under its own localStorage key (`budget-app.v1.hourlyWageCents`), so it can be changed or cleared without touching the entries.

**Cents per hour.** $15.75 an hour is stored as `1575`. The same rule as amounts: whole numbers only, so no `0.1 + 0.2` surprises. We even reuse `parseAmountToCents` to read the box.

**Integer math for a ratio.** Hours = amount / wage. `3000 / 2000 = 1.5` is fine, but many divisions give long decimals (`10000 / 1575 = 6.349206...`). We want one decimal, so we compute tenths of an hour: `Math.round(10000 * 10 / 1575) = 63`, then split it into `6` and `3` and write "6.3". No decimal number is ever stored or added up.

**Integer division and remainder.** `Math.floor(63 / 10)` gives `6` (how many whole tens) and `63 % 10` gives `3` (what's left). `%` is the "remainder" operator, the same one used in `formatCents` to get the cents.

**`localStorage.removeItem`.** Deletes one key completely. Used by "Clear", so "no wage" is truly nothing, not a `0` that could be mistaken for a wage.

**Checking again when loading.** `loadHourlyWageCents` runs `isValidHourlyWage` on what it reads. If someone edited localStorage by hand to `"hello"` or `-5`, the app treats it as "no wage" instead of showing "NaN h of work".

### Most important lines
```js
const minutes = Math.round((amountCents * 60) / wageCents);
if (minutes < 60) return minutes + ' min';
```
Cents divided by cents per hour gives hours; times 60 gives minutes. Multiply first, then divide, then round, so the answer is a whole number.

```js
const tenths = Math.round((amountCents * 10) / wageCents); // 15 means 1.5 h
return wholeHours.toLocaleString('en-US') + (tenth === 0 ? '' : '.' + tenth) + ' h';
```
`(condition ? a : b)` is a short if/else: when the tenth is 0 we write "2 h" instead of "2.0 h".

```js
const workText = entry.type === 'expense' ? workTimeText(entry.amountCents, hourlyWageCents) : '';
```
Only money out gets a work time, and `workTimeText` returns `''` when no wage is set, so one check (`workText !== ''`) covers both cases.

### Files changed
- `index.html`: the "Settings" card (wage box, Save, Clear).
- `logic.js`: `MAX_HOURLY_WAGE_CENTS`, `isValidHourlyWage`, `workTimeText`.
- `storage.js`: `loadHourlyWageCents`, `saveHourlyWageCents`.
- `app.js`: `hourlyWageCents`, `renderWage`, `setWage`, the wage form listeners, the "of work" line in the list.
- `style.css`: `.entry-work`, `.hint`.
- `tests.js`: 4 tests (valid wages, hours with one decimal, minutes for small amounts, no wage).

### Try it yourself
Show the hours of work for the whole month next to "Money out" (for example "$34.00, about 1.7 h of work"). You only need `app.js`: `workTimeText(totals.outCents, hourlyWageCents)` in `renderSummary`.

### Quiz
1. With a wage of $16 an hour, what does a $4 expense show, and how is it computed?
2. Why does the wage use its own localStorage key instead of being saved inside the entries list?

<details><summary>Answers</summary>

1. "15 min of work". `Math.round(400 * 60 / 1600) = 15` minutes, which is under 60, so it's shown in minutes.
2. It's a setting, not an entry. Keeping it separate means `isValidEntry` and the totals never have to skip a strange "wage" item, and clearing the wage can't touch your history.
</details>

---

## Task 2.4: Export and import (2026-11-05)

### Plan
- `logic.js`: `buildBackup` (the file's content), `backupFileName`, `parseBackup` (checks a file and never throws), `cleanImportedEntry`, `isRealDate`, `mergeEntries` (adds, never deletes), `importSummary`, all tested.
- `app.js`: "Export backup" turns the data into a JSON file and downloads it; "Import backup" opens a file picker, reads the file and asks `logic.js` what to do.
- `index.html`: a "Backup" card with both buttons, a hidden file input and a message line.
- Checked in Chromium: export, then import into a fresh browser, gives back exactly the same entries and wage.

### What we built
A "Backup" card at the bottom. "Export backup" downloads a file like `pocket-budget-backup-2026-11-05.json` with all your entries (every month) and your hourly wage. If the browser is ever cleared, or you switch to a new phone or laptop, "Import backup" loads that file back. Importing adds the entries from the file to what's already here and never deletes anything, so it's always safe to try. If you pick the wrong file (a photo, another app's file, a broken file), it calmly says it isn't a Pocket Budget backup and changes nothing. If a few entries inside a backup look wrong, it keeps the good ones and tells you how many were left out.

### New concepts

**Export and import.** Export = copy your data out of the app into a file you own. Import = read such a file back in. localStorage can be erased by "clear browsing data", so a file is your safety net.

**JSON file.** The same JSON text we already save in localStorage, written into a file. `JSON.stringify(backup, null, 2)` adds line breaks and 2-space indents, so you can open the file in any text editor and read it. Amounts stay whole cents (`1250`), so nothing gets rounded on the way out or in.

**Blob and object URL.** A `Blob` is a chunk of data in the page's memory (here: our text). `URL.createObjectURL(blob)` gives it a temporary address like `blob:null/3f2a...`. A link `<a href="that address" download="name.json">`, clicked by code, makes the browser save it as a file. `URL.revokeObjectURL` frees the memory afterwards. No server needed, so it works from `file://`.

**File input.** `<input type="file">` opens the system's file picker. We hide it (it looks different in every browser) and our nice button calls `importFile.click()` to open it. When a file is chosen, it fires a `change` event, and `importFile.files[0]` is the chosen file.

**`async` / `await`.** Reading a file takes a moment. `file.text()` gives a Promise: "I'll have the text soon". `await file.text()` waits for it without freezing the page; it's only allowed inside a function marked `async`. If reading fails, the error lands in our `try / catch`, like a normal error.

**Never trust a file.** A file can come from anywhere: another app, a hand-edited backup, a mistake. So `parseBackup` checks everything: is it valid JSON, is it our app (`"app": "pocket-budget"`), is it a version we understand, is `entries` a list, and then each entry one by one. It returns an answer instead of throwing, so the page can always show a calm message.

**Copy only what you know.** `cleanImportedEntry` builds a brand-new object with exactly our 7 fields. Any extra field in the file (`isAdmin: true`, a giant blob of text) is simply not copied. That's safer than spreading the whole object with `...raw`.

**A version number in the file.** `"version": 1` is a promise about the file's shape. If a future Pocket Budget changes the shape, it will write `"version": 2`, and this version knows to refuse it instead of misreading it.

**Merging by id.** Every entry has a unique id. `mergeEntries` puts the ids already here in a `Set`, then keeps only the file's entries whose id isn't in it. That's why importing twice doesn't double your entries.

### Most important lines
```js
const url = URL.createObjectURL(blob);
link.href = url;
link.download = backupFileName(todayISO());
link.click();
```
The whole download: give the data an address, point a link at it, tell the browser to save rather than open it (`download`), and click it from code.

```js
const isObject = typeof data === 'object' && data !== null && !Array.isArray(data);
if (!isObject || data.app !== BACKUP_APP) { return { ok: false, message: ... }; }
```
`typeof null` and `typeof []` are both `'object'` in JavaScript (a famous oddity), so we rule them out by hand before reading `data.app`.

```js
if (!isRealDate(raw.date)) return null;
```
`"2026-02-30"` passes the shape check, but `new Date` would quietly turn it into March 2. `isRealDate` sends the date through `addDays(date, 0)` and checks that the same text comes back.

```js
const newOnes = importedEntries.filter((entry) => !idsHere.has(entry.id));
```
Keep only entries we don't already have. Checking a `Set` is instant, even with thousands of ids.

### Files changed
- `index.html`: "Backup" card (Export backup, Import backup, hidden file input, message).
- `logic.js`: `BACKUP_APP`, `BACKUP_VERSION`, `MAX_BACKUP_BYTES`, `buildBackup`, `backupFileName`, `isRealDate`, `cleanImportedEntry`, `parseBackup`, `mergeEntries`, `importSummary`.
- `app.js`: `handleExport`, `handleImportFile` and their listeners.
- `tests.js`: 10 tests (file content, export-then-import round trip, broken and foreign files, versions, bad entries counted, extra fields dropped, bad wage ignored, real dates, merging, messages).

### Try it yourself
Export a backup, open the `.json` file in a text editor, and change one `amountCents` to `12.5`. Import it into the app (in a private window, so it starts empty). Read the message: which entry was left out, and which test in `tests.js` checks exactly that?

### Quiz
1. Why does importing a backup twice not give you every entry twice?
2. Why do we check `Array.isArray(data)` when `typeof data === 'object'` already passed?

<details><summary>Answers</summary>

1. `mergeEntries` matches entries by id. The second time, every id from the file is already here, so nothing is added ("No new entries to add. 3 were already here.").
2. In JavaScript, `typeof []` is `'object'` too. A bare list isn't our backup format (it has no `app` or `version`), so we refuse it explicitly.
</details>

---

## Task 3.1: Savings goals (2026-11-05)

### Plan
- `logic.js`: what a goal looks like, `validateGoalInput` (checks the "New goal" form), `goalSavedCents`, `goalPercent`, `addDeposit`, `deleteGoal`, `cleanGoal` (checks a goal from storage or a file), `formatLongDate`.
- `storage.js`: `loadGoals` / `saveGoals` under their own key.
- `index.html` + `style.css`: a "Savings goals" card with the list, progress bars and a "New goal" form.
- `app.js`: create a goal, "Add money", delete with a confirm step.
- Backup goes to version 2 and includes goals; version 1 files still work. Tests for all the logic.

### What we built
A "Savings goals" card. Type a name ("New bike"), an amount ($300) and, if you want, a date to reach it by, then tap **Create goal**. Each goal shows "$120.00 of $300.00", a teal progress bar and "40% · by Mar 31, 2027". Type an amount in its little box and tap **Add money** whenever you put money aside. When the goal is reached, the bar is full and it says "Reached! Nice work." **Delete goal** asks first, like entries do. Goals are saved in the browser and are part of the backup file, so Export / Import keeps them too. Old backup files (made before goals existed) still import fine.

### New concepts

**A list inside an object.** A goal holds `deposits: [{ amountCents, date }, ...]`, a list of every time you added money. The total is calculated by adding them up (`goalSavedCents`). Storing the history instead of only a total costs a few bytes, but it lets us answer questions later, like "how much did I save this month?".

**Rounding down on purpose.** `Math.floor` always rounds down (99.97 becomes 99). For a progress bar, rounding normally (`Math.round`) would show "100%" when you still miss 3 cents, which feels like a lie. So the bar only reaches 100% when the goal is truly reached.

**Validation that returns an answer.** `validateGoalInput` never shows anything on screen and never throws. It returns `{ ok: true, fields }` or `{ ok: false, message }`, and `app.js` decides what to show. Because it's a pure function, `tests.js` can try lots of bad inputs in a few lines.

**Event delegation with forms.** Each goal has its own small "Add money" form, and they're redrawn often. Instead of one listener per form, there's one `submit` listener on the whole list: a submit event "bubbles up" from the small form to its parents. `event.target.closest('.deposit-form')` finds which form it was, and its `data-id` says which goal.

**Backward compatible.** A newer program can still read files made by an older one. Version 1 backups have no `goals`; `parseBackup` treats a missing list as an empty one instead of refusing the file. We bumped the number to 2 so that an *older* app seeing a new file knows it's newer and refuses it calmly, instead of silently dropping your goals.

**Screen-reader-only text.** The "Add money" box has no visible label (the goal's name is right above it), but a screen reader still needs one. The `.visually-hidden` class shrinks the label to 1 pixel and clips it: invisible on screen, still read out loud.

**`role="progressbar"`.** Our bar is just two coloured boxes. `role="progressbar"` and `aria-valuenow="40"` tell screen readers "this is a progress bar at 40 percent".

### Most important lines
```js
if (savedCents >= targetCents) return 100;
return Math.floor((savedCents * 100) / targetCents);
```
Multiply first, then divide: `29999 * 100 / 30000` is 99.99..., and `Math.floor` makes it 99. The first line caps the bar at 100% when you've saved more than the target.

```js
{ ...goal, deposits: [...goal.deposits, { amountCents, date: isoDate }] }
```
A NEW goal object with a NEW deposits list: the old list plus one more. We never `push` into the old one, so the previous state stays untouched (the test checks that).

```js
if (!READABLE_BACKUP_VERSIONS.includes(data.version)) {
```
Instead of "must be exactly version 1", it's "must be one of the versions we know how to read" (1 or 2).

```js
const rawGoals = Array.isArray(data.goals) ? data.goals : [];
```
The heart of backward compatibility: no goals in the file means an empty list, not an error.

### Files changed
- `index.html`: the "Savings goals" card (list, empty message, "New goal" form).
- `style.css`: goal rows, progress bar, the "Add money" row, `.visually-hidden`.
- `logic.js`: the goal functions above; backup version 2 (`READABLE_BACKUP_VERSIONS`, goals in `buildBackup` / `parseBackup`), `mergeById`, goals in `importSummary`.
- `storage.js`: `GOALS_KEY`, `loadGoals`, `saveGoals`.
- `app.js`: `renderGoals`, the create / add money / delete listeners, goals in export and import.
- `tests.js`: 12 new tests (dates, totals, percent rounding, validation, cleaning, backup round trip, old version 1 files, merging, messages); two old backup tests updated for version 2.

### Try it yourself
Add a "Take out" button next to "Add money" that adds a deposit with a *negative* amount. Which line in `cleanGoal` would then throw away your goal on the next reload, and how would you change it (and its test) safely?

### Quiz
1. Why does a goal store a list of deposits instead of a single `savedCents` number?
2. A Phase 2 backup has no `goals` field. What does `parseBackup` do with it, and why didn't we just keep `version: 1`?

<details><summary>Answers</summary>

1. A list remembers *when* each amount was added. With only a total, we could never tell how much was saved this month, which "safe to spend" and 50/30/20 need.
2. It imports the entries and wage and treats goals as an empty list (backward compatible). We moved to version 2 so an older copy of the app, given a new file, says "made by a newer version" instead of importing it and quietly losing the goals.
</details>

---

## Task 3.2: Monthly budget per category (2026-11-05)

### Plan
- `logic.js`: `cleanBudgets` (checks budgets from storage or a file), `setBudget`, `budgetRows` (spent, left, percent, over or not), `budgetStatusText` (calm sentences), `mergeBudgets` for import.
- `storage.js`: `loadBudgets` / `saveBudgets`.
- `index.html` + `style.css`: a "Monthly plan" card with one row per budget and a "Set a budget" form (category menu + amount).
- `app.js`: save, change and remove a budget; rows follow the month on screen.
- Budgets go in the backup file. Tests for every function, including "no budgets" and "over the plan".

### What we built
A "Monthly plan" card under the entry form. Pick a category in the menu, type an amount ("200") and tap **Save budget**: you now have $200 a month for Food. Each budget gets a row: "🍔 Food  $75.50 of $200.00", a bar in Food's teal, and "$124.50 left of $200". When you spend more than planned, the bar is simply full and the sentence says "$12 more than planned. A plan is a guide, not a test." To change a budget, pick its category again (the amount box fills itself in), type the new amount and save. **Remove** deletes it. When you look back at an earlier month, the rows show that month's spending.

### New concepts

**An object as a lookup table.** `budgets` is `{ Food: 20000, Fun: 5000 }`. The category name is the *key*, the limit is the *value*. `budgets['Food']` gives 20000 instantly, and `budgets['Bills']` gives `undefined`, which means "no budget". That's simpler than a list of `{ category, limit }` objects we'd have to search through.

**`delete` on a copy.** `delete copy[category]` removes a key from an object. We first make a copy with `{ ...budgets }`, so the original object (the app's current state) doesn't change behind our back.

**`<select>` and `<option>`.** A drop-down menu. Its `value` is the `value` of the chosen option, and it fires a `change` event when you pick another one. We use that event to pre-fill the amount box with the saved budget.

**Reusing a function.** The budget bar needs the same "round down, never more than 100" rule as the goal bar, so `budgetRows` simply calls `goalPercent(spent, limit)`. One rule, one place, already tested.

**Neutral design for "over".** Red means "danger" to our brains. Spending $12 more on fun isn't danger, so the bar keeps its normal colour and the words state a fact plus a kind reminder. A test even checks that the sentence never contains words like "warning" or a minus sign.

### Most important lines
```js
const limitCents = limits[category];
if (!limitCents) continue; // no budget for this category
```
`undefined` (no budget) counts as "falsy", so `!limitCents` is true and `continue` jumps to the next category.

```js
leftCents: limitCents - spentCents,
isOver: spentCents > limitCents,
```
`leftCents` can be negative. Logic keeps the honest number; only `budgetStatusText` decides how to *say* it ("$12 more than planned").

```js
if (Number.isInteger(cents) && cents > 0 && cents <= MAX_AMOUNT_CENTS) budgets[category] = cents;
```
`cleanBudgets` loops over OUR category list, not over the keys in the file, so a key like `"Pizza"` or `"Job"` is never even looked at.

### Files changed
- `index.html`: the "Monthly plan" card (budget list, empty message, "Set a budget" form).
- `style.css`: `select`, budget rows, the small "Remove" button.
- `logic.js`: the budget functions above; `budgets` in `buildBackup`, `parseBackup` and `importSummary`.
- `storage.js`: `BUDGETS_KEY`, `loadBudgets`, `saveBudgets`.
- `app.js`: `renderBudgetOptions`, `fillBudgetAmount`, `renderBudgets`, the save / remove listeners, budgets in export and import.
- `tests.js`: 8 new tests; the `buildBackup` test now also expects `budgets: {}`.

### Try it yourself
Add a total line at the top of "Monthly plan": "All budgets: $137.50 of $250.00". Write a function `budgetTotals(rows)` in `logic.js` that adds up `spentCents` and `limitCents` of the rows, test it with two rows and with no rows, then show it in `renderBudgets`.

### Quiz
1. You set Fun to $50 and spend $62. What are `percent`, `leftCents` and `isOver` for that row?
2. Why does `cleanBudgets` loop over `EXPENSE_CATEGORIES` instead of `Object.keys(raw)`?

<details><summary>Answers</summary>

1. `percent` is 100 (capped, so the bar doesn't overflow), `leftCents` is -1200, `isOver` is true. The screen says "$12 more than planned".
2. The file could contain any keys ("Pizza", "Job", "__proto__"). Looping over our own list means only real expense categories can ever end up in `budgets`.
</details>

---

## Task 3.3: Safe to spend (2026-11-05)

### Plan
- `logic.js`: `daysInMonth`, `daysLeftInMonth` (today counts), `monthsBetween`, `goalAddedInMonth`, `goalMonthlyPlanCents`, `goalsSetAsideCents`, `billsStillToPayCents`, then `safeToSpend` (all the numbers) and `safeToSpendDetail` / `goalPlanText` (the sentences).
- `index.html` + `style.css`: a teal "Safe to spend" box at the very top of "This month".
- `app.js`: `renderSafeToSpend`, only for the current month; each goal with a date shows "This month's plan".
- Tests for the edge cases: last day of the month, negative left, no budgets, rounding cents per day, leap year.

### What we built
The first thing on the page is now one number: **Safe to spend: $17.69 a day**. Under it, the math in words: "$460.00 for the next 26 days ($570.00 left, minus $60.00 for goals and $50.00 for bills)." "Left" is what you already had (money in minus money out). "For goals" is what your dated goals need this month (each goal now shows "This month's plan: $60.00"). "For bills" is what's still unspent in your Bills budget. What remains is shared over the days left, today included. If nothing extra is left, you don't see $0.00 or a minus sign, only a calm sentence like "Your plans come first, and that's a good thing." Looking back at another month hides the box.

### New concepts

**Breaking a big formula into small functions.** "Safe to spend" mixes income, spending, goals, bills and dates. Instead of one long function, each piece has its own small function with its own tests (`daysLeftInMonth`, `goalMonthlyPlanCents`, `billsStillToPayCents`...), and `safeToSpend` just puts them together. When a number looks wrong, you can test each piece alone to find the culprit.

**Rounding up vs rounding down, on purpose.** `Math.ceil` rounds up, `Math.floor` rounds down. Goal plans round UP ($100 over 3 months is $33.34 a month) so the shares reach the target instead of falling 1 cent short. Safe to spend rounds DOWN ($33.33 a day) so the app never says you can spend a cent you don't have. Same kind of numbers, opposite rounding, because the "safe" direction is different.

**Edge cases.** The unusual inputs where bugs hide: the last day of the month (1 day left, not 0, or we'd divide by zero), February in a leap year, no income at all, more out than in, no budgets. The tests try each one on purpose.

**Dividing by zero.** In JavaScript `100 / 0` is `Infinity`, not an error, so the bug would be silent. `daysLeftInMonth` counts today, so its smallest answer is 1 and we can always divide by it.

**`Math.max` as a "never below" guard.** `Math.max(0, limit - spent)` gives the difference, or 0 if it's negative. Bills paid past their budget count as "nothing still to pay", not as negative money.

**`classList.toggle(name, condition)`.** Adds the class when the condition is true and removes it when false, in one line. We use it to make the calm note read a bit larger when it's shown alone.

### Most important lines
```js
return daysInMonth(monthKey(todayIsoDate)) - day + 1;
```
November has 30 days. On the 5th: 30 - 5 + 1 = 26 (the 5th itself counts). On the 30th: 30 - 30 + 1 = 1.

```js
return new Date(year, month, 0).getDate();
```
`month` here is 1-based (11 for November), but `new Date` expects 0-based months, so 11 means December. Day 0 of December is the day before December 1, which is November 30. `getDate()` gives 30.

```js
total += Math.max(goalMonthlyPlanCents(goal, key), goalAddedInMonth(goal, key));
```
Plan $60, added $20: $60 set aside ($20 already moved, $40 still to move). Added $80: $80 set aside, because that money really left your pocket.

```js
perDayCents: availableCents > 0 ? Math.floor(availableCents / daysLeft) : 0,
```
Rounded down, and never negative. The UI hides the number when it's 0.

### Files changed
- `index.html`: the "Safe to spend" box at the top of "This month".
- `style.css`: the safe-to-spend box; "Left this month" is now grey.
- `logic.js`: the functions listed in the plan.
- `app.js`: `renderSafeToSpend`; a "This month's plan" line under each dated goal.
- `tests.js`: 14 new tests.

### Try it yourself
Make "remaining bills" smarter: also keep aside the unspent part of the **School** budget (books are often bought late in the month). Change `billsStillToPayCents` to take a list of categories, update its test, and check that `safeToSpendDetail` still reads well.

### Quiz
1. It's November 28, you have $100 left, no goals and no budgets. What does safe to spend show, and why not $33.34?
2. Your Bills budget is $80 and you've logged $95 of Bills. How much does `billsStillToPayCents` keep aside, and which line makes sure of it?

<details><summary>Answers</summary>

1. "$33.33 a day". There are 3 days left (28, 29, 30), and 10000 / 3 = 3333.33... cents, rounded DOWN with `Math.floor` so that 3 x $33.33 = $99.99 is never more than you have.
2. $0. `Math.max(0, limitCents - spentCents)` turns 8000 - 9500 = -1500 into 0.
</details>

---

## Task 3.4: Budget styles (2026-11-05)

### Plan
- `logic.js`: settings (`DEFAULT_SETTINGS`, `cleanSettings`, `sameSettings`, `mergeSettings`), the groups (`NEEDS_CATEGORIES`, `WANTS_CATEGORIES`), `splitTargets`, `fiftyThirtyTwenty` and `splitRowText`.
- `storage.js`: `loadSettings` / `saveSettings` under one key for all settings.
- `index.html` + `style.css`: a "Simple | 50/30/20" switch at the top of "Monthly plan", the 50/30/20 rule in two sentences, which categories count where, and three bars.
- `app.js`: `renderBudgetStyle` and the switch; settings in export and import.
- Tests: the split always adds up to the exact money in, no money in, every category in exactly one group.

### What we built
At the top of "Monthly plan" there's now a switch: **Simple** or **50/30/20**. Simple is what you had: track spending, with budgets per category if you like. 50/30/20 explains the rule in two sentences and shows three bars for the month on screen: "Needs (50%) $200 of $500", "Wants (30%) $410, a bit above the $300 guide", "Savings (20%) $75 of $200". The guides come from your money in that month ($1,000 here). Savings is the money you added to goals that month. Your choice is remembered after a reload and is included in backups.

### New concepts

**The 50/30/20 rule.** A popular rule of thumb for a budget: about 50% of what you earn for needs (rent, food, transport, school), 30% for wants (fun, extras) and 20% for savings. It's not a law; it's a quick way to see if the big picture looks balanced.

**A settings object.** Instead of one localStorage key per setting, all settings live in one object `{ budgetStyle: 'simple' }`. Adding a setting later (task 3.5) means adding one field, not a new key and two new storage functions.

**Defaults and "fall back".** `cleanSettings` gives every setting a value even if storage is empty or holds nonsense: `BUDGET_STYLES.includes(data.budgetStyle) ? data.budgetStyle : 'simple'`. The rest of the app never has to wonder "what if budgetStyle is missing?".

**Giving the leftover cent somewhere to go.** 50% of $10.01 is $5.005, which isn't a whole cent. If we rounded all three parts separately, they could add up to $10.00 or $10.02. So two parts are rounded down and the last one is "whatever is left": `savingsCents = incomeCents - needsCents - wantsCents`. A test checks the sum for several odd amounts.

**Arrow function that builds objects.** `const row = (group, guidePercent, targetCents, actualCents) => ({ ... })` is a tiny helper function inside `fiftyThirtyTwenty`. The round brackets around `{ ... }` mean "return this object" (without them, JavaScript would think `{` starts the function's body).

**Reusing CSS classes.** The style switch has the classes `type-button style-button`. `type-button` gives it the exact look of the "Money out / Money in" switch for free; `style-button` is only used by `app.js` to find these two buttons.

### Most important lines
```js
const needsCents = Math.floor((incomeCents * 50) / 100);
const wantsCents = Math.floor((incomeCents * 30) / 100);
return { needsCents, wantsCents, savingsCents: incomeCents - needsCents - wantsCents };
```
Whole-cent math only, and the three parts add up to exactly the money in.

```js
if (NEEDS_CATEGORIES.includes(entry.category)) needsCents += entry.amountCents;
else wantsCents += entry.amountCents;
```
Every expense goes into one of the two groups. The test "every expense category is either a need or a want" makes sure a new category can't be forgotten.

```js
if (importedSettings === null || !sameSettings(currentSettings, DEFAULT_SETTINGS)) {
  return { settings: currentSettings, restored: false };
}
```
If you changed a setting here, your choice wins over the file. Only a "fresh" browser takes the file's settings.

### Files changed
- `index.html`: style switch, the two explanation texts, the split list; a "Budget per category" sub-heading.
- `style.css`: spacing for the style texts and split box.
- `logic.js`: the functions above; `settings` in `buildBackup`, `parseBackup`, `importSummary`.
- `storage.js`: `SETTINGS_KEY`, `loadSettings`, `saveSettings`.
- `app.js`: `renderBudgetStyle`, `setBudgetStyle`, the switch listeners, settings in export and import.
- `tests.js`: 8 new tests; the `buildBackup` test now also expects the default settings.

### Try it yourself
Some people use 60/20/20 when rent is high. Change `splitTargets` to take the three percentages as arguments (with 50, 30, 20 as defaults) and add a test that 60/20/20 of $1,000 gives $600, $200 and $200. Does the "always adds up" test still pass?

### Quiz
1. Money in this month is $10.01. What are the three guides in cents, and why does savings get the extra cent?
2. You picked 50/30/20 on your laptop and import a backup from your phone where you had "Simple". Which style do you end up with, and why?

<details><summary>Answers</summary>

1. Needs 500, wants 300, savings 201. Needs and wants are rounded down; savings is "money in minus the other two", so nothing is lost: 500 + 300 + 201 = 1001.
2. 50/30/20. Your settings here are no longer the defaults, so `mergeSettings` keeps them ("what's here wins").
</details>

---

## Task 3.5: Rollover (2026-11-05)

### Plan
- `logic.js`: a `rollover` setting (off by default) in `cleanSettings`; `effectiveLimits` (budget + last month's unspent part); `budgetRows` remembers `rolledOverCents`; `rolloverText`.
- `index.html` + `style.css`: a checkbox "Roll unspent budget over to next month" in "Monthly plan", with a one-line explanation.
- `app.js`: budget rows use the effective limits and show "Includes $20 not spent in October".
- The setting is part of the backup (inside `settings`). Tests: off, on, overspent last month, empty last month, the saved budgets never change.

### What we built
A checkbox in "Monthly plan": **Roll unspent budget over to next month**. When it's ticked, each budget gets a bonus: whatever you didn't spend of it last month. If Fun is $50 a month and you spent $30 in October, November's Fun row says "$45.00 of $70.00" with a small line "Includes $20 not spent in October". Spending more than planned last month never shrinks this month's budget. The saved budget itself stays $50: the extra is calculated each time from last month's entries, so turning the box off gives the plain numbers back instantly. Looking back at October shows October with September's rollover.

### New concepts

**Checkbox.** `<input type="checkbox">` is an on/off box. Its `checked` property is `true` or `false`, and it fires a `change` event when it flips. Wrapping it in a `<label>` makes the whole line tappable, which matters on a phone. `accent-color` paints the tick in our teal.

**Derived data (calculate, don't store).** We never save "November's Fun budget is $70". We save only "Fun is $50" and the entries, and `effectiveLimits` *works out* $70 whenever the page draws. Stored copies can go stale (edit an October entry and a stored $70 would be wrong); a calculation is always up to date.

**Destructuring.** `const { limits, rolledOver } = effectiveLimits(...)` takes the two fields out of the returned object and makes two variables in one line. Same as `const result = effectiveLimits(...); const limits = result.limits; const rolledOver = result.rolledOver;`.

**Default parameter.** `function budgetRows(monthEntries, limits, rolledOver = {})`: if the caller doesn't pass a third value, `rolledOver` is an empty object. The older tests (from 3.2) still call it with two arguments and keep working.

**Adding a setting without breaking old data.** Settings saved in 3.4 look like `{ budgetStyle: '503020' }` with no `rollover`. `cleanSettings` gives `rollover: data.rollover === true`, which is `false` for a missing value. So old settings, old backups and brand-new browsers all just work.

### Most important lines
```js
const unspentCents = Math.max(0, budgets[category] - (spentBefore[category] || 0));
```
Budget minus what was spent last month, but never below 0: that's the "no negative rollover" rule in one line. `|| 0` covers a category with no spending last month.

```js
if (!rolloverOn || previousMonthEntries.length === 0) return { limits, rolledOver };
```
Two early exits: the switch is off, or last month is empty (probably before you used the app).

```js
const limits = { ...budgets };
```
A copy, so adding the rollover never changes your saved budgets. A test checks it.

### Files changed
- `index.html`: the rollover checkbox and its explanation; the backup card's hint now lists goals, budgets and settings.
- `style.css`: `.check-row` (checkbox + text, full tap height), `.rollover-note`.
- `logic.js`: `rollover` in `DEFAULT_SETTINGS` / `cleanSettings`, `effectiveLimits`, `rolloverText`, `rolledOverCents` in `budgetRows`.
- `app.js`: `renderBudgets` uses `effectiveLimits`; the checkbox listener.
- `tests.js`: 9 new tests; earlier exact-shape tests now include `rollover: false` and `rolledOverCents: 0`.

### Try it yourself
Make rollover pile up: November's Fun budget would include what was unspent in October *including October's own rollover from September*. Hint: `effectiveLimits` for a month needs the effective limits of the month before, so the function would call itself (that's called *recursion*). Where does it stop, and how would you test three months in a row?

### Quiz
1. Fun is $50 a month. In October you spent $80 on Fun. Rollover is on. What is November's Fun budget, and why?
2. Why do we calculate the rolled-over budget every time instead of saving "$70" for November?

<details><summary>Answers</summary>

1. $50. October's unspent part is `Math.max(0, 5000 - 8000) = 0`, so nothing is added and nothing is taken away.
2. Because it depends on October's entries, which can still change (you can edit or delete them, or import a backup). A saved $70 could become wrong; a calculation is always right.
</details>
