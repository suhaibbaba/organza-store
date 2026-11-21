// The search layer's own rules: Arabic normalization, the forms indexed per word, and the pg_trgm fallback.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSearchText, normalize, normalizeQuery, withArticleVariants } from "@/lib/search/normalize";
import { toSearchDocument } from "@/lib/search/documents";
import { normalizedSynonyms } from "@/lib/search/meilisearch";
import { PRODUCTS_INDEX_SETTINGS } from "@/constants/searchIndex";
import type { SearchCategoryNode, SearchProductRow } from "@/types/search";

const ENV_KEYS = ["MEILI_HOST", "MEILI_MASTER_KEY", "MEILI_PRODUCT_INDEX"] as const;

describe("search normalization", () => {
  it("strips tashkeel and tatweel and unifies similar letters", () => {
    expect(normalize("فَسْتَان")).toBe("فستان");
    expect(normalize("أحمر إبرة آية مرآة")).toBe("احمر ابره ايه مراه");
    expect(normalize("مستوى مؤشر شاطئ")).toBe("مستوي موشر شاطي");
    expect(normalize("شـــال")).toBe("شال");
  });

  it("makes every spelling of the same word identical, on the query side too", () => {
    for (const [a, b] of [
      ["أحمر", "احمر"],
      ["إبرة", "ابره"],
      ["آية", "ايه"],
      ["مستوى", "مستوي"],
      ["شَالٌ", "شال"],
      ["شـــيفون", "شيفون"],
    ]) {
      expect(normalizeQuery(a)).toBe(normalizeQuery(b));
    }
  });

  it("stores synonyms normalized, so they meet the normalized query", () => {
    expect(normalizedSynonyms()["عبايه"]).toEqual(["عباءه"]);
    expect(normalizedSynonyms()["جاكيت"]).toEqual(expect.arrayContaining(["جاكت", "جكيت"]));
  });

  it("matches SKU and barcode exactly, and ranks the name above everything else", () => {
    expect(PRODUCTS_INDEX_SETTINGS.typoTolerance.disableOnAttributes).toEqual(["sku", "barcode"]);
    expect(PRODUCTS_INDEX_SETTINGS.typoTolerance.disableOnNumbers).toBe(true);
    expect(PRODUCTS_INDEX_SETTINGS.searchableAttributes[0]).toBe("name_ar");
    expect(PRODUCTS_INDEX_SETTINGS.searchableAttributes.at(-1)).toBe("description");
    expect(PRODUCTS_INDEX_SETTINGS.rankingRules).toEqual([
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness",
    ]);
  });

  it("indexes each word with and without the article and an attached و/ب/ل", () => {
    const forms = withArticleVariants("الفستان وابيض باللون").split(" ");
    expect(forms).toEqual(expect.arrayContaining(["الفستان", "فستان", "وابيض", "ابيض", "باللون", "اللون", "لون"]));
  });

  it("leaves short words alone, where ال or و is part of the root", () => {
    expect(withArticleVariants("الماس ورد").split(" ")).toEqual(["الماس", "ورد", "ماس"]);
    expect(withArticleVariants("ورد")).toBe("ورد");
  });

  it("drops the article from a query word but never an attached و", () => {
    expect(normalizeQuery("الفُستان")).toBe("فستان");
    expect(normalizeQuery("وردي")).toBe("وردي");
  });

  it("builds searchText from every stored language", () => {
    expect(buildSearchText({ ar: "عباية", en: "Abaya", he: "עבאיה" }, { ar: "سوداء" })).toBe("عبايه abaya עבאיה سوداء");
  });

  it("turns a product into one document with names, codes, category, attributes, price and stock", () => {
    const categories = new Map<string, SearchCategoryNode>([
      ["c-child", { id: "c-child", name: { ar: "شالات", en: "Shawls" }, parentId: "c-root" }],
      ["c-root", { id: "c-root", name: { ar: "إكسسوارات" }, parentId: null }],
    ]);
    const row = {
      id: "p1",
      name: { ar: "الشال", en: "Shawl" },
      description: { ar: "قماش ناعم" },
      sku: null,
      barcode: "2000000000017",
      categoryId: "c-child",
      isActive: true,
      stock: 0,
      basePrice: "45.50",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      images: [{ thumbnailUrl: "/uploads/p1-thumb.webp" }],
      variants: [
        {
          name: { ar: "أحمر" },
          sku: "ORG-00001-1",
          barcode: null,
          stock: 0,
          values: [{ optionValue: { value: { ar: "أحمر", en: "Red" } } }],
        },
        { name: { ar: "أسود" }, sku: "ORG-00001-2", barcode: "2000000000024", stock: 3, values: [] },
      ],
    } as unknown as SearchProductRow;

    expect(toSearchDocument(row, categories)).toEqual({
      id: "p1",
      name_ar: "الشال شال",
      name_en: "shawl",
      name_he: "",
      sku: ["ORG-00001-1", "ORG-00001-2"],
      barcode: ["2000000000017", "2000000000024"],
      category: "شالات shawls اكسسوارات",
      attributes: "احمر red اسود",
      description: "قماش ناعم",
      categoryId: "c-child",
      isActive: true,
      inStock: true,
      price: 45.5,
      image: "/uploads/p1-thumb.webp",
      createdAt: Date.parse("2026-01-01T00:00:00Z"),
    });
  });
});

describe("search engine selection", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    vi.resetModules();
  });
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
    vi.unstubAllGlobals();
    vi.doUnmock("@/lib/search/postgres");
    vi.doUnmock("@/lib/logger");
  });

  async function loadSearch() {
    const postgres = vi.fn(async () => ["from-postgres"]);
    vi.doMock("@/lib/search/postgres", () => ({ postgresSearchProductIds: postgres }));
    vi.doMock("@/lib/logger", () => ({ captureException: vi.fn() }));
    return { search: await import("@/lib/search"), postgres };
  }

  it("uses pg_trgm when no Meilisearch host is configured", async () => {
    delete process.env.MEILI_HOST;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { search, postgres } = await loadSearch();
    expect(await search.searchProductIds("فستان")).toEqual(["from-postgres"]);
    expect(postgres).toHaveBeenCalledOnce();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("asks Meilisearch with the normalized query when it is configured", async () => {
    process.env.MEILI_HOST = "http://search.test:7700/";
    process.env.MEILI_MASTER_KEY = "k".repeat(16);
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ hits: [{ id: "a" }, { id: "b" }] })));
    vi.stubGlobal("fetch", fetchSpy);
    const { search, postgres } = await loadSearch();
    expect(await search.searchProductIds("الفَستان")).toEqual(["a", "b"]);
    expect(postgres).not.toHaveBeenCalled();
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://search.test:7700/indexes/products/search");
    expect(JSON.parse(String(init.body))).toMatchObject({ q: "فستان", matchingStrategy: "last" });
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${"k".repeat(16)}`);
  });

  it("falls back to pg_trgm when Meilisearch is unreachable, so the till never loses search", async () => {
    process.env.MEILI_HOST = "http://search.test:7700";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const { search, postgres } = await loadSearch();
    expect(await search.searchProductIds("فستان")).toEqual(["from-postgres"]);
    expect(postgres).toHaveBeenCalledOnce();
  });

  it("falls back on an error answer too", async () => {
    process.env.MEILI_HOST = "http://search.test:7700";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 })),
    );
    const { search, postgres } = await loadSearch();
    expect(await search.searchProductIds("فستان")).toEqual(["from-postgres"]);
    expect(postgres).toHaveBeenCalledOnce();
  });
});
