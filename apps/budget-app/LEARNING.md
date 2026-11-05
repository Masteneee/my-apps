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
