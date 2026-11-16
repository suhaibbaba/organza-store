import { Anchor, Stack, Textarea, TextInput } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type Translations = { ar?: string; en?: string; he?: string };

interface Props {
  label: string;
  value: Translations;
  onChange: (value: Translations) => void;
  required?: boolean;
  multiline?: boolean;
  error?: string | undefined;
}

/** Arabic first; English and Hebrew behind a link so the common case stays one field. */
export function TranslatableInput({ label, value, onChange, required, multiline, error }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(Boolean(value.en || value.he));
  const Field = multiline ? Textarea : TextInput;
  const field = (lang: 'ar' | 'en' | 'he', fieldLabel: string, isRequired = false) => (
    <Field
      label={fieldLabel}
      required={isRequired}
      dir={lang === 'en' ? 'ltr' : 'rtl'}
      value={value[lang] ?? ''}
      error={lang === 'ar' ? error : undefined}
      autosize={multiline || undefined}
      minRows={multiline ? 2 : undefined}
      onChange={(e) => onChange({ ...value, [lang]: e.currentTarget.value })}
    />
  );
  return (
    <Stack gap={4}>
      {field('ar', label, required)}
      {open ? (
        <>
          {field('en', `${label} · ${t('languages.en')}`)}
          {field('he', `${label} · ${t('languages.he')}`)}
        </>
      ) : (
        <Anchor
          component="button"
          type="button"
          size="xs"
          onClick={() => setOpen(true)}
          style={{ alignSelf: 'flex-start' }}
        >
          {t('common.otherLanguages')}
        </Anchor>
      )}
    </Stack>
  );
}
