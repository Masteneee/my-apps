"use client";
// "Your data" on the profile page: download everything you saved, as JSON or
// CSV. The files are built by pure functions in lib/export.ts (tested); this
// file asks the store for your data and hands the file to the browser.
//
// How a "download" works without a server: we put the text in a Blob (a chunk
// of data held in the browser's memory), make a temporary blob: address for
// it, and click an invisible <a download="..."> link pointing at it. The
// browser saves it like any downloaded file. Nothing is uploaded anywhere.

import Link from "next/link";
import { useState } from "react";
import { getCheckinStore } from "@/lib/checkin";
import { browserTimeZone, todayKey } from "@/lib/checkin/date";
import { buildExport, EXPORT_RANGE, exportFileName, exportToCsv, exportToJson } from "@/lib/export";
import { useAuth } from "./AuthProvider";
import { buttonSecondary, card, link } from "./ui";

type Format = "json" | "csv";

/** Saves `text` as a file called `fileName` (the browser's normal download). */
function downloadText(text: string, fileName: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a); // Firefox only clicks links that are on the page
  a.click();
  a.remove();
  // Free the memory once the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportCard() {
  const { user, profile } = useAuth();
  const [busy, setBusy] = useState<Format | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function download(format: Format) {
    if (!user) return;
    setBusy(format);
    setMessage(null);
    try {
      const store = getCheckinStore();
      // One after the other: the first call also sends anything waiting from offline.
      const checkins = await store.listCheckins(EXPORT_RANGE.from, EXPORT_RANGE.to);
      const habitEntries = await store.listHabitEntries(EXPORT_RANGE.from, EXPORT_RANGE.to);
      const habits = await store.listHabits({ includeArchived: true }); // archived ones are yours too
      const data = buildExport({
        account: {
          id: user.id,
          email: user.email,
          username: profile?.username ?? null,
          display_name: profile?.display_name ?? null,
        },
        habits,
        checkins,
        habitEntries,
        exportedAt: new Date(),
        timeZone: browserTimeZone(),
      });
      const today = todayKey();
      if (format === "json") downloadText(exportToJson(data), exportFileName(today, "json"), "application/json");
      else downloadText(exportToCsv(data), exportFileName(today, "csv"), "text/csv;charset=utf-8");
      const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
      const checkinText = count(data.checkins.length, "check-in", "check-ins");
      const entryText = count(data.habit_entries.length, "habit entry", "habit entries");
      setMessage(`Downloaded: ${checkinText}, ${entryText}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't make the file. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={card} aria-labelledby="your-data">
      <h2 id="your-data" className="font-semibold">
        Your data
      </h2>
      <p className="mt-1 text-sm text-muted">
        Download everything you saved: check-ins (journal included), habits and habit entries. Only you can do this.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => download("json")} disabled={busy !== null} className={buttonSecondary}>
          {busy === "json" ? "Preparing..." : "Download JSON"}
        </button>
        <button type="button" onClick={() => download("csv")} disabled={busy !== null} className={buttonSecondary}>
          {busy === "csv" ? "Preparing..." : "Download CSV"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        JSON: everything, for a backup. CSV: one row per day, opens in Excel or Google Sheets.
      </p>
      {/* aria-live: a screen reader reads the result when it appears. */}
      <p aria-live="polite" className="mt-2 text-sm">
        {message}
      </p>
      <Link href="/privacy" className={`${link} inline-flex min-h-11 items-center text-sm`}>
        Privacy: what&apos;s stored and who sees it
      </Link>
    </section>
  );
}
