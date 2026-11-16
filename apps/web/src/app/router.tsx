import { createBrowserRouter, createHashRouter, Outlet } from 'react-router';
import { LoginPage } from '@web/modules/auth/LoginPage';
import { RequireAuth, RequireCapability } from '@web/modules/auth/guards';
import { TodayPage } from '@web/modules/home/TodayPage';
import { StaffPage } from '@web/modules/staff/StaffPage';
import { AppLayout } from './layout/AppLayout';

/** The desktop shell serves files without a history fallback, so it uses hash URLs. */
const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const routes = [
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <Outlet />
      </RequireAuth>
    ),
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <TodayPage /> },
          {
            path: 'admin/staff',
            element: (
              <RequireCapability capability="staff.view">
                <StaffPage />
              </RequireCapability>
            ),
          },
        ],
      },
    ],
  },
];

export const router = isDesktop ? createHashRouter(routes) : createBrowserRouter(routes);
