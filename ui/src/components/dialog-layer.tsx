import { createContext, useContext, type JSX, type ReactNode } from "react";

const DialogLayerContext = createContext<HTMLElement | null>(null);

export function DialogLayerProvider({
  container,
  children,
}: {
  readonly container: HTMLElement | null;
  readonly children: ReactNode;
}): JSX.Element {
  return <DialogLayerContext.Provider value={container}>{children}</DialogLayerContext.Provider>;
}

export function useDialogLayer(): HTMLElement | null {
  return useContext(DialogLayerContext);
}
