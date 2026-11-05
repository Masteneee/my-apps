# Pocket Budget

A quick, guilt-free budgeting page for young people. Log money out (Food, Transport, Fun, School, Bills, Other) and money in (Job, Gift, Other) in a few seconds, see "Money in", "Money out" and "Left this month", where the money went per category, and this month's entries newest first. Tap an entry to edit or delete it.

Plain HTML, CSS and JavaScript. No build step, no packages. Data stays in your browser (localStorage), on this device only.

## Open it

Double-click `index.html` (or drag it into a browser window). No server needed.

## Run the tests

```
node tests.js
```

It prints `All tests passed (N tests)`. GitHub Actions runs the same command on every push that touches this folder (`.github/workflows/budget-app.yml` at the repo root).

## Test it by hand

1. Open the page: the cursor is already in the Amount box and the date is today.
2. Type `12,50`, tap **Food**, tap **Save**. "Money out" shows $12.50 and the entry appears in the list as "Today".
3. Tap **Money in**, type `200`, tap **Job**, **Save**. "Money in" shows $200.00 and "Left this month" $187.50.
4. Tap the Food entry: the form says "Edit entry". Change the amount to `15`, **Save changes**. Totals update.
5. Tap an entry, **Delete this entry**, then **Keep it** (nothing happens), then delete again and **Yes, delete**.
6. Reload the page: everything is still there.
7. Phone check: in Chrome press F12, click the phone icon (device toolbar), pick a phone. One column, no sideways scrolling, big buttons.

## Files

- `index.html` page structure
- `style.css` all styling
- `app.js` the UI: form, list, buttons
- `logic.js` pure functions (money parsing, totals, dates), tested
- `storage.js` the only file that touches localStorage
- `tests.js` tests for `logic.js`
- `LEARNING.md` study notes for each task
