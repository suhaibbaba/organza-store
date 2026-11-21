import { createContext, useContext, useEffect } from "react";

const PageTitleContext = createContext<((title: string | null) => void) | null>(null);

export const PageTitleProvider = PageTitleContext.Provider;

export function useDocumentTitle(title: string): void {
  const register = useContext(PageTitleContext);

  useEffect(() => {
    register?.(title);

    return () => register?.(null);
  }, [register, title]);
}
