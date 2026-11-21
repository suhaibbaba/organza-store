import type { ReactNode } from "react";
import type { TableSort } from "@store/ui";
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";
import type { LucideIcon } from "lucide-react";
import type { I18n, Pagination } from "@organza/shared/types/common";
import type { ListOrdersQuery } from "@organza/shared/schemas/order";
import type { OrderFormSectionName } from "@/constants/orders";
import type { OrderCustomerFormValues } from "@/lib/validation/order-form";
import type { DiscountType, OrderChannel, OrderStatus, OrderSummary, PaymentStatus } from "@organza/shared/types/order";

// Mirrors ListOrdersQuery, but keeps "unset" distinct from the schema defaults and dates as yyyy-mm-dd.
export interface OrderListFilters {
  q: string;
  status: OrderStatus | null;
  channel: OrderChannel | null;
  paymentStatus: PaymentStatus | null;
  // A cancelled or returned order owes nothing and must not pad the outstanding amount.
  collectableOnly: boolean;
  // Quick sell's review list (spec.md "Quick sell"); false lists everything.
  hasQuickSale: boolean;
  dateFrom: string;
  dateTo: string;
  sortBy: ListOrdersQuery["sortBy"];
  sortDir: ListOrdersQuery["sortDir"];
  page: number;
  pageSize: number;
}

// Both null = no discount; the two always move together (isDiscountConsistent).
export interface DiscountState {
  type: DiscountType | null;
  value: string | null;
}

// Display copies only: the API re-reads price and name, so a stale price can never become a wrong order.
export interface OrderDraftLine {
  // Adding the same item twice bumps this line rather than stacking a duplicate.
  key: string;
  productId: string;
  variantId: string | null;
  name: I18n;
  variantName: I18n | null;
  sku: string | null;
  imageUrl: string | null;
  unitPrice: string;
  // Guards against an order the backend will reject; the atomic stock guard is the real check.
  availableStock: number;
  quantity: number;
  discountType: DiscountType | null;
  discountValue: string | null;
}

export interface OrderDraftTotals {
  itemCount: number;
  // Item discounts already applied.
  subtotal: string;
  itemDiscountTotal: string;
  orderDiscountAmount: string;
  total: string;
}

// No Customer entity yet (spec.md "Customer information"): the snapshot is copied onto the order.
export interface OrderCustomerDraft {
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
  // Read from the pasted Google Maps link; empty when there is none.
  latitude: string;
  longitude: string;
  note: string;
}

export interface CustomerFormProps {
  register: UseFormRegister<OrderCustomerFormValues>;
  control: Control<OrderCustomerFormValues>;
  setValue: UseFormSetValue<OrderCustomerFormValues>;
  errors: FieldErrors<OrderCustomerFormValues>;
}

export interface OrderKindFieldsProps {
  control: Control<OrderCustomerFormValues>;
  channel: string;
  isGift: boolean;
  canGift: boolean;
}

export interface OrderFormSectionProps {
  name: OrderFormSectionName;
  forceOpen?: boolean;
  children: ReactNode;
}

// Absent or 0 = that line is not part of this return.
export type ReturnQuantities = Record<string, number>;

export interface CustomerContactRowProps {
  icon?: LucideIcon;
  // Multi-line content (an address) aligns to the top instead of the middle.
  multiline?: boolean;
  className?: string;
  children: ReactNode;
}

export interface CollectionTableProps {
  orders: OrderSummary[];
  meta: Pagination | null;
  isRefreshing: boolean;
  selectedIds: string[];
  sort: TableSort;
  onToggle: (id: string) => void;
  onToggleAll: (select: boolean) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export interface OrderFiltersValue {
  status: OrderListFilters["status"];
  channel: OrderListFilters["channel"];
  paymentStatus: OrderListFilters["paymentStatus"];
  hasQuickSale: boolean;
  dateFrom: string;
  dateTo: string;
}

export interface OrderSortValue {
  sortBy: OrderListFilters["sortBy"];
  sortDir: OrderListFilters["sortDir"];
}

export type OrderFilterKey = "paymentStatus";

export interface OrderFiltersProps {
  value: OrderFiltersValue;
  sort: OrderSortValue;
  onApply: (value: OrderFiltersValue, sort: OrderSortValue) => void;
  // A page that fixes a filter (collection: unpaid only) hides it.
  omit?: readonly OrderFilterKey[];
}

export interface OrderFilterChipsProps {
  value: OrderFiltersValue;
  onChange: (value: OrderFiltersValue) => void;
}

export interface CollectionActionBarProps {
  count: number;
  amount: string;
  isPending: boolean;
  onConfirm: () => void;
  onClear: () => void;
}
