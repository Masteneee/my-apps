"use client";
// The progress tracker on an item page: change the status, type how far you
// are, or press the quick "+1 ep" button (saved right away, like on AniList).
// The rules (24/24 = finished, "Want to watch" + progress = "Watching"...) are in
// planLogUpdate() in lib/media/validation.ts; the store applies them and saves.

import { useState } from "react";
import { getMediaStore, type LogWithMedia } from "@/lib/media";
import { statusLabel, wordsFor } from "@/lib/media/display";
import {
  defaultProgressUnit,
  formatProgress,
  incrementProgress,
  parseProgressText,
  progressFieldLabel,
  progressPercent,
  stepLabel,
} from "@/lib/media/progress";
import { LOG_STATUSES, type LogStatus, type LogUpdateInput, type ProgressUnit } from "@/lib/media/types";
import { ProgressBar } from "./ProgressBar";
import { ProgressField } from "./ProgressField";

type Props = {
  log: LogWithMedia;
  onUpdated: (log: LogWithMedia) => void;
};

export function ProgressTracker({ log, onUpdated }: Props) {
  const { media } = log;
  // The form starts from the saved log. (The parent gives this component a
  // `key` with the log id, so another log gets a fresh form.)
  const [status, setStatus] = useState<LogStatus>(log.status);
  const [progressText, setProgressText] = useState(log.progress === null ? "" : String(log.progress));
  const [unit, setUnit] = useState<ProgressUnit | null>(log.progress_unit ?? defaultProgressUnit(media.type));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const words = wordsFor(media.type);
  const savedUnit = log.progress_unit ?? unit;
  const savedText = formatProgress(log.progress, log.progress_unit, media.total_units);
  const percent = progressPercent(log.progress, log.progress_unit, media.total_units);
  // The quick button: only while you're in the middle of it, and not past the end.
  const canStep =
    savedUnit !== null &&
    log.status !== "completed" &&
    incrementProgress(log.progress, savedUnit, media.total_units) !== (log.progress ?? 0);

  async function save(change: LogUpdateInput) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const updated = await getMediaStore().updateLog(log.id, change);
      // Show what was really saved (the rules may have changed the status).
      setStatus(updated.status);
      setProgressText(updated.progress === null ? "" : String(updated.progress));
      if (updated.status !== change.status) {
        setNote(`Marked as “${statusLabel(updated.status, media.type)}”.`);
      }
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your progress.");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save({ status, progress: unit ? parseProgressText(progressText) : null, progressUnit: unit });
  }

  function handleStep() {
    if (!savedUnit) return;
    // Starts from the SAVED progress, not from whatever is typed in the box.
    save({
      status: log.status,
      progress: incrementProgress(log.progress, savedUnit, media.total_units),
      progressUnit: savedUnit,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {savedText && (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-medium">{savedText}</p>
            {canStep && savedUnit && (
              <button
                type="button"
                onClick={handleStep}
                disabled={busy}
                className="rounded-md bg-violet-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-60"
              >
                {stepLabel(savedUnit)}
              </button>
            )}
          </div>
          <div className="mt-2">
            <ProgressBar percent={percent} label={`Progress on ${media.title}`} />
          </div>
        </div>
      )}
      {/* No progress saved yet: still offer the quick button to start. */}
      {!savedText && canStep && savedUnit && (
        <button
          type="button"
          onClick={handleStep}
          disabled={busy}
          className="rounded-md bg-violet-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-60"
        >
          Start: {stepLabel(savedUnit)}
        </button>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tracker-status" className="block text-sm font-medium text-zinc-300">
            Status
          </label>
          <select
            id="tracker-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as LogStatus)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-violet-400"
          >
            {LOG_STATUSES.map((value) => (
              <option key={value} value={value}>
                {words.statuses[value]}
              </option>
            ))}
          </select>
        </div>
        {unit && (
          <ProgressField
            id="tracker-progress"
            label={progressFieldLabel(media.type)}
            type={media.type}
            totalUnits={media.total_units}
            value={progressText}
            unit={unit}
            onValueChange={setProgressText}
            onUnitChange={setUnit}
          />
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <div aria-live="polite">{note && <p className="text-sm text-emerald-300">{note}</p>}</div>

      <button
        type="submit"
        disabled={busy}
        className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-800 disabled:opacity-60"
      >
        {busy ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
