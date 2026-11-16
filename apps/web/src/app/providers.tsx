import { DirectionProvider, MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionProvider } from '@web/modules/auth/session';
import { queryClient } from './query-client';
import { cssVariablesResolver, theme } from './theme';

export function Providers({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const dir = i18n.dir();
  return (
    <DirectionProvider initialDirection={dir} detectDirection>
      <MantineProvider
        theme={theme}
        defaultColorScheme="light"
        forceColorScheme="light"
        cssVariablesResolver={cssVariablesResolver}
      >
        <Notifications position={dir === 'rtl' ? 'top-left' : 'top-right'} />
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <ModalsProvider>{children}</ModalsProvider>
          </SessionProvider>
        </QueryClientProvider>
      </MantineProvider>
    </DirectionProvider>
  );
}
