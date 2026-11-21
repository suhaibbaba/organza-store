"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { can } from "@store/shared/lib/permissions";
import { fetchOrders } from "@/lib/api/orders";
import { fetchProducts } from "@/lib/api/products";
import { useSession } from "@/components/providers/session-provider";
import { useVisibleNavItems } from "@/hooks/use-visible-nav-items";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { localize } from "@/lib/i18n-content";
import { DEFAULT_ORDER_FILTERS } from "@/constants/orders";
import { DEFAULT_PRODUCT_FILTERS } from "@/constants/products";
import {
  GLOBAL_SEARCH_LIMIT,
  GLOBAL_SEARCH_MIN_CHARS,
  GLOBAL_SEARCH_QUERY_KEY,
  NUMERIC_QUERY_PATTERN,
} from "@/constants/search";
import type { GlobalSearchGroup, GlobalSearchGroupKey, GlobalSearchItem } from "@/types/search";

// Orders, products, customers (from order snapshots — there is no Customer table) and pages, each behind its own permission.
export function useGlobalSearch(query: string) {
  const t = useTranslations();
  const locale = useLocale();
  const { user } = useSession();
  const navItems = useVisibleNavItems();
  const formatMoney = useMoneyFormatter();

  const q = query.trim();
  const ready = q.length >= GLOBAL_SEARCH_MIN_CHARS;
  const canOrders = can(user, "order.view");
  const canProducts = can(user, "product.view");

  const ordersQuery = useQuery({
    queryKey: [GLOBAL_SEARCH_QUERY_KEY, "orders", q],
    queryFn: () => fetchOrders({ ...DEFAULT_ORDER_FILTERS, q, pageSize: GLOBAL_SEARCH_LIMIT }),
    enabled: ready && canOrders,
  });

  const productsQuery = useQuery({
    queryKey: [GLOBAL_SEARCH_QUERY_KEY, "products", q],
    queryFn: () => fetchProducts({ ...DEFAULT_PRODUCT_FILTERS, q }, GLOBAL_SEARCH_LIMIT),
    enabled: ready && canProducts,
  });

  const needle = q.toLocaleLowerCase(locale);
  const pages: GlobalSearchItem[] = q
    ? navItems
        .map((item) => ({ id: item.key, href: item.href, title: t(`nav.${item.key}`) }))
        .filter((item) => item.title.toLocaleLowerCase(locale).includes(needle))
    : [];

  const orderRows = ordersQuery.data?.orders ?? [];
  const orders: GlobalSearchItem[] = orderRows.map((order) => ({
    id: order.id,
    href: `/orders/${order.id}`,
    title: t("orders.card.orderNumber", { number: String(order.orderNumber) }),
    subtitle: order.customerName ?? t(`orders.channel.${order.channel}`),
    status: order.status,
    meta: formatMoney(order.total),
    thumbnailUrl: order.previewItems[0]?.thumbnailUrl ?? null,
  }));

  const customers: GlobalSearchItem[] = [];
  const seenPhones = new Set<string>();
  for (const order of orderRows) {
    if (!order.customerPhone || seenPhones.has(order.customerPhone)) continue;
    const matches =
      order.customerPhone.includes(q) || (order.customerName ?? "").toLocaleLowerCase(locale).includes(needle);
    if (!matches) continue;
    seenPhones.add(order.customerPhone);
    customers.push({
      id: order.id,
      href: `/orders?q=${encodeURIComponent(order.customerPhone)}`,
      title: order.customerName ?? order.customerPhone,
      subtitle: order.customerPhone,
    });
  }

  const products: GlobalSearchItem[] = (productsQuery.data?.products ?? []).map((product) => ({
    id: product.id,
    href: `/products/${product.id}`,
    title: localize(product.name, locale),
    subtitle: product.sku ?? undefined,
    meta: formatMoney(product.basePrice),
    thumbnailUrl: product.image?.thumbnailUrl ?? null,
    product,
  }));

  const encoded = encodeURIComponent(q);
  const byKey: Record<GlobalSearchGroupKey, GlobalSearchGroup> = {
    pages: { key: "pages", items: pages, total: pages.length },
    orders: {
      key: "orders",
      items: orders,
      total: ordersQuery.data?.meta?.total ?? orders.length,
      seeAllHref: `/orders?q=${encoded}`,
    },
    customers: { key: "customers", items: customers, total: customers.length },
    products: {
      key: "products",
      items: products,
      total: productsQuery.data?.meta?.total ?? products.length,
      seeAllHref: `/products?q=${encoded}`,
    },
  };

  const order: GlobalSearchGroupKey[] = NUMERIC_QUERY_PATTERN.test(q)
    ? ["orders", "customers", "products", "pages"]
    : ["pages", "products", "orders", "customers"];

  return {
    ready,
    groups: order.map((key) => byKey[key]).filter((group) => group.items.length > 0),
    isFetching: ordersQuery.isFetching || productsQuery.isFetching,
    isError: ordersQuery.isError || productsQuery.isError,
  };
}
