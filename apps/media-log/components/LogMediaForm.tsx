"use client";
// The "log this" form: status, rating, progress (Stage 4), review, finished date, rewatch.
// It works for every media type; only the words change ("Watched" for a
// movie, "Read" for a book, "Finished" for a game), see wordsFor().
// The rules (rating in half steps, no rating for "Want to watch"...) live in
// lib/media/validation.ts; the store checks them and throws a friendly error.

import { useState } from "react";
import { ratingToStars, TYPE_LABELS, unitsLabel, wordsFor } from "@/lib/media/display";
import { getMediaStore, type LogStatus, type LogWithMedia, type MediaResult } from "@/lib/media";
import { defaultProgressUnit, parseProgressText, progressFieldLabel } from "@/lib/media/progress";
import { LOG_STATUSES, type ProgressUnit } from "@/lib/media/types";
import { localToday, RATING_OPTIONS, REVIEW_MAX } from "@/lib/media/validation";
import { Poster } from "./Poster";
import { ProgressField } from "./ProgressField";

type Props = {
  media: MediaResult;
  onSaved: (log: LogWithMedia) => void;
  onCancel: () => void;
  /** The text of the cancel button: "Back to results" on the search page, "Cancel" on an item page. */
  cancelLabel?: string;
};

export function LogMediaForm({ media, onSaved, onCancel, cancelLabel = "Back to results" }: Props) {
  const [status, setStatus] = useState<LogStatus>("completed");
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [finishedAt, setFinishedAt] = useState(() => localToday());
  const [rewatch, setRewatch] = useState(false);
  // Progress is typed as text so the box can be empty ("" = no progress).
  const [progressText, setProgressText] = useState("");
  const [progressUnit, setProgressUnit] = useState<ProgressUnit | null>(() => defaultProgressUnit(media.type));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const words = wordsFor(media.type);
  const finished = status === "completed";
  const canRate = status !== "planned";
  // Progress makes sense once you've started and before you've finished (7/24),
  // and for games also when finished ("finished in 60 hours"). Movies have none.
  const showProgress =
    progressUnit !== null && status !== "planned" && (status !== "completed" || media.type === "game");
  const details = [media.creators.join(", "), unitsLabel(media.type, media.totalUnits)].filter(Boolean).join(" · ");

  function changeStatus(next: LogStatus) {
    setStatus(next);
    // "Want to watch" can't have a rating, so clear it instead of showing an error later.
    if (next === "planned") setRating(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const log = await getMediaStore().addLog({
        media,
        status,
        rating,
        reviewText: review,
        finishedAt: finished && finishedAt ? finishedAt : null,
        rewatch,
        // A hidden progress box is not sent, even if something was typed before.
        progress: showProgress ? parseProgressText(progressText) : null,
        progressUnit,
      });
      onSaved(log);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your log.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <div className="flex gap-4">
        <div className="w-20 shrink-0 sm:w-28">
          <Poster src={media.coverUrl} title={media.title} />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-zinc-400">Log this {TYPE_LABELS[media.type].one.toLowerCase()}</p>
          <h2 className="text-xl font-bold sm:text-2xl">
            {media.title} {media.year && <span className="font-normal text-zinc-400">({media.year})</span>}
          </h2>
          {media.originalTitle && <p className="text-sm text-zinc-500">{media.originalTitle}</p>}
          {details && <p className="mt-1 text-sm text-zinc-400">{details}</p>}
        </div>
      </div>

      {/* fieldset + legend groups the radio buttons under one label for screen readers. */}
      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-zinc-300">Status</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {LOG_STATUSES.map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm has-focus-visible:ring-2 has-focus-visible:ring-violet-400 ${
                status === value
                  ? "border-violet-400 bg-violet-500/20 text-violet-200"
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {/* The real radio is hidden (sr-only) but still works with the keyboard. */}
              <input
                type="radio"
                name="status"
                value={value}
                checked={status === value}
                onChange={() => changeStatus(value)}
                className="sr-only"
              />
              {words.statuses[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="rating" className="block text-sm font-medium text-zinc-300">
            Rating
          </label>
          <select
            id="rating"
            value={rating ?? ""}
            disabled={!canRate}
            // A <select> always gives text: "" means no rating, "3.5" becomes 3.5.
            onChange={(e) => setRating(e.target.value === "" ? null : Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-violet-400 disabled:opacity-50"
          >
            <option value="">No rating</option>
            {RATING_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {ratingToStars(value)} ({value})
              </option>
            ))}
          </select>
          {!canRate && <p className="mt-1 text-xs text-zinc-500">Rate it once you&apos;ve started it.</p>}
        </div>

        {finished && (
          <div>
            <label htmlFor="finished-at" className="block text-sm font-medium text-zinc-300">
              {words.finishedOn} <span className="text-zinc-500">(optional)</span>
            </label>
            <input
              id="finished-at"
              type="date"
              value={finishedAt}
              max={localToday()} // the date picker won't offer future days
              onChange={(e) => setFinishedAt(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-violet-400"
            />
          </div>
        )}
      </div>

      {showProgress && progressUnit && (
        <div className="mt-5">
          <ProgressField
            id="progress"
            label={progressFieldLabel(media.type)}
            type={media.type}
            totalUnits={media.totalUnits}
            value={progressText}
            unit={progressUnit}
            onValueChange={setProgressText}
            onUnitChange={setProgressUnit}
          />
        </div>
      )}

      {finished && (
        <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={rewatch}
            onChange={(e) => setRewatch(e.target.checked)}
            className="h-4 w-4 accent-violet-500"
          />
          {words.again}
        </label>
      )}

      <div className="mt-5">
        <label htmlFor="review" className="block text-sm font-medium text-zinc-300">
          Review <span className="text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="review"
          rows={4}
          maxLength={REVIEW_MAX}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="What did you think?"
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none placeholder:text-zinc-600 focus:border-violet-400"
        />
        <p className="mt-1 text-right text-xs text-zinc-500">
          {review.length}/{REVIEW_MAX}
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-700 px-4 py-2.5 font-medium hover:bg-zinc-800"
        >
          {cancelLabel}
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-violet-500 px-5 py-2.5 font-medium text-white hover:bg-violet-400 disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save to my log"}
        </button>
      </div>
    </form>
  );
}
