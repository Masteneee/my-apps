# Pocket Budget

A quick, guilt-free budgeting page for young people. Log money out (Food, Transport, Fun, School, Bills, Other) and money in (Job, Gift, Other) in a few seconds, see "Money in", "Money out" and "Left this month", where the money went per category (with a doughnut chart), and this month's entries newest first. Tap an entry to edit or delete it. Look back at earlier months and see each category compared with the month before ("Food: $40 less than last month"). Optionally set your hourly wage to see what each expense cost in hours of work. Export a backup file and import it back.

Plain HTML, CSS and JavaScript. No build step, no packages. The only outside code is [Chart.js](https://www.chartjs.org/) 4.4.9, loaded from the jsDelivr CDN with a pinned version and an integrity check; without internet the page still works and shows the totals as a list. Data stays in your browser (localStorage), on this device only, until you export a backup.

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
8. Chart: with internet, "Where it went" shows a doughnut whose colours match the bars in the list. Hover or tap a slice to see its amount. Then F12 > Network > Offline, reload: the chart is replaced by a short note and the list.
9. Months: add an entry dated last month. Tap **Previous**: the title says "Looking back" and everything shows last month. **Back to this month** returns. "Compared with last month" shows lines like "Food: $40 less than last month".
10. Hours of work: in **Settings**, type `20` and **Save wage**. A $30 expense shows "1.5 h of work", a $4 one "12 min of work". **Clear** hides them.
11. Backup: tap **Export backup** (a `.json` file downloads). Open the page in a private window, tap **Import backup**, pick the file: all entries and the wage come back. Import it again: "No new entries to add". Try importing any other `.json` file: it's refused and nothing changes.

## Files

- `index.html` page structure
- `style.css` all styling
- `app.js` the UI: form, list, buttons
- `logic.js` pure functions (money parsing, totals, dates), tested
- `storage.js` the only file that touches localStorage
- `tests.js` tests for `logic.js`
- `LEARNING.md` study notes for each task
