"use client";
// The check-in flow: one step at a time, mood → screen time → gratitude →
// journal → habits → done. Every step can be skipped, and every answer is
// saved as you go (useCheckinSaver), so stopping halfway keeps what you did.

import Link from "next/link";
import { useState } from "react";
import type { Checkin, Habit, HabitEntry } from "@/lib/checkin";
import { formatDateKey } from "@/lib/checkin/date";
import { fieldsOf } from "@/lib/checkin/merge";
import { answeredCount, isStepAnswered, moodFor, STEPS } from "@/lib/checkin/steps";
import { buttonPrimary, buttonSecondary, card, link } from "../ui";
import { useOnline } from "../useOnline";
import { GratitudeStep, HabitsStep, JournalStep, MoodStep, ScreenTimeStep } from "./CheckinSteps";
import { useCheckinSaver, type SaveStatus } from "./useCheckinSaver";

// Typing is saved this long after the last key press (taps are saved at once).
const TYPING_DELAY_MS = 800;

/** entries list -> { habitId: value }, easier to look up while drawing. */
function valuesByHabit(entries: HabitEntry[]): Record<string, number> {
  return Object.fromEntries(entries.map((entry) => [entry.habit_id, entry.value]));
}

export function CheckinFlow({
  date,
  checkin,
  entries,
  habits,
}: {
  date: string;
  checkin: Checkin | null;
  entries: HabitEntry[];
  habits: Habit[];
}) {
  // Always opens on the first step. Answers you already gave today are filled in.
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState(() => valuesByHabit(entries));
  const { draft, change, saveNow, saveHabit, status, error } = useCheckinSaver(date, fieldsOf(checkin));

  const isDone = stepIndex >= STEPS.length;
  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  const habitsDone = habits.filter((habit) => (values[habit.id] ?? 0) > 0).length;
  const answered = !isDone && isStepAnswered(step.id, draft, habitsDone);

  function goTo(index: number) {
    void saveNow(); // send what's typed before the screen changes
    setStepIndex(index);
    window.scrollTo({ top: 0 });
  }

  function setHabitValue(habit: Habit, value: number | null) {
    setValues((old) => ({ ...old, [habit.id]: value ?? 0 }));
    void saveHabit(habit, value);
  }

  return (
    <div className="space-y-6 pb-28">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">{formatDateKey(date)}</p>
          <SaveNote status={status} />
        </div>
        <StepDots current={stepIndex} onPick={goTo} isAnswered={(id) => isStepAnswered(id, draft, habitsDone)} />
      </header>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {isDone ? (
        <DoneScreen
          moodValue={draft.mood}
          count={answeredCount(draft, habitsDone)}
          habitsDone={habitsDone}
          habitsTotal={habits.length}
          onEdit={() => goTo(0)}
        />
      ) : (
        <section aria-labelledby="step-title">
          <h1 id="step-title" className="mb-5 text-2xl font-semibold">
            {step.title}
          </h1>

          {step.id === "mood" && (
            <MoodStep
              mood={draft.mood}
              tags={draft.mood_tags}
              onMood={(mood) => change({ mood })}
              onTags={(mood_tags) => change({ mood_tags })}
            />
          )}
          {step.id === "screen" && (
            <ScreenTimeStep
              minutes={draft.screen_time_minutes}
              onChange={(screen_time_minutes) => change({ screen_time_minutes })}
            />
          )}
          {step.id === "gratitude" && (
            <GratitudeStep lines={draft.gratitude} onChange={(gratitude) => change({ gratitude }, TYPING_DELAY_MS)} />
          )}
          {step.id === "journal" && (
            <JournalStep
              text={draft.journal_text ?? ""}
              onChange={(journal_text) => change({ journal_text }, TYPING_DELAY_MS)}
            />
          )}
          {step.id === "habits" && <HabitsStep habits={habits} values={values} onChange={setHabitValue} />}
        </section>
      )}

      {!isDone && (
        // Stuck to the bottom of the screen, where thumbs are. The padding
        // keeps it above the iPhone's home bar when installed.
        <nav
          aria-label="Check-in steps"
          className="fixed inset-x-0 bottom-0 border-t border-line bg-page/95 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur"
        >
          <div className="mx-auto flex max-w-md gap-3 px-5">
            {stepIndex > 0 && (
              <button type="button" onClick={() => goTo(stepIndex - 1)} className={`${buttonSecondary} w-1/3`}>
                Back
              </button>
            )}
            <button type="button" onClick={() => goTo(stepIndex + 1)} className={buttonPrimary}>
              {stepIndex === STEPS.length - 1 ? "Finish" : answered ? "Next" : "Skip"}
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

/** Five dots, one per step. Filled = answered. You can tap one to jump there. */
function StepDots({
  current,
  onPick,
  isAnswered,
}: {
  current: number;
  onPick: (index: number) => void;
  isAnswered: (id: (typeof STEPS)[number]["id"]) => boolean;
}) {
  return (
    <ol className="flex gap-2">
      {STEPS.map((step, index) => (
        <li key={step.id} className="flex-1">
          <button
            type="button"
            onClick={() => onPick(index)}
            aria-label={`Step ${index + 1}: ${step.title}${isAnswered(step.id) ? " (answered)" : ""}`}
            aria-current={index === current ? "step" : undefined}
            // The visible bar is thin, but the button around it is 44px tall (easy to tap).
            className="flex h-11 w-full items-center"
          >
            <span
              className={`h-1.5 w-full rounded-full ${
                index === current ? "bg-accent" : isAnswered(step.id) ? "bg-accent/50" : "bg-line"
              }`}
            />
          </button>
        </li>
      ))}
    </ol>
  );
}

/** "Saved", "Saving...", or "Saved on this device" when offline. */
function SaveNote({ status }: { status: SaveStatus }) {
  const online = useOnline();
  const text: Record<SaveStatus, string> = {
    idle: online ? "" : "Offline",
    saving: "Saving...",
    saved: "Saved",
    waiting: "Saved on this device, will sync when online",
    error: "Not saved",
  };
  // aria-live: screen readers read it out when it changes.
  return (
    <p aria-live="polite" className="text-right text-xs text-muted">
      {text[status]}
    </p>
  );
}

function DoneScreen({
  moodValue,
  count,
  habitsDone,
  habitsTotal,
  onEdit,
}: {
  moodValue: number | null;
  count: number;
  habitsDone: number;
  habitsTotal: number;
  onEdit: () => void;
}) {
  const mood = moodFor(moodValue);
  return (
    <section className="space-y-5">
      <div className={`${card} text-center`}>
        <p aria-hidden="true" className="text-5xl">
          {mood ? mood.emoji : "🌱"}
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Checked in</h1>
        <p className="mt-1 text-muted">
          {count} of {STEPS.length} parts answered
          {habitsTotal > 0 && `, ${habitsDone} of ${habitsTotal} habits done`}. Skipped parts are fine.
        </p>
      </div>
      <Link href="/" className={buttonPrimary}>
        Back to today
      </Link>
      <button type="button" onClick={onEdit} className={`${link} block min-h-11 w-full`}>
        Change my answers
      </button>
    </section>
  );
}
