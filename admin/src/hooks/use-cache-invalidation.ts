"use client";

import { useMemo } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  DASHBOARD_SUMMARY_QUERY_KEY,
  CATEGORIES_QUERY_KEY,
  SETTINGS_QUERY_KEY,
  VARIANT_TYPES_QUERY_KEY,
} from "@/constants/api";
import { PRODUCT_LIST_QUERY_KEY } from "@/constants/products";
import { INVENTORY_LIST_QUERY_KEY } from "@/constants/inventory";
import { ORDER_COLLECTION_SUMMARY_QUERY_KEY, ORDER_DETAIL_QUERY_KEY, ORDER_LIST_QUERY_KEY } from "@/constants/orders";
import { REPORTS_DAILY_QUERY_KEY, REPORTS_SALES_QUERY_KEY, REPORTS_SUMMARY_QUERY_KEY } from "@/constants/reports";
import { USERS_LIST_QUERY_KEY } from "@/constants/users";
import { EXPENSE_CATEGORIES_QUERY_KEY, EXPENSE_LIST_QUERY_KEY, EXPENSE_SUMMARY_QUERY_KEY } from "@/constants/expenses";
import { CASH_SESSION_CURRENT_QUERY_KEY } from "@/constants/dashboard";
import { SUPPLIER_DETAIL_QUERY_KEY, SUPPLIER_LIST_QUERY_KEY } from "@/constants/suppliers";
import { CUSTOMER_DETAIL_QUERY_KEY, CUSTOMER_LIST_QUERY_KEY } from "@/constants/customers";
import { CHANGE_REQUEST_COUNT_QUERY_KEY, CHANGE_REQUEST_LIST_QUERY_KEY } from "@/constants/changeRequests";

// Which screens a change makes stale, per thing changed, so a new screen can't quietly go stale.

function invalidateProductViews(queryClient: QueryClient, productId?: string) {
  void queryClient.invalidateQueries({ queryKey: [PRODUCT_LIST_QUERY_KEY] });
  if (productId) {
    void queryClient.invalidateQueries({ queryKey: [PRODUCT_LIST_QUERY_KEY, productId] });
  }
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
  /** An expense was recorded, edited or deleted. */
  expensesChanged: () => void;
  /** A customer was added or edited, or their account moved (a sale, a payment, a handover). */
  customersChanged: (customerId?: string) => void;
  /** A supplier, one of their invoices or a payment to them changed. */
  suppliersChanged: (supplierId?: string) => void;
  /** An expense category was added, renamed, retired or removed. */
  expenseCategoriesChanged: () => void;
}

export function useCacheInvalidation(): CacheInvalidation {
  const queryClient = useQueryClient();

  return useMemo(
    () => ({
      productChanged(productId) {
        invalidateProductViews(queryClient, productId);
      },

      customersChanged(customerId) {
        void queryClient.invalidateQueries({ queryKey: [CUSTOMER_LIST_QUERY_KEY] });
        if (customerId) {
          void queryClient.invalidateQueries({ queryKey: [CUSTOMER_DETAIL_QUERY_KEY, customerId] });
        }
        // Debts and kept pieces are on the dashboard's to-do list; a payment moves the drawer.
        void queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: CASH_SESSION_CURRENT_QUERY_KEY });
      },

      suppliersChanged(supplierId) {
        void queryClient.invalidateQueries({ queryKey: [SUPPLIER_LIST_QUERY_KEY] });
        if (supplierId) {
          void queryClient.invalidateQueries({ queryKey: [SUPPLIER_DETAIL_QUERY_KEY, supplierId] });
        }
        // A payment taken from the till moves the drawer.
        void queryClient.invalidateQueries({ queryKey: CASH_SESSION_CURRENT_QUERY_KEY });
      },

      ordersChanged(orderId) {
        void queryClient.invalidateQueries({ queryKey: [ORDER_LIST_QUERY_KEY] });
        for (const one of orderId === undefined ? [] : Array.isArray(orderId) ? orderId : [orderId]) {
          void queryClient.invalidateQueries({ queryKey: [ORDER_DETAIL_QUERY_KEY, one] });
        }
        // What the delivery company still owes, and what customers owe on credit.
        void queryClient.invalidateQueries({ queryKey: ORDER_COLLECTION_SUMMARY_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: [CUSTOMER_LIST_QUERY_KEY] });
        void queryClient.invalidateQueries({ queryKey: [CUSTOMER_DETAIL_QUERY_KEY] });
        // Every order mutation can move stock, so the catalogue views go with it.
        invalidateProductViews(queryClient);
        // A sale, a cancellation or a return all change the sales figures.
        void queryClient.invalidateQueries({ queryKey: REPORTS_SUMMARY_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: [REPORTS_SALES_QUERY_KEY] });
        void queryClient.invalidateQueries({ queryKey: REPORTS_DAILY_QUERY_KEY });
      },

      categoriesChanged() {
        void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
        // Product views print the category's name, which is referenced, not copied (rule 2).
        invalidateProductViews(queryClient);
      },

      variantTypesChanged() {
        void queryClient.invalidateQueries({ queryKey: VARIANT_TYPES_QUERY_KEY });
        // Variant rows are labelled with their option values.
        void queryClient.invalidateQueries({ queryKey: [PRODUCT_LIST_QUERY_KEY] });
      },

      settingsChanged() {
        void queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
        // Settings hold the currency and the low-stock threshold those screens count against (rule 14).
        void queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: [INVENTORY_LIST_QUERY_KEY] });
      },

      usersChanged() {
        void queryClient.invalidateQueries({ queryKey: [USERS_LIST_QUERY_KEY] });
      },

      expensesChanged() {
        void queryClient.invalidateQueries({ queryKey: [EXPENSE_LIST_QUERY_KEY] });
        void queryClient.invalidateQueries({ queryKey: [EXPENSE_SUMMARY_QUERY_KEY] });
        void queryClient.invalidateQueries({ queryKey: [EXPENSE_CATEGORIES_QUERY_KEY] });
        // A cash expense moves the drawer's expected amount; every approved one moves net profit.
        void queryClient.invalidateQueries({ queryKey: CASH_SESSION_CURRENT_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: REPORTS_SUMMARY_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: [REPORTS_SALES_QUERY_KEY] });
        // An Employee's expense, or deleting a pending one, changes the approvals queue.
        void queryClient.invalidateQueries({ queryKey: CHANGE_REQUEST_COUNT_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: [CHANGE_REQUEST_LIST_QUERY_KEY] });
      },

      expenseCategoriesChanged() {
        void queryClient.invalidateQueries({ queryKey: [EXPENSE_CATEGORIES_QUERY_KEY] });
        void queryClient.invalidateQueries({ queryKey: [EXPENSE_LIST_QUERY_KEY] });
      },
    }),
    [queryClient],
  );
}
