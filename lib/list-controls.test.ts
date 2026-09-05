import { describe, expect, it } from "vitest";
import { listPageCount, listPageSizes, normalizeListSearch } from "./list-controls";

describe("list controls", () => {
  it("matches Vietnamese text without accents and ignores spacing/case", () => {
    expect(normalizeListSearch("  ĐẶNG   Thùy Linh ")).toBe("dang thuy linh");
    expect(normalizeListSearch("  teacher@example.COM ")).toBe("teacher@example.com");
    expect(normalizeListSearch(" ")).toBe("");
  });
  it("always retains a valid first page including empty results", () => {
    expect(listPageCount(0, 20)).toBe(1);
    expect(listPageCount(21, 20)).toBe(2);
    expect(listPageCount(-5, 20)).toBe(1);
  });
  it("retains existing custom page sizes alongside standard choices", () => {
    expect(listPageSizes(8)).toEqual([8, 10, 20, 50, 100]);
    expect(listPageSizes(20)).toEqual([10, 20, 50, 100]);
  });
});
