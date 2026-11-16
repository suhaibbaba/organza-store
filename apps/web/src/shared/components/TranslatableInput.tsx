import { Collapse, Input, Textarea, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconWorld } from '@tabler/icons-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import classes from './TranslatableInput.module.css';

export type Translations = { ar?: string; en?: string; he?: string };
type Lang = keyof Translations;

interface Props {
  label: string;
  value: Translations;
  onChange: (value: Translations) => void;
  required?: boolean;
  multiline?: boolean;
  error?: string | undefined;
}

const OTHERS: Lang[] = ['en', 'he'];

/**
 * One box per translated field: Arabic always shows; English and Hebrew rows sit behind a
 * "Translations · Show/Hide" footer. Each row carries its language code. Opens by itself when
 * a translation is already filled in.
 */
export function TranslatableInput({ label, value, onChange, required, multiline, error }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(Boolean(value.en || value.he));

  const row = (lang: Lang) => (
    <div className={classes.row} key={lang}>
      <label className={classes.code} htmlFor={`${id}-${lang}`}>
        {lang.toUpperCase()}
      </label>
      {multiline ? (
        <Textarea
          id={`${id}-${lang}`}
          variant="unstyled"
          className={classes.field}
          classNames={{ input: classes.input }}
          dir={lang === 'en' ? 'ltr' : 'rtl'}
          autosize
          minRows={2}
          value={value[lang] ?? ''}
          onChange={(e) => onChange({ ...value, [lang]: e.currentTarget.value })}
        />
      ) : (
        <Input
          id={`${id}-${lang}`}
          variant="unstyled"
          className={classes.field}
          classNames={{ input: classes.input }}
          dir={lang === 'en' ? 'ltr' : 'rtl'}
          value={value[lang] ?? ''}
          onChange={(e) => onChange({ ...value, [lang]: e.currentTarget.value })}
        />
      )}
    </div>
  );

  return (
    <Input.Wrapper
      label={label}
      required={required}
      error={error}
      labelProps={{ htmlFor: `${id}-ar` }}
    >
      <div className={classes.box} data-error={error ? true : undefined}>
        {row('ar')}
        <Collapse expanded={open}>{OTHERS.map(row)}</Collapse>
        <UnstyledButton
          className={classes.footer}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <IconWorld size={16} />
          <span className={classes.footerLabel}>{t('common.translations')}</span>
          <span className={classes.toggle}>
            {open ? t('common.hide') : t('common.show')}
            <IconChevronDown size={14} className={classes.chevron} data-open={open || undefined} />
          </span>
        </UnstyledButton>
      </div>
    </Input.Wrapper>
  );
}
