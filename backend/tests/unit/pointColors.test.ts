// What colour a numbered shawl's numbers come out (spec.md "Numbered
// shawls"). The rule has three layers and they are easy to get backwards, so
// each is pinned here rather than through the API: the shop's own choice, the
// suggestion read from the photograph, and the guarantee that the number stays
// readable whatever the two colours are.
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  enforceTextContrast,
  isHexColor,
  normalizeHexColor,
  resolvePointColors,
  suggestPointColors,
} from "@organza/shared/lib/pointColors";
import {
  MIN_POINT_CONTRAST_RATIO,
  POINT_COLORS_FALLBACK,
  POINT_COLORS_FOR_DARK_IMAGE,
  POINT_COLORS_FOR_LIGHT_IMAGE,
} from "@organza/shared/constants/numberedShawl";

describe("the suggestion read from the photograph", () => {
  it("puts light markers on a dark photo and dark markers on a pale one", () => {
    // A black abaya photographed on a dark rail, and a cream scarf on white.
    expect(suggestPointColors(9)).toEqual(POINT_COLORS_FOR_DARK_IMAGE);
    expect(suggestPointColors(91)).toEqual(POINT_COLORS_FOR_LIGHT_IMAGE);
  });

  it("keeps the shipped marker when there is nothing to sample", () => {
    // A photo uploaded before brightness was recorded, or no photo at all.
    // Guessing here would change how existing products look for no reason.
    expect(suggestPointColors(null)).toEqual(POINT_COLORS_FALLBACK);
    expect(suggestPointColors(undefined)).toEqual(POINT_COLORS_FALLBACK);
  });
});

describe("what actually gets drawn", () => {
  it("follows the photo until the shop chooses", () => {
    const colors = resolvePointColors({ pointTextColor: null, pointBackgroundColor: null }, 9);
    expect(colors.background).toBe(POINT_COLORS_FOR_DARK_IMAGE.background);
    expect(colors.text).toBe(POINT_COLORS_FOR_DARK_IMAGE.text);
    expect(colors.isAutoText).toBe(true);
    expect(colors.isAutoBackground).toBe(true);
  });

  it("keeps a chosen colour when the photograph is replaced", () => {
    const chosen = { pointTextColor: "#FFF59D", pointBackgroundColor: "#C2185B" };
    // The same product, photographed dark and then pale: the choice is stored,
    // so it must not follow the new picture.
    for (const brightness of [9, 91, null]) {
      const colors = resolvePointColors(chosen, brightness);
      expect(colors.background).toBe("#C2185B");
      expect(colors.text).toBe("#FFF59D");
      expect(colors.isAutoBackground).toBe(false);
    }
  });

  it("takes each half on its own", () => {
    const colors = resolvePointColors({ pointTextColor: null, pointBackgroundColor: "#C2185B" }, 91);
    expect(colors.background).toBe("#C2185B");
    expect(colors.isAutoBackground).toBe(false);
    expect(colors.isAutoText).toBe(true);
  });

  it("moves the text rather than let a number vanish into its own badge", () => {
    // A colour picker will happily produce this. The badge is what the shop
    // chose to sit against its photograph, so the TEXT is what gives way.
    const colors = resolvePointColors({ pointTextColor: "#C2185B", pointBackgroundColor: "#C2185B" }, null);
    expect(colors.background).toBe("#C2185B");
    expect(colors.text).not.toBe("#C2185B");
    expect(colors.textAdjustedForContrast).toBe(true);
    expect(contrastRatio(colors.text, colors.background)).toBeGreaterThanOrEqual(MIN_POINT_CONTRAST_RATIO);
  });

  it("leaves a legible pair exactly as chosen", () => {
    const colors = resolvePointColors({ pointTextColor: "#FFFFFF", pointBackgroundColor: "#1B1B1B" }, 50);
    expect(colors.text).toBe("#FFFFFF");
    expect(colors.textAdjustedForContrast).toBe(false);
  });

  it("ignores a stored value that is not a colour", () => {
    // Nothing should be able to write one, but a marker that renders as
    // "javascript:" is worse than one that falls back.
    const colors = resolvePointColors({ pointTextColor: "red; drop table", pointBackgroundColor: "" }, 9);
    expect(colors).toMatchObject(POINT_COLORS_FOR_DARK_IMAGE);
  });
});

describe("the colour helpers", () => {
  it("measures contrast the way WCAG does", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("picks whichever of black and white survives the background", () => {
    expect(enforceTextContrast("#EFEFEF", "#FFFFFF")).toBe("#111827");
    expect(enforceTextContrast("#222222", "#000000")).toBe("#FFFFFF");
  });

  it("expands the short form a colour input cannot read", () => {
    expect(normalizeHexColor("#abc")).toBe("#AABBCC");
    expect(normalizeHexColor("#AaBbCc")).toBe("#AABBCC");
    expect(normalizeHexColor("nonsense")).toBeNull();
    expect(isHexColor("#1234")).toBe(false);
  });
});
