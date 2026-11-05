import { describe, expect, it } from "vitest";
import { moveDown, moveItem, moveUp, nextPosition, positionChanges, sameIds, sortByPosition } from "./reorder";

describe("moveItem (drag-to-reorder)", () => {
  const list = ["a", "b", "c", "d"];

  it("moves an item down the list", () => {
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an item up the list", () => {
    expect(moveItem(list, 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("moves to the very first and very last place", () => {
    expect(moveItem(list, 2, 0)).toEqual(["c", "a", "b", "d"]);
    expect(moveItem(list, 0, 3)).toEqual(["b", "c", "d", "a"]);
  });

  it("returns a NEW array and leaves the old one alone", () => {
    const moved = moveItem(list, 0, 1);
    expect(moved).not.toBe(list);
    expect(list).toEqual(["a", "b", "c", "d"]);
  });

  it("ignores impossible moves (same place, out of range, not a whole number)", () => {
    expect(moveItem(list, 1, 1)).toEqual(list);
    expect(moveItem(list, -1, 2)).toEqual(list);
    expect(moveItem(list, 0, 4)).toEqual(list);
    expect(moveItem(list, 0.5, 2)).toEqual(list);
    expect(moveItem([], 0, 0)).toEqual([]);
  });
});

describe("up and down buttons", () => {
  const list = ["a", "b", "c"];

  it("swaps with the neighbour", () => {
    expect(moveUp(list, 1)).toEqual(["b", "a", "c"]);
    expect(moveDown(list, 1)).toEqual(["a", "c", "b"]);
  });

  it("does nothing at the edges", () => {
    expect(moveUp(list, 0)).toEqual(list);
    expect(moveDown(list, 2)).toEqual(list);
  });
});

describe("sortByPosition and nextPosition", () => {
  it("sorts by position, ties by id", () => {
    const items = [
      { media_item_id: "z", position: 2 },
      { media_item_id: "b", position: 0 },
      { media_item_id: "a", position: 2 },
    ];
    expect(sortByPosition(items).map((i) => i.media_item_id)).toEqual(["b", "a", "z"]);
  });

  it("puts a new item after the biggest position (gaps are fine)", () => {
    expect(nextPosition([])).toBe(0);
    expect(nextPosition([{ media_item_id: "a", position: 0 }])).toBe(1);
    expect(
      nextPosition([
        { media_item_id: "a", position: 0 },
        { media_item_id: "b", position: 7 },
      ]),
    ).toBe(8);
  });
});

describe("sameIds", () => {
  it("is true for the same ids in any order", () => {
    expect(sameIds(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
    expect(sameIds([], [])).toBe(true);
  });

  it("is false when one is missing, extra or doubled", () => {
    expect(sameIds(["a", "b"], ["a"])).toBe(false);
    expect(sameIds(["a", "b"], ["a", "c"])).toBe(false);
    expect(sameIds(["a", "b"], ["a", "a"])).toBe(false);
    expect(sameIds(["a", "a"], ["a", "b"])).toBe(false);
  });
});

describe("positionChanges (what to save after a reorder)", () => {
  const current = [
    { media_item_id: "a", position: 0 },
    { media_item_id: "b", position: 1 },
    { media_item_id: "c", position: 2 },
    { media_item_id: "d", position: 3 },
  ];

  it("returns only the rows whose position changes", () => {
    // Swap b and c: only those two rows need saving.
    expect(positionChanges(current, ["a", "c", "b", "d"])).toEqual([
      { media_item_id: "c", position: 1 },
      { media_item_id: "b", position: 2 },
    ]);
  });

  it("returns nothing when the order didn't change", () => {
    expect(positionChanges(current, ["a", "b", "c", "d"])).toEqual([]);
  });

  it("closes gaps left by removed items", () => {
    const withGap = [
      { media_item_id: "a", position: 0 },
      { media_item_id: "c", position: 2 },
    ];
    expect(positionChanges(withGap, ["a", "c"])).toEqual([{ media_item_id: "c", position: 1 }]);
  });

  it("refuses an order that doesn't match the list", () => {
    expect(() => positionChanges(current, ["a", "b", "c"])).toThrow("changed somewhere else");
    expect(() => positionChanges(current, ["a", "b", "c", "x"])).toThrow("changed somewhere else");
  });
});
