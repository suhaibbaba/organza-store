import { createTheme, type ThemeOverride } from "@ui/theme/create-theme";
import { useEffect, useInsertionEffect, type JSX, type ReactNode } from "react";

export type Direction = "rtl" | "ltr";

export interface UiProviderProps {
  readonly theme?: ThemeOverride | undefined;
  readonly direction?: Direction | undefined;
  readonly lang?: string | undefined;
  readonly children: ReactNode;
}

const STYLE_ID = "store-ui-theme";

export function UiProvider({ theme, direction = "rtl", lang, children }: UiProviderProps): JSX.Element {
  useInsertionEffect(() => {
    if (theme === undefined) {
      return;
    }

    const style = document.getElementById(STYLE_ID) ?? document.createElement("style");

    style.id = STYLE_ID;
    style.textContent = createTheme(theme);
    document.head.append(style);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dir = direction;

    if (lang !== undefined) {
      document.documentElement.lang = lang;
    }
  }, [direction, lang]);

  return <>{children}</>;
}
