import { useTranslation } from 'react-i18next';
import { ApiError } from '@web/shared/lib/api-client';

/** Turns any error into a translated sentence using the API's stable error code. */
export function useErrorMessage(): (error: unknown) => string {
  const { t, i18n } = useTranslation();
  return (error: unknown) => {
    if (error instanceof ApiError) {
      if (error.status === 503 || error.status === 0) return t('errors.offline');
      const key = error.code ? `errors.${error.code}` : '';
      if (key && i18n.exists(key)) return t(key);
    }
    if (error instanceof TypeError) return t('errors.offline');
    return t('errors.generic');
  };
}
