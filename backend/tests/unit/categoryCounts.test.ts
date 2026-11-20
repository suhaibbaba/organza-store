import { describe, expect, it } from "vitest";
import { rollUpCategoryCounts } from "@/lib/categories";

// The number under each POS category tile. It must promise what tapping the
// tile shows — the shelf AND everything under it — so it is rolled up the tree.
describe("rollUpCategoryCounts", () => {
  const tree = [
    { id: "women", parentId: null },
    { id: "dresses", parentId: "women" },
    { id: "evening", parentId: "dresses" },
    { id: "shawls", parentId: null },
  ];

  it("adds every descendant's products to its ancestors", () => {
    const totals = rollUpCategoryCounts(
      tree,
      new Map([
        ["women", 1],
        ["dresses", 4],
        ["evening", 2],
        ["shawls", 7],
      ])
    );
    expect(totals.get("evening")).toBe(2);
    expect(totals.get("dresses")).toBe(6);
    expect(totals.get("women")).toBe(7);
    expect(totals.get("shawls")).toBe(7);
  });

  it("answers zero for a category with no products anywhere under it", () => {
    const totals = rollUpCategoryCounts(tree, new Map());
    expect([...totals.values()]).toEqual([0, 0, 0, 0]);
  });

  it("terminates on a parent cycle and counts each category once", () => {
    const cyclic = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ];
    const totals = rollUpCategoryCounts(
      cyclic,
      new Map([
        ["a", 1],
        ["b", 2],
      ])
    );
    expect(totals.get("a")).toBe(3);
    expect(totals.get("b")).toBe(3);
  });
});
