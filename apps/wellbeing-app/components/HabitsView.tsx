"use client";
// The /habits page: add a habit (checkbox, number or minutes), archive one,
// or bring an archived one back. Archiving hides a habit from the check-in
// but keeps its history (Stage 3's streaks and calendar will use it).

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCheckinStore, type Habit, type HabitType } from "@/lib/checkin";
import { HABIT_NAME_MAX, habitValueMax } from "@/lib/checkin/validation";
import { buttonPrimary, buttonSecondary, card, input, label, link } from "./ui";
import { useRequireAccount } from "./useRequireAccount";

const TYPES: { type: HabitType; title: string; example: string }[] = [
  { type: "checkbox", title: "Yes / no", example: "Stretch, take my meds" },
  { type: "number", title: "A count", example: "Glasses of water, pages" },
  { type: "minutes", title: "Minutes", example: "Reading, meditation" },
];

/** "Yes / no", "A count · goal 8", "Minutes · goal 20 min" */
function describeHabit(habit: Habit): string {
  const title = TYPES.find((t) => t.type === habit.type)?.title ?? habit.type;
  if (habit.target === null) return title;
  return `${title} · goal ${habit.target}${habit.type === "minutes" ? " min" : ""}`;
}

export function HabitsView() {
  const { ready } = useRequireAccount();
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [type, setType] = useState<HabitType>("checkbox");
  const [target, setTarget] = useState("");
  const [icon, setIcon] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getCheckinStore()
      .listHabits({ includeArchived: true })
      .then((list) => !cancelled && setHabits(list))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Couldn't load your habits."));
    return () => {
      cancelled = true;
    };
  }, [ready]);

  async function reload() {
    setHabits(await getCheckinStore().listHabits({ includeArchived: true }));
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await getCheckinStore().createHabit({
        name,
        type,
        icon,
        // An empty box means "no goal". Number() turns "8" into 8.
        target: type === "checkbox" || target.trim() === "" ? null : Number(target),
      });
      setName("");
      setTarget("");
      setIcon("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the habit.");
    } finally {
      setBusy(false);
    }
  }

  async function setArchived(habit: Habit, archived: boolean) {
    setError(null);
    try {
      await getCheckinStore().setHabitArchived(habit.id, archived);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change the habit.");
    }
  }

  if (!ready || (habits === null && !error)) return <p className="text-muted">Loading...</p>;

  const active = (habits ?? []).filter((h) => !h.is_archived);
  const archived = (habits ?? []).filter((h) => h.is_archived);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Your habits</h1>
        <p className="mt-1 text-muted">They show up at the end of each check-in. Keep the list short.</p>
      </header>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <section aria-labelledby="active-title" className="space-y-3">
        <h2 id="active-title" className="font-semibold">
          Active
        </h2>
        {active.length === 0 && <p className="text-sm text-muted">None yet. Add your first one below.</p>}
        <ul className="space-y-2">
          {active.map((habit) => (
            <li key={habit.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {habit.icon && <span aria-hidden="true">{habit.icon} </span>}
                  {habit.name}
                </p>
                <p className="text-sm text-muted">{describeHabit(habit)}</p>
              </div>
              <button
                type="button"
                onClick={() => setArchived(habit, true)}
                aria-label={`Archive ${habit.name}`}
                className="min-h-11 rounded-xl border border-line px-3 text-sm"
              >
                Archive
              </button>
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={handleAdd} className={`space-y-4 ${card}`}>
        <h2 className="font-semibold">Add a habit</h2>
        <div>
          <label htmlFor="habit-name" className={label}>
            Name
          </label>
          <input
            id="habit-name"
            required
            maxLength={HABIT_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Drink water"
            className={input}
          />
        </div>

        <fieldset>
          <legend className={label}>Type</legend>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {TYPES.map((option) => (
              <button
                key={option.type}
                type="button"
                aria-pressed={type === option.type}
                onClick={() => setType(option.type)}
                className="min-h-16 rounded-xl border border-line px-2 text-sm font-medium aria-pressed:border-accent aria-pressed:bg-accent-soft"
              >
                {option.title}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">e.g. {TYPES.find((t) => t.type === type)?.example}</p>
        </fieldset>

        {type !== "checkbox" && (
          <div>
            <label htmlFor="habit-target" className={label}>
              Daily goal <span className="font-normal text-muted">(optional{type === "minutes" ? ", in minutes" : ""})</span>
            </label>
            <input
              id="habit-target"
              type="number"
              inputMode="numeric"
              min={1}
              max={habitValueMax(type)}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={type === "minutes" ? "20" : "8"}
              className={input}
            />
          </div>
        )}

        <div>
          <label htmlFor="habit-icon" className={label}>
            Icon <span className="font-normal text-muted">(optional, one emoji)</span>
          </label>
          <input
            id="habit-icon"
            maxLength={16}
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="💧"
            className={`${input} w-24`}
          />
        </div>

        <button type="submit" disabled={busy} className={buttonPrimary}>
          {busy ? "Adding..." : "Add habit"}
        </button>
      </form>

      {archived.length > 0 && (
        <details className={card}>
          {/* <details> is a built-in "click to open" box: no JavaScript needed. */}
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">Archived ({archived.length})</summary>
          <ul className="mt-2 space-y-2">
            {archived.map((habit) => (
              <li key={habit.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-muted">{habit.name}</span>
                <button
                  type="button"
                  onClick={() => setArchived(habit, false)}
                  aria-label={`Restore ${habit.name}`}
                  className={`${buttonSecondary} w-auto`}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Link href="/checkin" className={`inline-block min-h-11 py-3 ${link}`}>
        Back to today&apos;s check-in
      </Link>
    </div>
  );
}
