"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import type { ProductSummary } from "@shared/types/product";
import { buildSidebarCategories } from "@/lib/categories";
import { useCategoriesQuery } from "@/hooks/use-categories";
import { useProductBrowse } from "@/hooks/use-product-browse";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { BrowserCategorySidebar } from "@/components/sell/browser/browser-category-sidebar";
import { BrowserProductGrid } from "@/components/sell/browser/browser-product-grid";

interface ProductBrowserDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The id of the product whose details are being fetched after a tap —
  // owned by the selling screen, because it is the screen that fetches them
  // and then either adds to the cart or opens the picker.
  pendingId: string | null;
  onSelect: (product: ProductSummary) => void;
}

// Picking a product by looking at it.
//
// Not everything in the shop can carry a barcode: a silk scarf has nothing to
// stick a label to, and some cashiers are simply faster finding a piece by
// its photo than by typing its name. So the counter gets a second way in
// alongside the camera, the hand scanner and the search box — the same cart,
// the same lookup, the same answers.
//
// It is a drawer and not a screen on purpose. It comes over the sale from the
// start edge, the cashier picks, and it goes away again; the cart it was
// covering is exactly where it was, with one more line on it. Nothing about
// the selling screen underneath changes while it is open — no state moved
// here, no layout reworked around it.
//
// Motion: the panel slides in from the edge it is pinned to and the backdrop
// fades with it (SheetContent), the cards arrive in a short sweep
// (pos-browse-card in globals.css), and a press dips the card it lands on.
// All of it is transforms and opacity — nothing that lays the grid out again
// — and all of it stops when the device asks for less motion. Escape, the ✕
// and the backdrop all close it, because a cashier who wants out of a
// full-screen panel should not have to find the one way there is.
export function ProductBrowserDrawer({ open, onOpenChange, pendingId, onSelect }: ProductBrowserDrawerProps) {
  const t = useTranslations("sell.browse");
  const tCommon = useTranslations("common");

  // null = "All". This is the one thing that outlives a closing, because it
  // is the one thing worth keeping: a customer bringing three scarves to the
  // counter is three trips into the same shelf. Everything else — the search
  // box, the page the grid had reached — belongs to the body below, which
  // Radix unmounts on close, so each opening starts from the shelf and not
  // from the middle of somebody else's errand.
  const [categoryId, setCategoryId] = useState<string | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="start"
        closeLabel={tCommon("close")}
        // Nearly the whole screen on a phone, a wide panel on the counter's
        // laptop — big enough for the grid to be worth looking at, never so
        // wide that the sale behind it is out of mind. gap-0 because this
        // panel is a header and a body that meet, not a stack of blocks.
        //
        // No `p-0` here, however tempting: the panel's only padding is the
        // safe-area inset it keeps for the notch and the home indicator, and
        // a padding utility passed in would merge that away — the last row of
        // the grid would end up under the iPhone's indicator. Every block
        // inside brings its own padding instead.
        className="w-full max-w-none gap-0 sm:w-[92vw] sm:max-w-4xl lg:max-w-5xl"
      >
        {/* pe-14 keeps the title clear of the ✕ that SheetContent pins to the
            trailing corner. */}
        <SheetTitle className="shrink-0 px-3 pt-3 pe-14 text-base">{t("title")}</SheetTitle>

        <ProductBrowserBody
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          pendingId={pendingId}
          onSelect={onSelect}
        />
      </SheetContent>
    </Sheet>
  );
}

interface ProductBrowserBodyProps {
  categoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  pendingId: string | null;
  onSelect: (product: ProductSummary) => void;
}

// Everything that should start fresh each time the drawer is opened. Mounted
// only while it is open — Radix unmounts a closed sheet's content — so the
// search box empties itself and the grid drops back to its first page with no
// resetting to write, and a closed drawer costs the till nothing: no request
// runs, because the hooks that would make one are not mounted.
function ProductBrowserBody({ categoryId, onCategoryChange, pendingId, onSelect }: ProductBrowserBodyProps) {
  const t = useTranslations("sell.browse");
  const [query, setQuery] = useState("");

  const categoriesQuery = useCategoriesQuery();
  const categories = useMemo(() => buildSidebarCategories(categoriesQuery.data), [categoriesQuery.data]);

  const browse = useProductBrowse({ categoryId, query });
  const isSearching = query.trim().length > 0;

  return (
    <>
      {/* The search box lives in the body rather than in the header above
          because the query it edits is this component's, and this component
          is the part that starts fresh on every opening. */}
      <div className="shrink-0 border-b border-border px-3 py-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          {/* The same cross-language, typo-tolerant search the box on the
              selling screen runs (CLAUDE.md rule 10) — asked for a category
              at a time. Never autofocused: SheetContent hands focus to the
              panel itself, so opening the drawer on a phone does not throw
              the keyboard over the first row of photos. */}
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            autoComplete="off"
            enterKeyHint="search"
            className="ps-11 pe-11"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("clearSearch")}
              className="absolute end-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Two columns that scroll independently: the shelves stay put while
          the grid moves, which is what makes this feel like a cupboard rather
          than one long page. min-h-0 is what lets either of them scroll at
          all inside a flex column. */}
      <div className="flex min-h-0 flex-1">
        <BrowserCategorySidebar
          categories={categories}
          selectedId={categoryId}
          onSelect={onCategoryChange}
          isLoading={categoriesQuery.isPending}
          isError={categoriesQuery.isError}
        />

        <div className="min-w-0 flex-1 overflow-y-auto">
          <BrowserProductGrid
            products={browse.products}
            isLoading={browse.isPending || browse.isTyping}
            isError={browse.isError}
            isSearching={isSearching}
            isFiltered={isSearching || categoryId !== null}
            onClearFilters={() => {
              setQuery("");
              onCategoryChange(null);
            }}
            hasNextPage={browse.hasNextPage}
            isFetchingNextPage={browse.isFetchingNextPage}
            onShowMore={() => void browse.fetchNextPage()}
            pendingId={pendingId}
            onSelect={onSelect}
          />
        </div>
      </div>
    </>
  );
}
