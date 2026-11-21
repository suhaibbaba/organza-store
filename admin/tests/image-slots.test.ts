import { describe, expect, it } from "vitest";
import { moveSlot, removeSlot, setPrimarySlot } from "@/lib/image-slots";
import type { GallerySlot } from "@/types/productForm";

const slot = (id: string, isPrimary = false) =>
  ({ kind: "existing", id, image: { id } as never, isPrimary, edit: null, previewUrl: null }) as unknown as GallerySlot;
const gallery = () => [slot("a", true), slot("b"), slot("c")];
const primaryOf = (slots: GallerySlot[]) => slots.filter((s) => s.isPrimary).map((s) => s.id);

describe("gallery main photo", () => {
  it("follows the photo dragged to the front", () => {
    const next = moveSlot(gallery(), "c", "a");
    expect(next.map((s) => s.id)).toEqual(["c", "a", "b"]);
    expect(primaryOf(next)).toEqual(["c"]);
  });

  it("passes to the next photo when the main one is dragged away", () => {
    const next = moveSlot(gallery(), "a", "c");
    expect(next.map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(primaryOf(next)).toEqual(["b"]);
  });

  it("moves a photo made main to the front", () => {
    const next = setPrimarySlot(gallery(), "b");
    expect(next.map((s) => s.id)).toEqual(["b", "a", "c"]);
    expect(primaryOf(next)).toEqual(["b"]);
  });

  it("hands the badge on when the main photo is removed", () => {
    expect(primaryOf(removeSlot(gallery(), "a"))).toEqual(["b"]);
  });
});
