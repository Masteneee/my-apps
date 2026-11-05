// Pure functions for ordering the items of a list (Stage 5): drag-to-reorder,
// the up/down buttons, and working out which positions to save.
// Both stores use them, and reorder.test.ts checks them.

/** Something with a place in a list (a list_items row). */
type Positioned = { media_item_id: string; position: number };

/**
 * Moves the element at index `from` to index `to`, and returns a NEW array
 * (the old one isn't changed, which React needs to notice the change).
 * Out-of-range indexes return an unchanged copy instead of breaking the list.
 *
 * Example: moveItem(["a", "b", "c", "d"], 0, 2) -> ["b", "c", "a", "d"]
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const copy = [...items];
  const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < items.length;
  if (!valid(from) || !valid(to) || from === to) return copy;
  // splice(from, 1) cuts one element out and gives it back in an array;
  // splice(to, 0, x) inserts x at `to` without removing anything.
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

/** The up arrow: swap with the one above. Already first = no change. */
export function moveUp<T>(items: readonly T[], index: number): T[] {
  return moveItem(items, index, index - 1);
}

/** The down arrow: swap with the one below. Already last = no change. */
export function moveDown<T>(items: readonly T[], index: number): T[] {
  return moveItem(items, index, index + 1);
}

/**
 * Sorts list items by position (0 first). Equal positions (possible after
 * changes in two tabs) are ordered by item id, so the order is always the same.
 */
export function sortByPosition<T extends Positioned>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position || a.media_item_id.localeCompare(b.media_item_id));
}

/** The position for an item added at the END: one more than the biggest, or 0 for an empty list. */
export function nextPosition(items: readonly Positioned[]): number {
  return items.reduce((max, item) => Math.max(max, item.position + 1), 0);
}

/** True when both lists hold exactly the same ids (in any order), each once. */
export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  if (setA.size !== a.length) return false; // a has a duplicate
  return b.every((id) => setA.has(id)) && new Set(b).size === b.length;
}

/**
 * Which rows need saving for the new order `orderedIds` (first to last).
 * The new positions are simply 0, 1, 2...; only rows whose position CHANGES are
 * returned, so swapping two items in a long list saves 2 rows, not all of them.
 * Throws if `orderedIds` isn't exactly the current items (missing, extra, twice).
 */
export function positionChanges(current: readonly Positioned[], orderedIds: readonly string[]): Positioned[] {
  if (
    !sameIds(
      current.map((item) => item.media_item_id),
      orderedIds,
    )
  ) {
    throw new Error("This list changed somewhere else (another tab?). Reload the page and try again.");
  }
  const oldPosition = new Map(current.map((item) => [item.media_item_id, item.position]));
  return orderedIds
    .map((media_item_id, position) => ({ media_item_id, position }))
    .filter((row) => oldPosition.get(row.media_item_id) !== row.position);
}
