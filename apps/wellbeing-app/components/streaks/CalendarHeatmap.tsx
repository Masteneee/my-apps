// Draws a calendar heatmap from the grid built by lib/calendar.ts (that's
// where the logic and the tests are; this file only draws).
//
// It's an HTML <table>: rows are weeks, columns are weekdays. A table is the
// right element for a calendar: screen readers can say "Thursday, row 12".
// Each square also has a hidden sentence ("Nov 5: Good") for them.
//
// No "use client" here: it has no state or effects. It runs wherever the
// component that uses it runs (here, in the browser, inside StreaksView).

import type { CalendarCell, CalendarGrid } from "@/lib/calendar";
import { shortDate } from "@/lib/calendar";

// Full class names written out: Tailwind only finds classes that appear
// whole in the code, so `bg-accent/${n}` built at runtime would get no CSS.
// The /15, /30 ... is the opacity of the accent colour (darker = more).
const MOOD_COLOURS: Record<number, string> = {
  1: "bg-accent/15",
  2: "bg-accent/30",
  3: "bg-accent/50",
  4: "bg-accent/75 text-accent-ink",
  5: "bg-accent text-accent-ink",
};
const HABIT_COLOURS: Record<number, string> = {
  1: "bg-accent/20",
  2: "bg-accent/40",
  3: "bg-accent/60 text-accent-ink",
  4: "bg-accent text-accent-ink",
};

export type HeatmapKind = "mood" | "habit";

type Props = {
  grid: CalendarGrid;
  kind: HeatmapKind;
  /** Read aloud by screen readers, e.g. "Mood calendar, last 12 weeks". */
  caption: string;
  /** What a coloured day means, in words: describeLevel(4) -> "Good". */
  describeLevel: (level: number) => string;
};

export function CalendarHeatmap({ grid, kind, caption, describeLevel }: Props) {
  const colours = kind === "mood" ? MOOD_COLOURS : HABIT_COLOURS;

  function cellLabel(cell: CalendarCell): string {
    const day = shortDate(cell.date) + (cell.isToday ? " (today)" : "");
    if (cell.future) return `${day}: not yet`;
    if (cell.frozen) return `${day}: missed, saved by a streak freeze`;
    if (cell.level === null) return `${day}: ${kind === "mood" ? "no mood" : "not done"}`;
    return `${day}: ${describeLevel(cell.level)}`;
  }

  function cellClass(cell: CalendarCell): string {
    const base = "flex aspect-square w-full items-center justify-center rounded-md text-[11px] leading-none";
    if (cell.future) return `${base} text-muted/40`;
    const today = cell.isToday ? " ring-2 ring-ink ring-offset-1 ring-offset-card" : "";
    if (cell.frozen) return `${base} border border-dashed border-accent text-accent${today}`;
    if (cell.level === null) return `${base} border border-line text-muted${today}`;
    return `${base} ${colours[cell.level] ?? colours[1]}${today}`;
  }

  return (
    <table className="w-full table-fixed border-separate border-spacing-1">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {/* The first column holds month names ("Nov"). */}
          <th scope="col" className="w-9">
            <span className="sr-only">Month</span>
          </th>
          {grid.weekdayLabels.map((label) => (
            <th key={label} scope="col" className="text-[11px] font-normal text-muted">
              {/* "M", "T"... on screen; the full short name for screen readers. */}
              <span aria-hidden="true">{label[0]}</span>
              <span className="sr-only">{label}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grid.weeks.map((week) => (
          <tr key={week.start}>
            <th scope="row" className="text-left text-[11px] font-normal text-muted">
              {week.monthLabel ?? <span className="sr-only">Week of {shortDate(week.start)}</span>}
            </th>
            {week.days.map((cell) => (
              <td key={cell.date} className="p-0">
                <div className={cellClass(cell)} title={cellLabel(cell)}>
                  <span aria-hidden="true">{cell.frozen ? "❄" : cell.dayOfMonth}</span>
                  <span className="sr-only">{cellLabel(cell)}</span>
                </div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The little key under the calendar: "less ▢▢▢▢ more". */
export function HeatmapLegend({ kind, describeLevel }: Pick<Props, "kind" | "describeLevel">) {
  const colours = kind === "mood" ? MOOD_COLOURS : HABIT_COLOURS;
  const levels = Object.keys(colours).map(Number);
  return (
    <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted" aria-label="Colour key">
      {levels.map((level) => (
        <li key={level} className="flex items-center gap-1">
          <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-sm ${colours[level]}`} />
          {describeLevel(level)}
        </li>
      ))}
      {kind === "habit" && (
        <li className="flex items-center gap-1">
          <span aria-hidden="true" className="inline-flex h-3 w-3 items-center justify-center rounded-sm border border-dashed border-accent text-[8px] text-accent">
            ❄
          </span>
          Freeze
        </li>
      )}
    </ul>
  );
}
