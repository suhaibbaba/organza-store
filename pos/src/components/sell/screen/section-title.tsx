import type { ReactNode } from "react";

export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-heading font-bold text-ink">
      <span className="h-4 w-1 shrink-0 rounded-pill bg-primary-600" aria-hidden="true" />
      {children}
    </h2>
  );
}
