// The two rules every screen shares for option notes: which notes a variant carries, and which language shows.
import { describe, expect, it } from "vitest";
import { localizeI18n } from "@store/shared/lib/i18n";
import { noteByOptionValueId, variantValueNotes } from "@store/shared/lib/optionValueNotes";
import { DEFAULT_LANGUAGE } from "@store/shared/constants/languages";
import type { Variant } from "@store/shared/types/variant";

function value(id: string, label: string, note: Record<string, string> | null) {
  return { id, variantTypeId: `type-${id}`, value: { ar: label }, key: label.toLowerCase(), note };
}

function variant(values: ReturnType<typeof value>[]): Pick<Variant, "values"> {
  return { values } as Pick<Variant, "values">;
}

describe("which notes a variant carries", () => {
  it("returns nothing at all when no value was annotated", () => {
    // Absent, not "" or a placeholder, so a tile without a note (almost every tile) renders nothing.
    expect(variantValueNotes(variant([value("s", "S", null), value("red", "Red", null)]))).toEqual([]);
  });

  it("keeps each note with the value it belongs to, in the variant's own order", () => {
    // Red/M with a note on each: the picker must tell the colour's note from the size's.
    const notes = variantValueNotes(
      variant([value("red", "Red", { ar: "أغمق من الصورة" }), value("m", "M", { ar: "يناسب ٣٨-٤٠" })]),
    );

    expect(notes.map((note) => note.valueId)).toEqual(["red", "m"]);
    expect(notes[0].value).toEqual({ ar: "Red" });
    expect(notes[1].note).toEqual({ ar: "يناسب ٣٨-٤٠" });
  });

  it("drops the values that have nothing to say, and keeps the ones that do", () => {
    const notes = variantValueNotes(variant([value("red", "Red", null), value("m", "M", { ar: "الطول ١٤٠ سم" })]));
    expect(notes).toHaveLength(1);
    expect(notes[0].valueId).toBe("m");
  });

  it("keys a product's notes by the value they were written against", () => {
    const map = noteByOptionValueId([
      { optionValueId: "m", note: { ar: "الطول ١٤٠ سم" } },
      { optionValueId: "l", note: { ar: "الطول ١٤٥ سم" } },
    ]);
    expect(map.get("m")).toEqual({ ar: "الطول ١٤٠ سم" });
    expect(map.get("xl")).toBeUndefined();
  });
});

describe("which language of a note is shown", () => {
  const note = { ar: "طول البنطلون ٩٥ سم", en: "Trouser length 95 cm" };

  it("shows the reader's own language when it was written", () => {
    expect(localizeI18n(note, "en")).toBe("Trouser length 95 cm");
    expect(localizeI18n(note, "ar")).toBe("طول البنطلون ٩٥ سم");
  });

  it("falls back to the default language rather than rendering blank", () => {
    // Hebrew falls back to the default language (rule 9): a blank note would read as "no note".
    expect(localizeI18n(note, "he")).toBe(note[DEFAULT_LANGUAGE]);
    expect(localizeI18n({ en: "Light fabric" }, "he")).toBe("Light fabric");
  });

  it("has nothing to show for a value that was never annotated", () => {
    expect(localizeI18n(null, "ar")).toBe("");
    expect(localizeI18n(undefined, "he")).toBe("");
  });
});
