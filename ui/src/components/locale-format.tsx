import { DEFAULT_NUMBER_SEPARATORS, type NumberSeparators } from "@ui/lib/support";
import { createContext, useContext, type JSX, type ReactNode } from "react";

export interface LocaleFormat {
  readonly separators: NumberSeparators;
  readonly weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined;
}

const LocaleFormatContext = createContext<LocaleFormat>({
  separators: DEFAULT_NUMBER_SEPARATORS,
  weekStartsOn: undefined,
});

export function LocaleFormatProvider({
  value,
  children,
}: {
  readonly value: LocaleFormat;
  readonly children: ReactNode;
}): JSX.Element {
  return <LocaleFormatContext.Provider value={value}>{children}</LocaleFormatContext.Provider>;
}

export const useLocaleFormat = (): LocaleFormat => useContext(LocaleFormatContext);
