import { describe, expect, it } from "vitest";
import {
  breathingState,
  formatClock,
  PATTERNS,
  phaseEndScales,
  roundMs,
  SCALE_EMPTY,
  SCALE_FULL,
  totalMs,
} from "./breathing";

const s = (seconds: number) => seconds * 1000; // seconds -> milliseconds
const fourSevenEight = PATTERNS["4-7-8"];
const box = PATTERNS.box;

describe("the two patterns", () => {
  it("4-7-8: in 4, hold 7, out 8 = 19 s a round, 4 rounds", () => {
    expect(fourSevenEight.phases.map((p) => [p.kind, p.seconds])).toEqual([
      ["inhale", 4],
      ["hold", 7],
      ["exhale", 8],
    ]);
    expect(roundMs(fourSevenEight)).toBe(s(19));
    expect(totalMs(fourSevenEight)).toBe(s(76));
  });

  it("box: in 4, hold 4, out 4, hold 4 = 16 s a round, 6 rounds", () => {
    expect(box.phases.map((p) => [p.kind, p.seconds])).toEqual([
      ["inhale", 4],
      ["hold", 4],
      ["exhale", 4],
      ["hold", 4],
    ]);
    expect(totalMs(box)).toBe(s(96));
  });
});

describe("breathingState: 4-7-8", () => {
  it("starts by breathing in, with 4 seconds on the countdown", () => {
    expect(breathingState(fourSevenEight, 0)).toMatchObject({
      done: false,
      round: 1,
      phaseIndex: 0,
      secondsLeft: 4,
      progress: 0,
      totalSecondsLeft: 76,
    });
    expect(breathingState(fourSevenEight, 0).phase.label).toBe("Breathe in");
  });

  it("counts down 4, 3, 2, 1 (rounding up), never 0 during a phase", () => {
    expect(breathingState(fourSevenEight, s(0.5)).secondsLeft).toBe(4);
    expect(breathingState(fourSevenEight, s(1)).secondsLeft).toBe(3);
    expect(breathingState(fourSevenEight, s(3.999)).secondsLeft).toBe(1);
  });

  it("switches phase exactly on the boundary", () => {
    expect(breathingState(fourSevenEight, s(4) - 1).phase.kind).toBe("inhale");
    expect(breathingState(fourSevenEight, s(4))).toMatchObject({ phaseIndex: 1, secondsLeft: 7 });
    expect(breathingState(fourSevenEight, s(11))).toMatchObject({ phaseIndex: 2, secondsLeft: 8 });
    expect(breathingState(fourSevenEight, s(11)).phase.label).toBe("Breathe out");
  });

  it("knows how far into the phase you are", () => {
    expect(breathingState(fourSevenEight, s(13)).progress).toBeCloseTo(2 / 8);
  });

  it("starts round 2 after 19 seconds, and the last round after 57", () => {
    expect(breathingState(fourSevenEight, s(19))).toMatchObject({ round: 2, phaseIndex: 0, secondsLeft: 4 });
    expect(breathingState(fourSevenEight, s(57))).toMatchObject({ round: 4, phaseIndex: 0 });
  });

  it("is done after the last round", () => {
    expect(breathingState(fourSevenEight, s(76) - 1).done).toBe(false);
    expect(breathingState(fourSevenEight, s(76))).toMatchObject({ done: true, secondsLeft: 0, totalSecondsLeft: 0, round: 4 });
    expect(breathingState(fourSevenEight, s(500)).done).toBe(true);
  });

  it("treats negative or broken times as 'just started'", () => {
    expect(breathingState(fourSevenEight, -500)).toMatchObject({ round: 1, phaseIndex: 0, secondsLeft: 4 });
    expect(breathingState(fourSevenEight, Number.NaN)).toMatchObject({ round: 1, phaseIndex: 0 });
  });
});

describe("breathingState: box breathing", () => {
  it("goes in, hold, out, hold, 4 seconds each", () => {
    const kinds = [0, 4, 8, 12].map((t) => breathingState(box, s(t)).phase.kind);
    expect(kinds).toEqual(["inhale", "hold", "exhale", "hold"]);
    expect(breathingState(box, s(16))).toMatchObject({ round: 2, phaseIndex: 0 });
    expect(breathingState(box, s(96)).done).toBe(true);
  });
});

describe("the circle's size", () => {
  it("grows when breathing in, stays when holding, shrinks when breathing out", () => {
    expect(phaseEndScales(fourSevenEight)).toEqual([SCALE_FULL, SCALE_FULL, SCALE_EMPTY]);
    // Box: the second hold is with EMPTY lungs, so the circle stays small.
    expect(phaseEndScales(box)).toEqual([SCALE_FULL, SCALE_FULL, SCALE_EMPTY, SCALE_EMPTY]);
  });

  it("gives where each phase starts and ends, for the animation", () => {
    expect(breathingState(fourSevenEight, s(1))).toMatchObject({ startScale: SCALE_EMPTY, targetScale: SCALE_FULL });
    expect(breathingState(fourSevenEight, s(5))).toMatchObject({ startScale: SCALE_FULL, targetScale: SCALE_FULL });
    expect(breathingState(fourSevenEight, s(12))).toMatchObject({ startScale: SCALE_FULL, targetScale: SCALE_EMPTY });
    // A new round starts from empty lungs again.
    expect(breathingState(fourSevenEight, s(20))).toMatchObject({ startScale: SCALE_EMPTY, targetScale: SCALE_FULL });
    expect(breathingState(fourSevenEight, s(76)).targetScale).toBe(SCALE_EMPTY);
  });
});

describe("formatClock", () => {
  it("writes minutes:seconds", () => {
    expect(formatClock(76)).toBe("1:16");
    expect(formatClock(9)).toBe("0:09");
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(-3)).toBe("0:00");
  });
});
