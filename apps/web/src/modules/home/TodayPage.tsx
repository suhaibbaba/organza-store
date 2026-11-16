import { Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useSession } from '@web/modules/auth/session';
import { PageHeader } from '@web/shared/components/PageHeader';

export function TodayPage() {
  const { t } = useTranslation();
  const { user } = useSession();
  return (
    <>
      <PageHeader title={t('home.title')} />
      <Text>{t('home.welcome', { name: user?.name ?? '' })}</Text>
    </>
  );
}
