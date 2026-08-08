import { useInfiniteQuery } from "@tanstack/react-query";
import { PRODUCT_BROWSE_QUERY_KEY } from "@/constants/api";
import { SEARCH_DEBOUNCE_MS } from "@/constants/pos";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { browseProducts } from "@/lib/api/products";

interface UseProductBrowseOptions {
  categoryId: string | null;
  query: string;
}

// The product browser's grid: a category at a time, page by page.
//
// Paged rather than endless (CLAUDE.md rule 15) and accumulated rather than
// replaced, so "Show more" adds a row to what is already on screen instead of
// scrolling the cashier back to the top of a shelf they were halfway down.
//
// The query is debounced on the same clock as the selling screen's search box
// — it is the same backend search, typed the same way, and the two should not
// feel like different fields.
// Mounted only while the drawer is open (the sheet unmounts its content on
// close), so nothing here runs behind a sale.
export function useProductBrowse({ categoryId, query }: UseProductBrowseOptions) {
  const debounced = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

  const result = useInfiniteQuery({
    queryKey: [...PRODUCT_BROWSE_QUERY_KEY, categoryId ?? "all", debounced],
    queryFn: ({ pageParam }) => browseProducts({ categoryId, query: debounced, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta;
      if (!meta || meta.page >= meta.totalPages) return undefined;
      return meta.page + 1;
    },
  });

  return {
    ...result,
    products: result.data?.pages.flatMap((page) => page.products) ?? undefined,
    total: result.data?.pages[0]?.meta?.total ?? null,
    // Typed something the debounce hasn't caught up with: shown as loading
    // rather than as a grid that still belongs to the previous query.
    isTyping: query.trim() !== debounced,
  };
}
