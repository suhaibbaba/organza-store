import { createBrowserRouter, createHashRouter, Outlet } from 'react-router';
import { LoginPage } from '@web/modules/auth/LoginPage';
import { RequireAuth, RequireCapability } from '@web/modules/auth/guards';
import { TodayPage } from '@web/modules/home/TodayPage';
import { CategoriesPage } from '@web/modules/catalogue/CategoriesPage';
import { ProductDetailPage } from '@web/modules/catalogue/ProductDetailPage';
import { ProductFormPage } from '@web/modules/catalogue/ProductFormPage';
import { ProductsPage } from '@web/modules/catalogue/ProductsPage';
import { LabelsPage } from '@web/modules/labels/LabelsPage';
import { CurrenciesPage } from '@web/modules/settings/CurrenciesPage';
import { SettingsPage } from '@web/modules/settings/SettingsPage';
import { StaffPage } from '@web/modules/staff/StaffPage';
import { AdjustmentsPage } from '@web/modules/stock/AdjustmentsPage';
import { CountDetailPage } from '@web/modules/stock/CountDetailPage';
import { CountsPage } from '@web/modules/stock/CountsPage';
import { StockPage } from '@web/modules/stock/StockPage';
import { PosPage } from '@web/modules/pos/PosPage';
import { CouriersPage } from '@web/modules/orders/CouriersPage';
import { OrderDetailPage } from '@web/modules/orders/OrderDetailPage';
import { OrderNewPage } from '@web/modules/orders/OrderNewPage';
import { OrdersPage } from '@web/modules/orders/OrdersPage';
import { PickListPage } from '@web/modules/orders/PickListPage';
import { PurchaseFormPage } from '@web/modules/purchasing/PurchaseFormPage';
import {
  PurchaseOrderPage,
  PurchasingPage,
  ReceiptPage,
} from '@web/modules/purchasing/PurchasingPages';
import { SupplierDetailPage } from '@web/modules/purchasing/SupplierDetailPage';
import { SuppliersPage } from '@web/modules/purchasing/SuppliersPage';
import { ReportsPage } from '@web/modules/reports/ReportsPage';
import { DevicePage } from '@web/modules/device/DevicePage';
import { ApprovalsPage } from '@web/modules/sales/ApprovalsPage';
import { CustomerDetailPage } from '@web/modules/sales/CustomerDetailPage';
import { ReturnPage } from '@web/modules/sales/ReturnPage';
import { CustomersPage } from '@web/modules/sales/CustomersPage';
import { SaleDetailPage } from '@web/modules/sales/SaleDetailPage';
import { SalesPage } from '@web/modules/sales/SalesPage';
import { MyShiftPage, ShiftDetailPage, ShiftsPage } from '@web/modules/sales/ShiftPages';
import type { Capability } from '@organza/shared';
import type { ReactNode } from 'react';
import { RouteError } from '@web/shared/components/RouteError';
import { AppLayout } from './layout/AppLayout';

/** The desktop shell serves files without a history fallback, so it uses hash URLs. */
const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function guarded(path: string, capability: Capability, element: ReactNode) {
  return {
    path,
    element: <RequireCapability capability={capability}>{element}</RequireCapability>,
  };
}

export const routes = [
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  {
    element: (
      <RequireAuth>
        <Outlet />
      </RequireAuth>
    ),
    children: [
      {
        element: <AppLayout />,
        errorElement: <RouteError />,
        children: [
          { index: true, element: <TodayPage /> },
          guarded('admin/staff', 'staff.view', <StaffPage />),
          guarded('admin/settings', 'settings.view', <SettingsPage />),
          guarded('admin/currencies', 'currencies.view', <CurrenciesPage />),
          guarded('products', 'products.view', <ProductsPage />),
          guarded('products/new/:type', 'products.create', <ProductFormPage />),
          guarded('products/:id', 'products.view', <ProductDetailPage />),
          guarded('catalogue/setup', 'catalogue.manage', <CategoriesPage />),
          guarded('labels', 'labels.print', <LabelsPage />),
          guarded('stock', 'stock.view', <StockPage />),
          guarded('stock/adjustments', 'stock.adjust', <AdjustmentsPage />),
          guarded('stock/counts', 'stock.count', <CountsPage />),
          guarded('stock/counts/:id', 'stock.count', <CountDetailPage />),
          guarded('pos', 'sales.create', <PosPage />),
          guarded('sales', 'sales.view', <SalesPage />),
          guarded('sales/:id', 'sales.view', <SaleDetailPage />),
          guarded('sales/:id/return', 'sales.return', <ReturnPage />),
          guarded('approvals', 'approvals.request', <ApprovalsPage />),
          guarded('orders', 'orders.view', <OrdersPage />),
          guarded('orders/new', 'orders.create', <OrderNewPage />),
          guarded('orders/pick', 'orders.view', <PickListPage />),
          guarded('orders/:id', 'orders.view', <OrderDetailPage />),
          guarded('couriers', 'couriers.view', <CouriersPage />),
          guarded('suppliers', 'suppliers.view', <SuppliersPage />),
          guarded('suppliers/:id', 'suppliers.view', <SupplierDetailPage />),
          guarded('reports', 'reports.view', <ReportsPage />),
          guarded('device', 'shifts.operate', <DevicePage />),
          guarded('purchasing', 'purchasing.receive', <PurchasingPage />),
          guarded('purchasing/receive', 'purchasing.receive', <PurchaseFormPage mode="receive" />),
          guarded('purchasing/receipts/:id', 'purchasing.receive', <ReceiptPage />),
          guarded('purchasing/orders/new', 'purchasing.order', <PurchaseFormPage mode="order" />),
          guarded('purchasing/orders/:id', 'purchasing.receive', <PurchaseOrderPage />),
          guarded('shift', 'shifts.operate', <MyShiftPage />),
          guarded('shifts', 'shifts.viewAll', <ShiftsPage />),
          guarded('shifts/:id', 'shifts.operate', <ShiftDetailPage />),
          guarded('customers', 'customers.view', <CustomersPage />),
          guarded('customers/:id', 'customers.view', <CustomerDetailPage />),
        ],
      },
    ],
  },
];

export const router = isDesktop ? createHashRouter(routes) : createBrowserRouter(routes);
