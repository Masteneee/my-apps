// BREATHING EXERCISES: which phase you're in (breathe in / hold / breathe
// out) at any moment. Pure functions, tested in breathing.test.ts. The screen
// (components/BreatheView.tsx) only asks "how long since Start?" and draws
// whatever breathingState() says.
//
// Why work from "time since Start" instead of counting ticks of a timer?
// Browsers slow timers down (a background tab, a busy phone), so a timer that
// says "every second, count down by 1" slowly drifts. Asking the real clock
// and computing the phase from it is always right, even after a hiccup.

export type PhaseKind = "inhale" | "hold" | "exhale";

export type BreathPhase = {
  kind: PhaseKind;
  label: string; // what the screen says
  seconds: number;
};

export type PatternId = "4-7-8" | "box";

export type BreathPattern = {
  id: PatternId;
  name: string;
  description: string;
  phases: BreathPhase[];
  /** How many times the whole pattern repeats. */
  rounds: number;
};

const inhale = (seconds: number): BreathPhase => ({ kind: "inhale", label: "Breathe in", seconds });
const hold = (seconds: number): BreathPhase => ({ kind: "hold", label: "Hold", seconds });
const exhale = (seconds: number): BreathPhase => ({ kind: "exhale", label: "Breathe out", seconds });

export const PATTERNS: Record<PatternId, BreathPattern> = {
  "4-7-8": {
    id: "4-7-8",
    name: "4-7-8",
    description: "In for 4, hold for 7, out slowly for 8. Calming, good before sleep.",
    phases: [inhale(4), hold(7), exhale(8)],
    // 4 rounds is the usual advice when you start (it can make you a bit dizzy at first).
    rounds: 4,
  },
  box: {
    id: "box",
    name: "Box breathing",
    description: "In for 4, hold for 4, out for 4, hold for 4, like the 4 sides of a box. Steadying, good before a test.",
    phases: [inhale(4), hold(4), exhale(4), hold(4)],
    rounds: 6,
  },
};

/** The circle's size, as a share of its full size: small when your lungs are empty, full when they're full. */
export const SCALE_EMPTY = 0.5;
export const SCALE_FULL = 1;

/** Length of one round in milliseconds (19 s for 4-7-8, 16 s for box). */
export function roundMs(pattern: BreathPattern): number {
  return pattern.phases.reduce((total, phase) => total + phase.seconds * 1000, 0);
}

/** Length of the whole exercise in milliseconds. */
export function totalMs(pattern: BreathPattern): number {
  return roundMs(pattern) * pattern.rounds;
}

/** The circle's size at the END of each phase: breathing in fills it, out empties it, holding keeps it. */
export function phaseEndScales(pattern: BreathPattern): number[] {
  let scale = SCALE_EMPTY; // you start with empty lungs
  return pattern.phases.map((phase) => {
    if (phase.kind === "inhale") scale = SCALE_FULL;
    if (phase.kind === "exhale") scale = SCALE_EMPTY;
    return scale;
  });
}

export type BreathState = {
  done: boolean;
  /** 1-based round number ("Round 2 of 4"). */
  round: number;
  phaseIndex: number;
  phase: BreathPhase;
  /** Whole seconds left in this phase, for the countdown (4, 3, 2, 1). 0 when done. */
  secondsLeft: number;
  /** 0 at the start of the phase, close to 1 at its end. */
  progress: number;
  /** Circle size at the start and at the end of this phase. The screen animates from one to the other. */
  startScale: number;
  targetScale: number;
  /** Whole seconds left in the whole exercise. */
  totalSecondsLeft: number;
};

/** Where you are in the exercise, `elapsedMs` milliseconds after pressing Start. */
export function breathingState(pattern: BreathPattern, elapsedMs: number): BreathState {
  const ends = phaseEndScales(pattern);
  const total = totalMs(pattern);
  // Negative or broken (NaN) times count as "just started".
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;

  if (elapsed >= total) {
    const last = pattern.phases.length - 1;
    return {
      done: true,
      round: pattern.rounds,
      phaseIndex: last,
      phase: pattern.phases[last],
      secondsLeft: 0,
      progress: 1,
      startScale: SCALE_EMPTY,
      targetScale: SCALE_EMPTY,
      totalSecondsLeft: 0,
    };
  }

  const round = Math.floor(elapsed / roundMs(pattern)); // 0-based
  let inRound = elapsed - round * roundMs(pattern); // ms since this round started

  // Walk through the phases until we find the one we're in.
  let phaseIndex = 0;
  while (inRound >= pattern.phases[phaseIndex].seconds * 1000) {
    inRound -= pattern.phases[phaseIndex].seconds * 1000;
    phaseIndex += 1;
  }
  const phase = pattern.phases[phaseIndex];
  const phaseMs = phase.seconds * 1000;

  return {
    done: false,
    round: round + 1,
    phaseIndex,
    phase,
    // ceil (round UP): with 3.2 s left it says 4. So a 4-second phase shows
    // 4, 3, 2, 1, each for a full second, and never 0 while you're breathing.
    secondsLeft: Math.ceil((phaseMs - inRound) / 1000),
    progress: inRound / phaseMs,
    // The first phase starts from empty lungs; others start where the previous one ended.
    startScale: phaseIndex === 0 ? SCALE_EMPTY : ends[phaseIndex - 1],
    targetScale: ends[phaseIndex],
    totalSecondsLeft: Math.ceil((total - elapsed) / 1000),
  };
}

/** 76 -> "1:16" */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
