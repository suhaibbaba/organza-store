import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/noto-sans-hebrew/400.css';
import '@fontsource/noto-sans-hebrew/500.css';
import '@fontsource/noto-sans-hebrew/700.css';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/spotlight/styles.css';
import './styles/global.css';
import './styles/clinic.css';
import './styles/ds.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Providers } from './app/providers';
import { router } from './app/router';
import { initI18n } from './i18n';
import { installDesktop } from './shared/platform/desktop';

installDesktop();

void initI18n().then(() => {
  const root = document.getElementById('root');
  if (!root) throw new Error('#root missing');
  createRoot(root).render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  );
});
