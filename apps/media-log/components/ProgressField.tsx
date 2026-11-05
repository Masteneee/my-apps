"use client";
// The "how far are you?" input, shared by the log form and the progress
// tracker: a number box, "of 24" (or "of ?"), and for books a pages/percent
// switch. It only shows and reports text; the rules live in lib/media/progress.ts.

import { progressUnitsFor, UNIT_LABELS } from "@/lib/media/progress";
import type { MediaType, ProgressUnit } from "@/lib/media/types";

type Props = {
  id: string; // for the <label htmlFor>, so clicking the label focuses the box
  label: string;
  type: MediaType;
  totalUnits: number | null;
  /** The text in the box. A string (not a number) so the box can be empty. */
  value: string;
  unit: ProgressUnit;
  onValueChange: (value: string) => void;
  onUnitChange: (unit: ProgressUnit) => void;
};

export function ProgressField({ id, label, type, totalUnits, value, unit, onValueChange, onUnitChange }: Props) {
  const units = progressUnitsFor(type);
  // "of 24" for parts we can count; nothing for percent and hours.
  const outOf = unit === "percent" ? "%" : unit === "hour" ? "hours" : `of ${totalUnits ?? "?"} ${UNIT_LABELS[unit].many}`;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-300">
        {label} <span className="text-zinc-500">(optional)</span>
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal" // phones show a number keyboard
          min={0}
          max={unit === "percent" ? 100 : (totalUnits ?? undefined)}
          step={unit === "hour" ? 0.1 : 1}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className="w-24 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-violet-400"
        />
        {units.length > 1 ? (
          // Books: pick pages or percent. The <select> has its own (hidden) label for screen readers.
          <>
            <label htmlFor={`${id}-unit`} className="sr-only">
              Count in
            </label>
            <select
              id={`${id}-unit`}
              value={unit}
              onChange={(e) => onUnitChange(e.target.value as ProgressUnit)}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm outline-none focus:border-violet-400"
            >
              {units.map((option) => (
                <option key={option} value={option}>
                  {option === "percent" ? "%" : `of ${totalUnits ?? "?"} ${UNIT_LABELS[option].many}`}
                </option>
              ))}
            </select>
          </>
        ) : (
          <span className="text-sm text-zinc-400">{outOf}</span>
        )}
      </div>
    </div>
  );
}
