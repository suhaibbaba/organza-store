import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Content that exists only on paper; see `printPortal`. */
export function PrintPortal({ children }: { children: ReactNode }) {
  return createPortal(<div className="print-root">{children}</div>, document.body);
}
