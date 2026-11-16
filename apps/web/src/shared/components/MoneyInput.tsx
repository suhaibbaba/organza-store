import { TextInput, type TextInputProps } from '@mantine/core';
import { toLatinDigits } from '@web/shared/lib/format';

interface Props extends Omit<TextInputProps, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

/** Money as a decimal string; Arabic digits and the Arabic decimal comma are accepted. */
export function MoneyInput({ value, onChange, ...rest }: Props) {
  return (
    <TextInput
      inputMode="decimal"
      dir="ltr"
      value={value}
      onChange={(e) => {
        const cleaned = toLatinDigits(e.currentTarget.value)
          .replace('\u066B', '.')
          .replace(',', '.')
          .replace(/[^\d.]/g, '');
        if (/^\d{0,8}(\.\d{0,2})?$/.test(cleaned)) onChange(cleaned);
      }}
      onBlur={() => {
        if (value && /^\d+(\.\d{0,2})?$/.test(value)) onChange(Number(value).toFixed(2));
      }}
      {...rest}
    />
  );
}

export const isMoney = (v: string) => /^\d{1,8}(\.\d{1,2})?$/.test(v);
