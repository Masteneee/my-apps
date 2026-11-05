// A thin bar that fills up with progress (pure layout). `percent` comes from
// progressPercent() in lib/media/progress.ts; null = unknown, so no bar.

export function ProgressBar({ percent, label }: { percent: number | null; label: string }) {
  if (percent === null) return null;
  return (
    // role="progressbar" + aria-value* let screen readers announce "44 percent".
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
    >
      {/* The inner bar's width is the percent. An inline style because Tailwind can't know the number in advance. */}
      <div className="h-full rounded-full bg-violet-500" style={{ width: `${percent}%` }} />
    </div>
  );
}
