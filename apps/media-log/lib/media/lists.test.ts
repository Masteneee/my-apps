import { describe, expect, it } from "vitest";
import { itemCountLabel, LIST_DESCRIPTION_MAX, LIST_TITLE_MAX, validateListInput } from "./lists";

describe("validateListInput", () => {
  it("cleans a valid list", () => {
    expect(validateListInput({ title: "  Best anime  ", description: "  For movie fans ", isPublic: true })).toEqual({
      ok: true,
      value: { title: "Best anime", description: "For movie fans", is_public: true },
    });
  });

  it("stores an empty description as null and keeps private lists private", () => {
    expect(validateListInput({ title: "Secret", description: "   ", isPublic: false })).toEqual({
      ok: true,
      value: { title: "Secret", description: null, is_public: false },
    });
  });

  it("needs a title", () => {
    const result = validateListInput({ title: "   ", description: "", isPublic: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("title");
  });

  it("refuses a title or description that is too long", () => {
    const longTitle = validateListInput({ title: "x".repeat(LIST_TITLE_MAX + 1), description: "", isPublic: true });
    expect(longTitle.ok).toBe(false);
    expect(validateListInput({ title: "x".repeat(LIST_TITLE_MAX), description: "", isPublic: true }).ok).toBe(true);
    const longDescription = validateListInput({
      title: "Ok",
      description: "x".repeat(LIST_DESCRIPTION_MAX + 1),
      isPublic: true,
    });
    expect(longDescription.ok).toBe(false);
  });
});

describe("itemCountLabel", () => {
  it("says how many items", () => {
    expect(itemCountLabel(0)).toBe("Empty");
    expect(itemCountLabel(1)).toBe("1 item");
    expect(itemCountLabel(5)).toBe("5 items");
  });
});
