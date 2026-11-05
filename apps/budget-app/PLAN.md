# Budget App Plan

One task = one Claude Code session. Do them in order. Each task ends with
working code, passing tests (`node tests.js`), an updated LEARNING.md and a commit.

How to start a session: "Read CLAUDE.md and PLAN.md. Do the next unchecked task only."

---

## Phase 0: Setup

- [x] **0.1 Project skeleton.** Create index.html, style.css, app.js, logic.js,
  storage.js, tests.js and LEARNING.md. The page shows the app name and an empty
  "This month" section. tests.js runs one trivial test and prints "All tests passed".
  Explain in LEARNING.md what each file is for and how the browser loads them.

## Phase 1: Log money

Goal: adding an expense takes under 5 seconds.

- [x] **1.1 Add an expense.** A form: amount (big, first, focused on load), category
  buttons (Food, Transport, Fun, School, Bills, Other), optional note. Date defaults
  to today. Saved to localStorage through storage.js. Amount stored in cents.
- [x] **1.2 Show the list.** This month's entries, newest first, with category, note,
  amount and date. Shows a friendly message when the list is empty.
- [x] **1.3 Edit and delete.** Tap an entry to edit it or delete it, with a confirm
  step before deleting.
- [x] **1.4 Income.** Add income entries (job pay, gifts). Show "Money in", "Money out"
  and "Left this month" at the top. Test the totals in tests.js.
- [x] **1.5 Totals per category.** A simple list of how much went to each category
  this month, biggest first. Logic in logic.js with tests.
- [x] **1.6 Phone-friendly layout.** Make the page comfortable on a phone screen
  (big tap targets, one column). Explain the CSS used in LEARNING.md.

## Phase 2: See it

- [x] **2.1 Category chart.** A doughnut or bar chart of this month's spending by
  category using Chart.js from a CDN. Explain what a library and a CDN are.
- [x] **2.2 Month switcher.** Buttons to view previous months. Compare this month vs
  last month per category ("Food: $40 less than last month").
- [x] **2.3 Hours of work.** A settings field for hourly wage. When set, each expense
  also shows how many hours of work it cost (e.g. "1.5 h"). Tested in logic.js.
- [x] **2.4 Export and import.** Download all data as a JSON file and load it back,
  so data isn't lost if the browser is cleared.

## Phase 3: Goals without guilt

- [x] **3.1 Savings goals.** Create a goal (name, target amount, optional date), add
  money to it, see a progress bar.
- [x] **3.2 Monthly budget per category.** Set a limit per category. Show progress in
  neutral colours. Going over shows a calm message, not red alarms.
- [x] **3.3 Safe to spend.** One number at the top: money left this month minus
  money planned for goals and remaining bills, divided by days left. Tested.
- [x] **3.4 Budget styles.** Let the user pick: "Simple" (just track) or "50/30/20"
  (needs, wants, savings). Explain the 50/30/20 rule in the app in two sentences.
- [x] **3.5 Rollover.** Unspent budget can roll over to next month (on/off setting).

## Phase 4: Learn investing (paper trading)

Educational only. Fake money. No "buy this" advice anywhere.

- [ ] **4.0 Choose a data source.** Research free stock-price APIs. Compare 2 or 3
  options in LEARNING.md: free limits, whether it needs a key, whether it can be
  called from a browser, and the risk of putting a key in public code.
  Recommend one and STOP. I will choose before 4.1.
- [ ] **4.1 Simulator wallet.** A separate "Practice" tab with $1,000 of fake money.
  Search a stock or ETF by ticker and show its latest (possibly delayed) price.
- [ ] **4.2 Buy and sell.** Buy and sell fake shares. Track holdings, average cost,
  current value and gain or loss. All math in logic.js with tests.
- [ ] **4.3 Lesson cards.** 6 short cards: stock, ETF, diversification, fees,
  risk vs time, why "get rich quick" fails. Max 80 words each, plain language.
- [ ] **4.4 Savings link.** On a savings goal: "Practice investing this amount"
  copies the goal's amount into the simulator as fake money, and shows what it
  would be worth over time. Clear label: past results don't predict the future.

## Later (not now)

- Accounts and friend savings challenges, after the workout app teaches accounts.
- "Explain my month" AI summary with the Claude API. Needs a small server to hide
  the API key and a Console account with paid API credits.
