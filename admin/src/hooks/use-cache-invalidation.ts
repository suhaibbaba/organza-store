"use client";

import { useMemo } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { DASHBOARD_SUMMARY_QUERY_KEY, CATEGORIES_QUERY_KEY, SETTINGS_QUERY_KEY, VARIANT_TYPES_QUERY_KEY } from "@/constants/api";
import { PRODUCT_LIST_QUERY_KEY } from "@/constants/products";
import { INVENTORY_LIST_QUERY_KEY } from "@/constants/inventory";
import {
  ORDER_COLLECTION_SUMMARY_QUERY_KEY,
  ORDER_DETAIL_QUERY_KEY,
  ORDER_LIST_QUERY_KEY,
} from "@/constants/orders";
import { REPORTS_SALES_QUERY_KEY, REPORTS_SUMMARY_QUERY_KEY } from "@/constants/reports";
import { USERS_LIST_QUERY_KEY } from "@/constants/users";

// Which screens a change makes wrong, in one place.
//
// Every mutation in the admin ends by calling one of these. They are written
// per *thing that changed*, not per endpoint, because one write is usually
// visible on several screens: a photo shows on the product page and in the
// list, a sale moves stock, the money owed, the dashboard and the reports at
// once. Keeping that map here — instead of a queryClient call at each call
// site — is what stops a new screen from quietly going stale.
//
// react-query matches query keys by prefix, so invalidating
// [PRODUCT_LIST_QUERY_KEY] covers the list (keyed [key, filters]) and every
// product's detail (keyed [key, id]) together. Where a specific id is known
// it is invalidated explicitly too, so the intent is readable rather than
// resting on that.

function invalidateProductViews(queryClient: QueryClient, productId?: string) {
  void queryClient.invalidateQueries({ queryKey: [PRODUCT_LIST_QUERY_KEY] });
  if (productId) void queryClient.invalidateQueries({ queryKey: [PRODUCT_LIST_QUERY_KEY, productId] });
  // Stock counts and the low-stock badge are read from the product rows.
  void queryClient.invalidateQueries({ queryKey: [INVENTORY_LIST_QUERY_KEY] });
  // Product/category counts, inventory value and the low-stock tile.
  void queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY });
}

export interface CacheInvalidation {
  /** A product's own data changed: fields, variants, photos, labels, stock. */
  productChanged: (productId?: string) => void;
  /** An order was created, advanced, returned, settled or deleted. */
  ordersChanged: (orderId?: string | string[]) => void;
  /** A category was added, renamed or removed. */
  categoriesChanged: () => void;
  /** A global option type or value was added. */
  variantTypesChanged: () => void;
  /** The shop settings were saved. */
  settingsChanged: () => void;
  /** A staff account was added, edited or deactivated. */
  usersChanged: () => void;
}

export function useCacheInvalidation(): CacheInvalidation {
  const queryClient = useQueryClient();

  return useMemo(
    () => ({
      productChanged(productId) {
        invalidateProductViews(queryClient, productId);
      },

      ordersChanged(orderId) {
        void queryClient.invalidateQueries({ queryKey: [ORDER_LIST_QUERY_KEY] });
        for (const one of orderId === undefined ? [] : Array.isArray(orderId) ? orderId : [orderId]) {
          void queryClient.invalidateQueries({ queryKey: [ORDER_DETAIL_QUERY_KEY, one] });
        }
        // What the delivery company still owes.
        void queryClient.invalidateQueries({ queryKey: ORDER_COLLECTION_SUMMARY_QUERY_KEY });
        // Every order mutation can move stock: creating deducts it (STORE) or
        // commits it later (online), advancing to PREPARING deducts it, and
        // cancelling, returning or deleting puts it back — so the catalogue
        // views go with it, or they keep showing quantities that aren't true.
        invalidateProductViews(queryClient);
        // A sale, a cancellation or a return all change the sales figures.
        void queryClient.invalidateQueries({ queryKey: REPORTS_SUMMARY_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: [REPORTS_SALES_QUERY_KEY] });
      },

      categoriesChanged() {
        void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
        // Product rows and the product page print their category's name, and
        // renaming a category has to reach them (CLAUDE.md rule 2: the name
        // is referenced, never copied).
        invalidateProductViews(queryClient);
      },

      variantTypesChanged() {
        void queryClient.invalidateQueries({ queryKey: VARIANT_TYPES_QUERY_KEY });
        // Variant rows are labelled with their option values, so a new value
        // has to be readable on the product it was just added from.
        void queryClient.invalidateQueries({ queryKey: [PRODUCT_LIST_QUERY_KEY] });
      },

      settingsChanged() {
        void queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
        // The currency every price is printed in, and the low-stock threshold
        // the dashboard tile and the inventory filter both count against
        // (CLAUDE.md rule 14 — the threshold lives in settings, so changing
        // it changes what those screens say).
        void queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: [INVENTORY_LIST_QUERY_KEY] });
      },

      usersChanged() {
        void queryClient.invalidateQueries({ queryKey: [USERS_LIST_QUERY_KEY] });
      },
    }),
    [queryClient]
  );
}
