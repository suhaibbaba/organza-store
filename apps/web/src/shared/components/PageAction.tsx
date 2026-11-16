import { useMediaQuery } from '@mantine/hooks';
import { createContext, type ReactNode, useContext } from 'react';
import { createPortal } from 'react-dom';

/**
 * The page's main button sits in the top bar on wide screens and in the page header below that,
 * as in the clinic. The layout provides the top-bar slot; PageHeader places `primary` through it.
 */
export const PageActionSlot = createContext<HTMLElement | null>(null);

export const WIDE = '(min-width: 1025px)';

export function PageAction({ children }: { children: ReactNode }) {
  const slot = useContext(PageActionSlot);
  const wide = useMediaQuery(WIDE, true, { getInitialValueInEffect: false });
  if (wide && slot) return createPortal(children, slot);
  return <>{children}</>;
}
