import type { Capability } from '@organza/shared';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Button, Center, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useSession } from './session';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, retry } = useSession();
  const location = useLocation();
  const { t } = useTranslation();
  if (status === 'restoring') return <FullScreenLoader />;
  if (status === 'unreachable') {
    return (
      <Center h="100%">
        <Stack align="center">
          <Text>{t('errors.offline')}</Text>
          <Button onClick={retry}>{t('common.retry')}</Button>
        </Stack>
      </Center>
    );
  }
  if (status === 'signed-out')
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function RequireCapability({
  capability,
  children,
}: {
  capability: Capability;
  children: ReactNode;
}) {
  const { can } = useSession();
  return can(capability) ? <>{children}</> : <Navigate to="/" replace />;
}
