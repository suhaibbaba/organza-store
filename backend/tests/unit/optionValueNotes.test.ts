// How a note reaches a screen (spec.md "Notes on a product's options").
//
// The API suite proves the notes are stored and scoped correctly; this proves
// the two rules every screen shares, which no HTTP test can see: which notes a
// variant carries, and which language of one is shown.
import { describe, expect, it } from "vitest";
import { localizeI18n } from "@organza/shared/lib/i18n";
import { noteByOptionValueId, variantValueNotes } from "@organza/shared/lib/optionValueNotes";
import { DEFAULT_LANGUAGE } from "@organza/shared/constants/languages";
import type { Variant } from "@organza/shared/types/variant";

function value(id: string, label: string, note: Record<string, string> | null) {
  return { id, variantTypeId: `type-${id}`, value: { ar: label }, key: label.toLowerCase(), note };
}

function variant(values: ReturnType<typeof value>[]): Pick<Variant, "values"> {
  return { values } as Pick<Variant, "values">;
}

describe("which notes a variant carries", () => {
  it("returns nothing at all when no value was annotated", () => {
    // Not an empty string, not a placeholder: a screen renders nothing, so
    // there is no gap and nothing shifts on a tile without a note — which is
    // almost every tile.
    expect(variantValueNotes(variant([value("s", "S", null), value("red", "Red", null)]))).toEqual([]);
  });

  it("keeps each note with the value it belongs to, in the variant's own order", () => {
    // A dress in red/M with something to say about both: the picker has to be
    // able to show which note is the colour's and which is the size's.
    const notes = variantValueNotes(
      variant([value("red", "Red", { ar: "أغمق من الصورة" }), value("m", "M", { ar: "يناسب ٣٨-٤٠" })])
    );

    expect(notes.map((note) => note.valueId)).toEqual(["red", "m"]);
    expect(notes[0].value).toEqual({ ar: "Red" });
    expect(notes[1].note).toEqual({ ar: "يناسب ٣٨-٤٠" });
  });

  it("drops the values that have nothing to say, and keeps the ones that do", () => {
    const notes = variantValueNotes(
      variant([value("red", "Red", null), value("m", "M", { ar: "الطول ١٤٠ سم" })])
    );
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
    // The shop writes Arabic and little else, so Hebrew has to fall back —
    // CLAUDE.md rule 9. A blank note would read as "no note", which is a
    // different fact entirely.
    expect(localizeI18n(note, "he")).toBe(note[DEFAULT_LANGUAGE]);
    expect(localizeI18n({ en: "Light fabric" }, "he")).toBe("Light fabric");
  });

  it("has nothing to show for a value that was never annotated", () => {
    expect(localizeI18n(null, "ar")).toBe("");
    expect(localizeI18n(undefined, "he")).toBe("");
  });
});
