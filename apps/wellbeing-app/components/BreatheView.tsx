"use client";
// The /breathe page: pick 4-7-8 or box breathing, press Start, follow the
// circle. It grows while you breathe in, stays while you hold, and shrinks
// while you breathe out.
//
// All the timing is in lib/breathing.ts (tested). This screen asks for the
// real time 10 times a second, and breathingState() says which phase we're in.
//
// The animation itself is done by the browser with a CSS transition (see
// .breath-circle in app/globals.css): when a phase starts we set the circle's
// TARGET size and how long it should take to get there (the phase length),
// and the browser draws the smooth growing. If the phone is set to "reduce
// motion", the CSS turns the movement off and the words and countdown guide you.

import Link from "next/link";
import { useEffect, useState } from "react";
import { breathingState, formatClock, PATTERNS, SCALE_EMPTY, totalMs, type PatternId } from "@/lib/breathing";
import { buttonPrimary, buttonSecondary, card, link } from "./ui";

const PATTERN_IDS = Object.keys(PATTERNS) as PatternId[];

export function BreatheView() {
  const [patternId, setPatternId] = useState<PatternId>("4-7-8");
  // When Start was pressed (performance.now() milliseconds), or null = not started.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  const pattern = PATTERNS[patternId];
  const state = startedAt === null ? null : breathingState(pattern, now - startedAt);
  const running = state !== null && !state.done;

  // While running, read the clock 10 times a second. performance.now() is a
  // clock made for measuring time: it never jumps if the phone changes its time.
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(timer); // stops when done, stopped, or leaving the page
  }, [running]);

  function start() {
    const t = performance.now();
    setStartedAt(t);
    setNow(t);
  }

  function stop() {
    setStartedAt(null);
  }

  function choose(id: PatternId) {
    setPatternId(id);
    stop(); // switching in the middle would be confusing: start again
  }

  // CSS variables read by .breath-circle in globals.css.
  const circleStyle = {
    "--breath-scale": running ? state.targetScale : SCALE_EMPTY,
    // Idle: shrink back gently. Running: take the whole phase to get there.
    "--breath-duration": running ? `${state.phase.seconds}s` : "0.6s",
  } as React.CSSProperties;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Breathe</h1>
        <p className="mt-1 text-sm text-muted">A minute or two of slow breathing. Sit comfortably and follow the circle.</p>
      </header>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Breathing pattern">
        {PATTERN_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={patternId === id}
            onClick={() => choose(id)}
            className="min-h-12 rounded-xl border border-line px-3 text-base font-medium aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink"
          >
            {PATTERNS[id].name}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">
        {pattern.description} {pattern.rounds} rounds, {formatClock(totalMs(pattern) / 1000)}.
      </p>

      <div className={`${card} flex flex-col items-center`}>
        {/* The circle and the words on top of it. The words are NOT inside the
            circle, so they don't grow and shrink with it. */}
        <div className="relative flex h-64 w-64 items-center justify-center">
          <div aria-hidden="true" className="breath-circle absolute inset-0 rounded-full border-2 border-accent bg-accent/20" style={circleStyle} />
          <div className="relative text-center">
            {/* aria-live: screen readers announce each new phase ("Hold"),
                but not the countdown, which would be every second. */}
            <p aria-live="polite" className="text-xl font-semibold">
              {state === null ? "Ready" : state.done ? "Well done" : state.phase.label}
            </p>
            {running && (
              <p aria-hidden="true" className="mt-1 text-4xl font-semibold tabular-nums">
                {state.secondsLeft}
              </p>
            )}
          </div>
        </div>

        <p className="mt-4 min-h-5 text-sm text-muted tabular-nums">
          {running && `Round ${state.round} of ${pattern.rounds} · ${formatClock(state.totalSecondsLeft)} left`}
          {state?.done && "Notice how you feel now."}
        </p>
      </div>

      {running ? (
        <button type="button" onClick={stop} className={buttonSecondary}>
          Stop
        </button>
      ) : (
        <button type="button" onClick={start} className={buttonPrimary}>
          {state?.done ? "Again" : "Start"}
        </button>
      )}

      <p className="text-xs text-muted">
        Feeling dizzy? Stop and breathe normally. This is a relaxation exercise, not medical advice.{" "}
        <Link href="/" className={link}>
          Back home
        </Link>
      </p>
    </div>
  );
}
