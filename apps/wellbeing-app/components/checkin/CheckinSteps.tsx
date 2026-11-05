"use client";
// The five screens of the check-in. They only DRAW things and report taps
// (onChange...). Saving is done by CheckinFlow + useCheckinSaver.
// Big tap targets everywhere: min-h-12 (48px) or more.

import Link from "next/link";
import { addMinutes, formatMinutes, MOOD_TAGS, MOODS } from "@/lib/checkin/steps";
import { GRATITUDE_MAX, habitValueMax, JOURNAL_MAX, MOOD_TAGS_MAX } from "@/lib/checkin/validation";
import type { Habit } from "@/lib/checkin";
import { buttonSecondary, card, input, link } from "../ui";

// A round "chip" button that shows if it's picked (aria-pressed tells screen readers too).
const chip =
  "min-h-11 rounded-full border px-4 text-sm font-medium transition disabled:opacity-40 aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink border-line";

// ---------------------------------------------------------------------------
// 1. Mood
// ---------------------------------------------------------------------------
export function MoodStep({
  mood,
  tags,
  onMood,
  onTags,
}: {
  mood: number | null;
  tags: string[];
  onMood: (mood: number | null) => void;
  onTags: (tags: string[]) => void;
}) {
  function toggleTag(tag: string) {
    onTags(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  }

  return (
    <div className="space-y-6">
      {/* role="group" + aria-label: screen readers announce these 5 buttons as one question. */}
      <div role="group" aria-label="Mood" className="grid grid-cols-5 gap-2">
        {MOODS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mood === option.value}
            // Tapping your current mood again un-picks it.
            onClick={() => onMood(mood === option.value ? null : option.value)}
            className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-card transition aria-pressed:border-accent aria-pressed:bg-accent-soft"
          >
            <span aria-hidden="true" className="text-3xl">
              {option.emoji}
            </span>
            <span className="text-xs font-medium">{option.label}</span>
          </button>
        ))}
      </div>

      <div>
        <p className="mb-3 text-sm text-muted">Any words for it? (optional, up to {MOOD_TAGS_MAX})</p>
        <div role="group" aria-label="Mood words" className="flex flex-wrap gap-2">
          {MOOD_TAGS.map((tag) => {
            const picked = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={picked}
                disabled={!picked && tags.length >= MOOD_TAGS_MAX}
                onClick={() => toggleTag(tag)}
                className={chip}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Screen time
// ---------------------------------------------------------------------------
const PRESETS = [30, 60, 120, 180, 240, 360];

export function ScreenTimeStep({
  minutes,
  onChange,
}: {
  minutes: number | null;
  onChange: (minutes: number | null) => void;
}) {
  return (
    <div className="space-y-6">
      <p className="text-center text-4xl font-semibold" aria-live="polite">
        {formatMinutes(minutes)}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => onChange(addMinutes(minutes, -15))} className={buttonSecondary}>
          − 15 min
        </button>
        <button type="button" onClick={() => onChange(addMinutes(minutes, 15))} className={buttonSecondary}>
          + 15 min
        </button>
      </div>

      <div role="group" aria-label="Quick picks" className="grid grid-cols-3 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={minutes === preset}
            onClick={() => onChange(preset)}
            className={`${chip} rounded-xl`}
          >
            {formatMinutes(preset)}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted">
        Not sure? iPhone: Settings &gt; Screen Time. Android: Settings &gt; Digital Wellbeing.
      </p>
      {minutes !== null && (
        <button type="button" onClick={() => onChange(null)} className={`${link} min-h-11`}>
          Clear
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Three gratitudes
// ---------------------------------------------------------------------------
const GRATITUDE_EXAMPLES = ["A warm coffee", "A text from a friend", "Finishing my lab report"];

export function GratitudeStep({ lines, onChange }: { lines: string[]; onChange: (lines: string[]) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Small things count. One is fine too.</p>
      {lines.map((line, index) => (
        <div key={index}>
          <label htmlFor={`gratitude-${index}`} className="text-sm font-medium">
            {index + 1}.
          </label>
          <input
            id={`gratitude-${index}`}
            value={line}
            maxLength={GRATITUDE_MAX}
            placeholder={GRATITUDE_EXAMPLES[index]}
            // "next" shows a "Next" key on phone keyboards instead of "Return".
            enterKeyHint={index < lines.length - 1 ? "next" : "done"}
            onChange={(e) => onChange(lines.map((old, i) => (i === index ? e.target.value : old)))}
            className={input}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Short journal
// ---------------------------------------------------------------------------
export function JournalStep({ text, onChange }: { text: string; onChange: (text: string) => void }) {
  return (
    <div className="space-y-2">
      <label htmlFor="journal" className="text-sm text-muted">
        What happened, how you felt, what&apos;s on your mind. A sentence is enough.
      </label>
      <textarea
        id="journal"
        value={text}
        rows={7}
        maxLength={JOURNAL_MAX}
        onChange={(e) => onChange(e.target.value)}
        className={`${input} py-3 leading-relaxed`}
      />
      <div className="flex justify-between text-xs text-muted">
        <span>🔒 Only you can read this. Friends never see your journal.</span>
        <span>
          {text.length}/{JOURNAL_MAX}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Habits
// ---------------------------------------------------------------------------
export function HabitsStep({
  habits,
  values,
  onChange,
}: {
  habits: Habit[];
  values: Record<string, number>;
  onChange: (habit: Habit, value: number | null) => void;
}) {
  if (habits.length === 0) {
    return (
      <div className={card}>
        <p>No habits yet. Add a few small things you want to do most days (drink water, stretch, read).</p>
        <Link href="/habits" className={`mt-4 ${buttonSecondary}`}>
          Add habits
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {habits.map((habit) => (
        <HabitRow key={habit.id} habit={habit} value={values[habit.id] ?? 0} onChange={onChange} />
      ))}
      <Link href="/habits" className={`inline-block min-h-11 py-3 ${link}`}>
        Add or archive habits
      </Link>
    </div>
  );
}

function HabitRow({
  habit,
  value,
  onChange,
}: {
  habit: Habit;
  value: number;
  onChange: (habit: Habit, value: number | null) => void;
}) {
  const name = (
    <span className="min-w-0 flex-1 truncate text-left font-medium">
      {habit.icon && <span aria-hidden="true">{habit.icon} </span>}
      {habit.name}
    </span>
  );

  if (habit.type === "checkbox") {
    const done = value > 0;
    // The whole row is one big button: easy to hit with a thumb.
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        onClick={() => onChange(habit, done ? null : 1)}
        className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border px-4 transition ${
          done ? "border-accent bg-accent-soft" : "border-line bg-card"
        }`}
      >
        {name}
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
            done ? "border-accent bg-accent text-accent-ink" : "border-line"
          }`}
        >
          {done ? "✓" : ""}
        </span>
      </button>
    );
  }

  // number / minutes: a − / + stepper with the amount in the middle.
  const step = habit.type === "minutes" ? 5 : 1;
  const max = habitValueMax(habit.type);
  const unit = habit.type === "minutes" ? " min" : "";
  const set = (next: number) => onChange(habit, Math.min(max, Math.max(0, next)) || null);
  const reached = habit.target !== null && value >= habit.target;

  return (
    <div className={`rounded-2xl border px-4 py-3 ${reached ? "border-accent bg-accent-soft" : "border-line bg-card"}`}>
      <div className="flex items-center gap-3">
        {name}
        {habit.target !== null && (
          <span className="text-sm text-muted">
            goal {habit.target}
            {unit}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          aria-label={`${habit.name}: less`}
          onClick={() => set(value - step)}
          className="h-12 w-14 rounded-xl border border-line text-xl"
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          aria-label={`${habit.name}${unit ? " in minutes" : ""}`}
          value={value === 0 ? "" : value}
          placeholder="0"
          onChange={(e) => set(Number.parseInt(e.target.value, 10) || 0)}
          className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-page text-center text-lg outline-none focus:border-accent"
        />
        <button
          type="button"
          aria-label={`${habit.name}: more`}
          onClick={() => set(value + step)}
          className="h-12 w-14 rounded-xl border border-line text-xl"
        >
          +
        </button>
      </div>
    </div>
  );
}
