// Pure checks for lists (Stage 5). Both stores call validateListInput(), and
// the database checks the same limits again (the lists table, Stage 2 migration).

import type { NewListInput } from "./types";
import type { Result } from "./validation";

export const LIST_TITLE_MAX = 100; // KEEP IN SYNC with lists.title in the Stage 2 migration
export const LIST_DESCRIPTION_MAX = 1000; // KEEP IN SYNC with lists.description

/** The cleaned list fields, ready to be saved (snake_case like the database). */
export type CleanListFields = {
  title: string;
  description: string | null;
  is_public: boolean;
};

export function validateListInput(input: NewListInput): Result<CleanListFields> {
  // trim() removes spaces at both ends, so "   " counts as empty.
  const title = (input.title ?? "").trim();
  if (title === "") return { ok: false, error: "Give your list a title." };
  if (title.length > LIST_TITLE_MAX) {
    return { ok: false, error: `The title is too long (${title.length}/${LIST_TITLE_MAX} characters).` };
  }
  const description = (input.description ?? "").trim();
  if (description.length > LIST_DESCRIPTION_MAX) {
    return {
      ok: false,
      error: `The description is too long (${description.length}/${LIST_DESCRIPTION_MAX} characters).`,
    };
  }
  return {
    ok: true,
    value: { title, description: description || null, is_public: input.isPublic !== false },
  };
}

/** "3 items", "1 item", "Empty". */
export function itemCountLabel(count: number): string {
  if (count === 0) return "Empty";
  return `${count} ${count === 1 ? "item" : "items"}`;
}
