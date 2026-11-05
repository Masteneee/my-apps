"use client";
// "Save as you go" for the check-in. The screens call:
// - change({ mood: 4 })          a tap: saved right away
// - change({ journal_text }, 800) typing: saved 0.8 s after you stop
// - saveHabit(habit, value)      a habit tick or amount
// - saveNow()                    before moving to another step
// It also saves when the app goes to the background or you leave the page,
// so closing the app halfway never loses what you typed.
//
// How it avoids sending everything every time: it remembers what the store
// already has (savedRef) and only sends the difference (diffCheckin).
// How it keeps saves in order: every save waits for the previous one (chainRef).

import { useCallback, useEffect, useRef, useState } from "react";
import { getCheckinStore, type CheckinFields, type CheckinPatch, type Habit } from "@/lib/checkin";
import { diffCheckin } from "@/lib/checkin/merge";

/** idle = nothing to save yet; waiting = saved on this device, will sync when online. */
export type SaveStatus = "idle" | "saving" | "saved" | "waiting" | "error";

export function useCheckinSaver(date: string, initial: CheckinFields) {
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Refs hold values that async code needs to read "right now", without
  // redrawing the screen when they change.
  const draftRef = useRef(initial); // what's on screen
  const savedRef = useRef(initial); // what the store has
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());

  // Runs one save after the previous ones, and shows how it went.
  const queue = useCallback((save: () => Promise<boolean>) => {
    chainRef.current = chainRef.current.then(async () => {
      try {
        const didSave = await save();
        if (!didSave) return;
        const waiting = await getCheckinStore().pendingSyncCount();
        setStatus(waiting > 0 ? "waiting" : "saved");
        setError(null);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      }
    });
    return chainRef.current;
  }, []);

  const saveNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    return queue(async () => {
      const changes = diffCheckin(savedRef.current, draftRef.current);
      if (!changes) return false; // nothing new: no request at all
      setStatus("saving");
      await getCheckinStore().saveCheckin(date, changes);
      savedRef.current = { ...savedRef.current, ...changes };
      return true;
    });
  }, [date, queue]);

  const change = useCallback(
    (patch: CheckinPatch, delayMs = 0) => {
      const next: CheckinFields = { ...draftRef.current, ...patch };
      draftRef.current = next;
      setDraft(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void saveNow(), delayMs);
    },
    [saveNow],
  );

  const saveHabit = useCallback(
    (habit: Habit, value: number | null) =>
      queue(async () => {
        setStatus("saving");
        await getCheckinStore().saveHabitEntry(habit, date, value);
        return true;
      }),
    [date, queue],
  );

  // Save when the app is hidden (phone locked, app switched) or the page closes,
  // and when this component goes away (navigating to another page).
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") void saveNow();
    };
    const onPageHide = () => void saveNow();
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      void saveNow();
    };
  }, [saveNow]);

  // Back online: send what waited on this device.
  useEffect(() => {
    const onOnline = () =>
      void queue(async () => {
        await getCheckinStore().syncPending();
        return true;
      });
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [queue]);

  return { draft, change, saveNow, saveHabit, status, error };
}
