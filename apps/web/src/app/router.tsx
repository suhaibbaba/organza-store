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
        ],
      },
    ],
  },
];

export const router = isDesktop ? createHashRouter(routes) : createBrowserRouter(routes);
